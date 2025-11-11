import { registerApiRoute as originalRegisterApiRoute } from "@mastra/core/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "../../shared/schema";
import { pgPool } from "../mastra/storage/index";

/**
 * Telegram Admin Triggers
 * Handles admin menu commands and callback button presses
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

// Create Drizzle client
const db = drizzle(pgPool, { schema });

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
  console.warn(
    "Telegram admin triggers require TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID"
  );
}

/**
 * Register Telegram Admin Webhook Routes
 * UNIFIED webhook handler - processes both messages and callbacks
 */
export function registerTelegramAdminTriggers() {
  return [
    // Unified Telegram webhook - handles both /start commands and callback buttons
    originalRegisterApiRoute("/webhooks/telegram", {
      method: "POST",
      handler: async (c) => {
        const mastra = c.get("mastra");
        const logger = mastra.getLogger();
        
        try {
          const payload = await c.req.json();
          logger?.info("📲 [Telegram Admin] Webhook received", payload);

          // Handle callback button presses (approval/rejection/menu selections)
          if (payload.callback_query) {
            const callbackQuery = payload.callback_query;

          const callbackData = callbackQuery.data;
          const chatId = callbackQuery.message.chat.id;
          const messageId = callbackQuery.message.message_id;

          // Handle different callback actions
          if (callbackData.startsWith("approve_")) {
            // Admin approved content
            const demoId = callbackData.replace("approve_", "");
            logger?.info("✅ [Telegram Admin] Content approved", { demoId });

            // Update demo session status to approved
            const { demoRepository } = await import("../mastra/storage/demoRepository");
            await demoRepository.updateDemoStatusById(parseInt(demoId), "approved", logger);

            // Send confirmation to admin
            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: callbackQuery.id,
                  text: "✅ تَمَّ التَّأْكِيدُ! سَيُرْسَلُ المُحْتَوَى إِلَى القَنَاةِ...",
                }),
              }
            );

            // Edit original message to show it's approved
            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: messageId,
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: "✅ تَمَّ التَّأْكِيدُ", callback_data: "already_approved" }]
                    ]
                  }
                }),
              }
            );

            // Trigger Step 3 - send to channel
            logger?.info("🚀 [Telegram Admin] Fetching demo content and sending to channel...");
            
            try {
              // Import sendToTelegramChannel step
              const { sendToTelegramChannel } = await import("../mastra/workflows/contentMakerWorkflow");
              
              // Get full demo content from database
              const demo = await db.select().from(schema.demoSessions).where(eq(schema.demoSessions.id, parseInt(demoId))).limit(1);
              
              if (!demo || demo.length === 0) {
                logger?.error("❌ Demo not found", { demoId });
                return c.json({ ok: false, error: "Demo not found" }, 404);
              }
              
              const demoData = demo[0];
              
              // Execute Step 3 with full demo data
              // Note: sendToTelegramChannel is a Mastra step, not a regular function
              // We'll call it directly with the proper context
              const stepContext = {
                inputData: {
                  previewSent: true,
                  message: "Approved by admin",
                  podcastTitle: demoData.podcastTitle,
                  podcastContent: demoData.podcastContent,
                  questions: demoData.questions as any,
                  imageUrl: demoData.imageUrl,
                  audioStoragePath: demoData.audioStoragePath || demoData.audioUrl || "",
                  contentType: demoData.contentType || "podcast",
                },
                mastra,
              };
              
              const result = await (sendToTelegramChannel as any).execute(stepContext);
              
              logger?.info("✅ [Telegram Admin] Content sent to channel", { result });
              
              // Update status to 'posted'
              await demoRepository.updateDemoStatusById(parseInt(demoId), "posted", logger);
              
            } catch (channelError: any) {
              logger?.error("❌ [Telegram Admin] Failed to send to channel", {
                error: channelError?.message,
                stack: channelError?.stack,
              });
            }

          } else if (callbackData.startsWith("reject_")) {
            // Admin rejected content
            const demoId = callbackData.replace("reject_", "");
            logger?.info("❌ [Telegram Admin] Content rejected", { demoId });

            const { demoRepository } = await import("../mastra/storage/demoRepository");
            await demoRepository.updateDemoStatusById(parseInt(demoId), "rejected", logger);

            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: callbackQuery.id,
                  text: "❌ تَمَّ الرَّفْضُ. لَنْ يُرْسَلَ المُحْتَوَى.",
                }),
              }
            );

            // Edit original message
            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: messageId,
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: "❌ مَرْفُوضٌ", callback_data: "already_rejected" }]
                    ]
                  }
                }),
              }
            );

          } else if (callbackData === "view_tests") {
            // Show test categories (listening/reading)
            logger?.info("📋 [Telegram Admin] View tests menu");

            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: callbackQuery.id,
                  text: "📋 Testlar ro'yxati",
                }),
              }
            );

            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `📋 *Testlar ro'yxati*\n\nKategoriyani tanlang:`,
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "🎧 Tinglash testlari", callback_data: "list_listening" },
                      ],
                      [
                        { text: "📖 O'qish testlari", callback_data: "list_reading" },
                      ],
                      [
                        { text: "◀️ Orqaga", callback_data: "back_to_menu" },
                      ],
                    ],
                  },
                }),
              }
            );

          } else if (callbackData === "list_listening" || callbackData === "list_reading") {
            // Show level selection for specific category
            const contentType = callbackData.replace("list_", "");
            logger?.info("📋 [Telegram Admin] Show level selection", { contentType });

            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: callbackQuery.id,
                  text: "📊 Darajani tanlang",
                }),
              }
            );

            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `${contentType === "listening" ? "🎧 Tinglash" : "📖 O'qish"} testlari\n\nDarajani tanlang:`,
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "A1", callback_data: `viewlevel_${contentType}_A1` },
                        { text: "A2", callback_data: `viewlevel_${contentType}_A2` },
                      ],
                      [
                        { text: "B1", callback_data: `viewlevel_${contentType}_B1` },
                        { text: "B2", callback_data: `viewlevel_${contentType}_B2` },
                      ],
                      [
                        { text: "◀️ Orqaga", callback_data: "view_tests" },
                      ],
                    ],
                  },
                }),
              }
            );

          } else if (callbackData.startsWith("viewlevel_")) {
            // Show test list for specific category and level
            const [_, contentType, level] = callbackData.split("_"); // e.g., "viewlevel_listening_A2"
            logger?.info("📋 [Telegram Admin] List tests by level", { contentType, level });

            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: callbackQuery.id,
                  text: "🔄 Yuklanmoqda...",
                }),
              }
            );

            // Fetch tests from database by content type and level
            const { demoRepository } = await import("../mastra/storage/demoRepository");
            const tests = await demoRepository.listDemosByContentTypeAndLevel(contentType, level, 20, logger);

            if (tests.length === 0) {
              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `📋 *${contentType === "listening" ? "🎧 Tinglash" : "📖 O'qish"} testlari - ${level}*\n\nHozircha testlar yo'q.`,
                    parse_mode: "Markdown",
                    reply_markup: {
                      inline_keyboard: [
                        [{ text: "◀️ Orqaga", callback_data: `list_${contentType}` }],
                      ],
                    },
                  }),
                }
              );
            } else {
              // Create buttons for each test (max 10 per message)
              const testButtons = tests.slice(0, 10).map((test, index) => [
                { 
                  text: `${index + 1}. ${test.podcastTitle.substring(0, 40)}...`, 
                  callback_data: `view_test_${test.id}` 
                }
              ]);

              testButtons.push([{ text: "◀️ Orqaga", callback_data: `list_${contentType}` }]);

              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `📋 *${contentType === "listening" ? "🎧 Tinglash" : "📖 O'qish"} testlari - ${level}*\n\nJami: ${tests.length} ta test\n\nTestni tanlang:`,
                    parse_mode: "Markdown",
                    reply_markup: {
                      inline_keyboard: testButtons,
                    },
                  }),
                }
              );
            }

          } else if (callbackData.startsWith("view_test_")) {
            // Show FULL test content (audio/text + quizzes, just like channel posts)
            const testId = parseInt(callbackData.replace("view_test_", ""));
            logger?.info("📄 [Telegram Admin] View FULL test content", { testId });

            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: callbackQuery.id,
                  text: "🔄 Yuklanmoqda...",
                }),
              }
            );

            // Fetch test from database
            const { demoRepository } = await import("../mastra/storage/demoRepository");
            const test = await demoRepository.getDemoById(testId, logger);

            if (!test) {
              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: "❌ Test topilmadi.",
                  }),
                }
              );
            } else {
              // Send FULL content based on type (like channel posts)
              if (test.contentType === "listening") {
                // LISTENING: Send audio file + quizzes
                logger?.info("🎧 [Admin] Sending FULL listening content (audio + quizzes)");
                
                let audioSent = false;
                
                // Try downloading from App Storage first
                if (test.audioStoragePath) {
                  try {
                    const { appStorageClient } = await import("../mastra/storage/appStorageClient");
                    logger?.info("📥 [Admin] Downloading audio from App Storage", { filename: test.audioStoragePath });
                    const audioBuffer = await appStorageClient.downloadAsBuffer(test.audioStoragePath, logger);
                    
                    const FormData = (await import("form-data")).default;
                    const formData = new FormData();
                    formData.append('chat_id', chatId);
                    formData.append('audio', audioBuffer, {
                      filename: 'test-audio.mp3',
                      contentType: 'audio/mpeg',
                    });
                    formData.append('caption', '🎧 *' + test.podcastTitle + '*\n\n' + test.level);
                    formData.append('parse_mode', 'Markdown');
                    
                    await new Promise((resolve, reject) => {
                      formData.submit({
                        protocol: 'https:',
                        host: 'api.telegram.org',
                        path: `/bot${TELEGRAM_BOT_TOKEN}/sendAudio`,
                        method: 'POST',
                      }, (err, res) => {
                        if (err) return reject(err);
                        resolve(res);
                      });
                    });
                    
                    logger?.info("✅ [Admin] Audio sent successfully from App Storage");
                    audioSent = true;
                  } catch (audioError: any) {
                    logger?.error("❌ [Admin] Failed to send audio from App Storage", { error: audioError.message });
                  }
                }
                
                // Fallback: Try using audioUrl (for legacy tests)
                if (!audioSent && test.audioUrl && test.audioUrl.startsWith("http")) {
                  try {
                    logger?.info("🔄 [Admin] Trying audioUrl fallback (legacy test)", { url: test.audioUrl.substring(0, 50) });
                    
                    await fetch(
                      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          audio: test.audioUrl,
                          caption: `🎧 *${test.podcastTitle}*\n\n${test.level}`,
                          parse_mode: "Markdown",
                        }),
                      }
                    );
                    
                    logger?.info("✅ [Admin] Audio sent successfully from URL (legacy)");
                    audioSent = true;
                  } catch (urlError: any) {
                    logger?.error("❌ [Admin] Failed to send audio from URL", { error: urlError.message });
                  }
                }
                
                // Notify admin if audio couldn't be sent
                if (!audioSent) {
                  await fetch(
                    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: `⚠️ Audio yuborishda xatolik yuz berdi.\n\nTest: ${test.podcastTitle}`,
                      }),
                    }
                  );
                }
                
              } else if (test.contentType === "reading") {
                // READING: Send text only (no audio, no image)
                logger?.info("📖 [Admin] Sending FULL reading content (text + quizzes)");
                
                const readingText = `📖 *${test.podcastTitle}*\n\n${test.podcastContent}`;
                
                await fetch(
                  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: readingText,
                      parse_mode: "Markdown",
                    }),
                  }
                );
                
                logger?.info("✅ [Admin] Reading text sent successfully");
              }
              
              // Send quizzes (for both listening and reading)
              const questions = test.questions as any[];
              logger?.info(`📝 [Admin] Sending ${questions.length} quizzes...`);
              
              for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                
                try {
                  await fetch(
                    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPoll`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        question: `${i + 1}. ${question.question}`,
                        options: question.options.map((opt: string) => opt.substring(0, 100)),
                        type: "quiz",
                        correct_option_id: question.correctAnswer,
                        explanation: question.explanation,
                        is_anonymous: false,
                      }),
                    }
                  );
                  
                  logger?.info(`✅ [Admin] Quiz ${i + 1} sent`);
                } catch (quizError: any) {
                  logger?.error(`❌ [Admin] Failed to send quiz ${i + 1}`, { error: quizError.message });
                }
              }
              
              // Send navigation buttons after all content
              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `✅ Test to'liq ko'rsatildi!\n\nID: ${test.id} | Daraja: ${test.level} | Status: ${test.status}`,
                    reply_markup: {
                      inline_keyboard: [
                        [
                          { text: "◀️ Orqaga", callback_data: `viewlevel_${test.contentType}_${test.level}` },
                        ],
                      ],
                    },
                  }),
                }
              );
            }

          } else if (callbackData.startsWith("edit_test_")) {
            // Edit test (for now, just show a message)
            const testId = parseInt(callbackData.replace("edit_test_", ""));
            logger?.info("✏️ [Telegram Admin] Edit test", { testId });

            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: callbackQuery.id,
                  text: "✏️ Tahrirlash funksiyasi keyinroq qo'shiladi",
                  show_alert: true,
                }),
              }
            );

          } else if (callbackData === "back_to_menu") {
            // Back to main menu
            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: callbackQuery.id,
                  text: "🏠 Bosh menyu",
                }),
              }
            );

            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `🎓 *مَرْحَبًا بِكَ فِي Content Maker Bot!*\n\nTanlang:`,
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "➕ Yangi test yaratish", callback_data: "select_topic" },
                      ],
                      [
                        { text: "📋 Testlar ro'yxati", callback_data: "view_tests" },
                      ],
                    ],
                  },
                }),
              }
            );

          } else if (callbackData === "select_topic") {
            // Step 1: Topic selection
            logger?.info("📚 [Telegram Admin] Topic selection menu");

            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: callbackQuery.id,
                  text: "📚 Mavzu tanlang",
                }),
              }
            );

            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `📚 *Mavzu tanlang:*\n\n(Diniy mavzular qo'shilmaydi)`,
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "🔬 Fan (Science)", callback_data: "topic_Science" },
                        { text: "💻 Texnologiya (Tech)", callback_data: "topic_Technology" },
                      ],
                      [
                        { text: "🏥 Salomatlik (Health)", callback_data: "topic_Health" },
                        { text: "🎭 Madaniyat (Culture)", callback_data: "topic_Culture" },
                      ],
                      [
                        { text: "📜 Tarix (History)", callback_data: "topic_History" },
                        { text: "🌍 Ekologiya (Environment)", callback_data: "topic_Environment" },
                      ],
                      [
                        { text: "📚 Ta'lim (Education)", callback_data: "topic_Education" },
                        { text: "✍️ O'zim yozaman", callback_data: "topic_Custom" },
                      ],
                      [
                        { text: "◀️ Orqaga", callback_data: "back_to_menu" },
                      ],
                    ],
                  },
                }),
              }
            );

          } else if (callbackData.startsWith("topic_")) {
            // Step 2: After topic selected, show content type selection
            const topic = callbackData.replace("topic_", "");
            logger?.info("📝 [Telegram Admin] Topic selected", { topic });

            if (topic === "Custom") {
              // Handle custom topic input
              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    callback_query_id: callbackQuery.id,
                    text: "✍️ Custom topic (keyinroq)",
                    show_alert: true,
                  }),
                }
              );

              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `✍️ *O'z mavzuingizni yozing*\n\n(Keyinroq qo'shiladi - hozircha tayyor mavzulardan birini tanlang)`,
                    parse_mode: "Markdown",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          { text: "◀️ Orqaga", callback_data: "select_topic" },
                        ],
                      ],
                    },
                  }),
                }
              );
            } else {
              // Show content type selection
              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    callback_query_id: callbackQuery.id,
                    text: `✅ ${topic} tanlandi`,
                  }),
                }
              );

              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `📝 Mavzu: *${topic}*\n\nTurini tanlang:`,
                    parse_mode: "Markdown",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          { text: "🎧 Tinglash (Listening)", callback_data: `type_listening_${topic}` },
                        ],
                        [
                          { text: "📖 O'qish (Reading)", callback_data: `type_reading_${topic}` },
                        ],
                        [
                          { text: "◀️ Orqaga", callback_data: "select_topic" },
                        ],
                      ],
                    },
                  }),
                }
              );
            }

          } else if (callbackData.startsWith("type_")) {
            // Step 3: After content type selected, check if it's listening (need audio provider selection)
            const [_, contentType, topic] = callbackData.split("_"); // e.g., "type_listening_Science"
            logger?.info("📊 [Telegram Admin] Content type selected", { contentType, topic });

            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: callbackQuery.id,
                  text: `✅ ${contentType === "listening" ? "Tinglash" : "O'qish"} tanlandi`,
                }),
              }
            );

            if (contentType === "listening") {
              // For listening, show audio provider selection
              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `📊 Mavzu: *${topic}*\nTur: *🎧 Tinglash*\n\nAudio provayderini tanlang:`,
                    parse_mode: "Markdown",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          { text: "🎙️ ElevenLabs", callback_data: `provider_elevenlabs_${topic}` },
                        ],
                        [
                          { text: "🗣️ Lahajati", callback_data: `provider_lahajati_${topic}` },
                        ],
                        [
                          { text: "◀️ Orqaga", callback_data: `topic_${topic}` },
                        ],
                      ],
                    },
                  }),
                }
              );
            } else {
              // For reading, go directly to level selection
              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `📊 Mavzu: *${topic}*\nTur: *📖 O'qish*\n\nDarajani tanlang:`,
                    parse_mode: "Markdown",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          { text: "A1 (Boshlang'ich)", callback_data: `level_A1_reading_none_${topic}` },
                          { text: "A2 (Oddiy)", callback_data: `level_A2_reading_none_${topic}` },
                        ],
                        [
                          { text: "B1 (O'rta)", callback_data: `level_B1_reading_none_${topic}` },
                          { text: "B2 (Yuqori)", callback_data: `level_B2_reading_none_${topic}` },
                        ],
                        [
                          { text: "◀️ Orqaga", callback_data: `topic_${topic}` },
                        ],
                      ],
                    },
                  }),
                }
              );
            }

          } else if (callbackData.startsWith("provider_")) {
            // Step 4: After audio provider selected, show level selection
            const [_, audioProvider, topic] = callbackData.split("_"); // e.g., "provider_elevenlabs_Science"
            logger?.info("🎙️ [Telegram Admin] Audio provider selected", { audioProvider, topic });

            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: callbackQuery.id,
                  text: `✅ ${audioProvider === "elevenlabs" ? "ElevenLabs" : "Lahajati"} tanlandi`,
                }),
              }
            );

            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `📊 Mavzu: *${topic}*\nTur: *🎧 Tinglash*\nAudio: *${audioProvider === "elevenlabs" ? "🎙️ ElevenLabs" : "🗣️ Lahajati"}*\n\nDarajani tanlang:`,
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "A1 (Boshlang'ich)", callback_data: `level_A1_listening_${audioProvider}_${topic}` },
                        { text: "A2 (Oddiy)", callback_data: `level_A2_listening_${audioProvider}_${topic}` },
                      ],
                      [
                        { text: "B1 (O'rta)", callback_data: `level_B1_listening_${audioProvider}_${topic}` },
                        { text: "B2 (Yuqori)", callback_data: `level_B2_listening_${audioProvider}_${topic}` },
                      ],
                      [
                        { text: "◀️ Orqaga", callback_data: `type_listening_${topic}` },
                      ],
                    ],
                  },
                }),
              }
            );

          } else if (callbackData.startsWith("level_")) {
            // Step 5: Trigger workflow with all parameters
            const parts = callbackData.split("_"); // e.g., "level_A1_listening_elevenlabs_Science" or "level_A1_reading_none_Science"
            const level = parts[1]; // A1, A2, B1, B2
            const contentType = parts[2]; // listening, reading
            const audioProvider = parts[3]; // elevenlabs, lahajati, none (for reading)
            const topic = parts.slice(4).join("_"); // Science, Technology, etc. (handle multi-word topics)
            
            logger?.info("🎯 [Telegram Admin] Create content with all params", { contentType, level, audioProvider, topic });

            // CRITICAL: Answer callback query IMMEDIATELY
            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: callbackQuery.id,
                  text: `🔄 يُنْشَأُ ${contentType} - ${level}...`,
                }),
              }
            );

            // Send immediate confirmation message
            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `⏳ *Yaratilmoqda...*\n\n📚 Mavzu: ${topic}\n${contentType === "listening" ? "🎧" : "📖"} Tur: ${contentType}\n📊 Daraja: ${level}\n\nYaqin orada preview yuboriladi...`,
                  parse_mode: "Markdown",
                }),
              }
            );

            // Trigger workflow with all parameters
            logger?.info("🚀 [Telegram Admin] Triggering content creation workflow with all params...", {
              contentType,
              level,
              topic,
              audioProvider,
            });
            
            // Run workflow in background
            (async () => {
              try {
                const { contentMakerWorkflow } = await import("../mastra/workflows/contentMakerWorkflow");
                
                const run = await contentMakerWorkflow.createRunAsync();
                const result = await run.start({
                  inputData: {
                    contentType,
                    level,
                    topic,
                    audioProvider: audioProvider === "none" ? undefined : audioProvider,
                  },
                });
                
                logger?.info("✅ [Telegram Admin] Workflow triggered successfully with topic", {
                  status: result?.status,
                });
              } catch (triggerError: any) {
                logger?.error("❌ [Telegram Admin] Failed to trigger workflow", {
                  error: triggerError?.message,
                  stack: triggerError?.stack,
                });
                
                await fetch(
                  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: `❌ خَطَأٌ فِي إِنْشَاءِ المُحْتَوَى: ${triggerError?.message}`,
                    }),
                  }
                );
              }
            })();
          }

            return c.json({ ok: true });
          }

          // Handle /start command and other messages
          if (payload.message) {
            const message = payload.message;
            const chatId = message.chat.id;

            // ================================================
            // HANDLE CUSTOM CONTENT UPLOAD (Audio + Caption)
            // ================================================
            if ((message.audio || message.voice) && message.caption) {
              logger?.info("🎵 [Telegram Admin] Audio + caption received for custom content");

              const caption = message.caption;
              const audioFile = message.audio || message.voice;
              const audioFileId = audioFile.file_id;

              // Send processing message
              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `⏳ *Обрабатываем...*\n\n📝 Текст получен\n🎵 Аудио получено\n\nГенерируем 5 вопросов из текста...`,
                    parse_mode: "Markdown",
                  }),
                }
              );

              // Process in background
              (async () => {
                try {
                  // Import tool
                  const { generateQuestionsFromText } = await import("../mastra/tools/generateQuestionsFromText");
                  const { demoRepository } = await import("../mastra/storage/demoRepository");

                  // Generate questions from text
                  logger?.info("📝 [Custom Content] Generating questions from text...");
                  const questionsResult = await generateQuestionsFromText.execute({
                    context: {
                      text: caption,
                      level: "B1",
                    },
                    mastra,
                    runtimeContext: undefined as any,
                  });

                  if (!questionsResult.success || questionsResult.questions.length === 0) {
                    throw new Error("Failed to generate questions");
                  }

                  // Download audio from Telegram
                  logger?.info("⬇️ [Custom Content] Downloading audio...");
                  const fileInfoResponse = await fetch(
                    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${audioFileId}`
                  );
                  const fileInfo = await fileInfoResponse.json();
                  const filePath = fileInfo.result.file_path;

                  const audioResponse = await fetch(
                    `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`
                  );
                  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

                  // Upload to App Storage
                  const { appStorageClient } = await import("../mastra/storage/appStorageClient");
                  const { Readable } = await import("stream");
                  const audioStream = Readable.from(audioBuffer);
                  
                  const title = caption.substring(0, 50) + (caption.length > 50 ? "..." : "");
                  const { url: audioUrl, filename } = await appStorageClient.uploadAudioStream(
                    audioStream,
                    title,
                    logger
                  );

                  // Save to database
                  logger?.info("💾 [Custom Content] Saving to database...");
                  const customContent = await demoRepository.createCustomContent(
                    {
                      title,
                      textContent: caption,
                      audioFileId,
                      audioUrl,
                      audioStoragePath: filename,
                      questions: questionsResult.questions,
                      level: "B1",
                    },
                    logger
                  );

                  // Send preview to admin
                  logger?.info("📧 [Custom Content] Sending preview to admin...");
                  const previewText = `🎯 *Yangi custom content tayyor!*\n\n` +
                    `📖 *Sarlavha:* ${title}\n\n` +
                    `📝 *Matn:*\n${caption.substring(0, 200)}${caption.length > 200 ? "..." : ""}\n\n` +
                    `❓ *Savollar:* ${questionsResult.questions.length} ta\n\n` +
                    `Yuborishni tasdiqlaysizmi?`;

                  await fetch(
                    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        audio: audioFileId,
                        caption: previewText,
                        parse_mode: "Markdown",
                        reply_markup: {
                          inline_keyboard: [
                            [
                              {
                                text: "✅ Yuborish",
                                callback_data: `approve_custom_${customContent.slug}`,
                              },
                              {
                                text: "❌ Rad etish",
                                callback_data: `reject_custom_${customContent.slug}`,
                              },
                            ],
                          ],
                        },
                      }),
                    }
                  );

                  logger?.info("✅ [Custom Content] Preview sent successfully!");
                } catch (error: any) {
                  logger?.error("❌ [Custom Content] Error processing upload", {
                    error: error?.message,
                  });

                  await fetch(
                    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: `❌ Хато: ${error?.message}`,
                      }),
                    }
                  );
                }
              })();

              return c.json({ ok: true });
            }

            // Ignore non-text messages (polls, media without caption, etc.)
            if (!message.text) {
              return c.json({ ok: true });
            }

            const text = message.text;

            // Only respond to /start command
            if (text === "/start" || text === "/menu") {
              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `🎓 *مَرْحَبًا بِكَ فِي Content Maker Bot!*\n\nTanlang:`,
                    parse_mode: "Markdown",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          { text: "➕ Yangi test yaratish", callback_data: "select_topic" },
                        ],
                        [
                          { text: "📋 Testlar ro'yxati", callback_data: "view_tests" },
                        ],
                      ],
                    },
                  }),
                }
              );

              logger?.info("✅ [Telegram Admin] Menu sent to admin");
            }
            
            return c.json({ ok: true });
          }

          // Unknown payload type - ignore (polls, channel posts, etc.)
          return c.json({ ok: true });
          
        } catch (error: any) {
          logger?.error("❌ [Telegram Admin] Webhook handler error", {
            error: error?.message,
            stack: error?.stack,
          });
          return c.json({ ok: false, error: error?.message }, 500);
        }
      },
    }),
  ];
}
