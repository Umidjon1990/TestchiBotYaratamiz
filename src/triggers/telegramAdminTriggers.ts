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
                        { text: "A1", callback_data: `level_${contentType}_A1` },
                        { text: "A2", callback_data: `level_${contentType}_A2` },
                      ],
                      [
                        { text: "B1", callback_data: `level_${contentType}_B1` },
                        { text: "B2", callback_data: `level_${contentType}_B2` },
                      ],
                      [
                        { text: "◀️ Orqaga", callback_data: "view_tests" },
                      ],
                    ],
                  },
                }),
              }
            );

          } else if (callbackData.startsWith("level_")) {
            // Show test list for specific category and level
            const [_, contentType, level] = callbackData.split("_"); // e.g., "level_listening_A2"
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
                          { text: "◀️ Orqaga", callback_data: `level_${test.contentType}_${test.level}` },
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
                  text: `🎓 *مَرْحَبًا بِكَ فِي Content Maker Bot!*\n\nاخْتَرْ نَوْعَ المُحْتَوَى وَالمُسْتَوَى:`,
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "🎧 Tinglash - A1", callback_data: "create_listening_A1" },
                        { text: "🎧 Tinglash - A2", callback_data: "create_listening_A2" },
                      ],
                      [
                        { text: "🎧 Tinglash - B1", callback_data: "create_listening_B1" },
                        { text: "🎧 Tinglash - B2", callback_data: "create_listening_B2" },
                      ],
                      [
                        { text: "📖 O'qish - A1", callback_data: "create_reading_A1" },
                        { text: "📖 O'qish - A2", callback_data: "create_reading_A2" },
                      ],
                      [
                        { text: "📖 O'qish - B1", callback_data: "create_reading_B1" },
                        { text: "📖 O'qish - B2", callback_data: "create_reading_B2" },
                      ],
                      [
                        { text: "📋 Testlar ro'yxati", callback_data: "view_tests" },
                      ],
                    ],
                  },
                }),
              }
            );

          } else if (callbackData.startsWith("create_")) {
            // Menu button - create new content
            const [_, contentType, level] = callbackData.split("_"); // e.g., "create_listening_A2"
            logger?.info("🎯 [Telegram Admin] Create content", { contentType, level });

            // CRITICAL: Answer callback query IMMEDIATELY to prevent Telegram from retrying
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
                  text: `⏳ جَارٍ إِنْشَاءُ ${contentType} - ${level}...\n\nيُرْجَى الِانْتِظَارُ، سَتَتَلَقَّى مُعَايَنَةً قَرِيبًا...`,
                  parse_mode: "Markdown",
                }),
              }
            );

            // Trigger workflow with manual parameters (async, no await)
            logger?.info("🚀 [Telegram Admin] Triggering content creation workflow...", {
              contentType,
              level,
            });
            
            // Run workflow in background without blocking response
            (async () => {
              try {
                const { contentMakerWorkflow } = await import("../mastra/workflows/contentMakerWorkflow");
                
                // Trigger workflow directly with manual parameters
                const run = await contentMakerWorkflow.createRunAsync();
                const result = await run.start({
                  inputData: {
                    contentType,
                    level,
                  },
                });
                
                logger?.info("✅ [Telegram Admin] Workflow triggered successfully", {
                  status: result?.status,
                });
              } catch (triggerError: any) {
                logger?.error("❌ [Telegram Admin] Failed to trigger workflow", {
                  error: triggerError?.message,
                  stack: triggerError?.stack,
                });
                
                // Send error to admin
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
            
            // Ignore non-text messages (polls, media, etc.)
            if (!message.text) {
              return c.json({ ok: true });
            }

            const chatId = message.chat.id;
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
                    text: `🎓 *مَرْحَبًا بِكَ فِي Content Maker Bot!*\n\nاخْتَرْ نَوْعَ المُحْتَوَى وَالمُسْتَوَى:`,
                    parse_mode: "Markdown",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          { text: "🎧 Tinglash - A1", callback_data: "create_listening_A1" },
                          { text: "🎧 Tinglash - A2", callback_data: "create_listening_A2" },
                        ],
                        [
                          { text: "🎧 Tinglash - B1", callback_data: "create_listening_B1" },
                          { text: "🎧 Tinglash - B2", callback_data: "create_listening_B2" },
                        ],
                        [
                          { text: "📖 O'qish - A1", callback_data: "create_reading_A1" },
                          { text: "📖 O'qish - A2", callback_data: "create_reading_A2" },
                        ],
                        [
                          { text: "📖 O'qish - B1", callback_data: "create_reading_B1" },
                          { text: "📖 O'qish - B2", callback_data: "create_reading_B2" },
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
