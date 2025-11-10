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
                  audioFilename: demoData.audioUrl || "",
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

          } else if (callbackData.startsWith("create_")) {
            // Menu button - create new content
            const [_, contentType, level] = callbackData.split("_"); // e.g., "create_listening_A2"
            logger?.info("🎯 [Telegram Admin] Create content", { contentType, level });

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

            // Trigger workflow with manual parameters
            logger?.info("🚀 [Telegram Admin] Triggering content creation workflow...", {
              contentType,
              level,
            });
            
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
              
              // Send confirmation to admin
              await fetch(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `✅ تَمَّ! يُنْشَأُ ${contentType} - ${level}\n\nسَتَتَلَقَّى مُعَايَنَةً قَرِيبًا...`,
                    parse_mode: "Markdown",
                  }),
                }
              );
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
                    text: `❌ خَطَأٌ: ${triggerError?.message}`,
                  }),
                }
              );
            }
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
