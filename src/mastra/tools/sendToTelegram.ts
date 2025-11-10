import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Telegram Sender Tool
 * 
 * Telegram kanaliga audio va testlarni yuboradi
 */
export const sendToTelegram = createTool({
  id: "send-to-telegram",

  description:
    "Sends podcast audio and questions to Telegram channel after admin approval.",

  inputSchema: z.object({
    channelId: z.string().describe("Telegram channel ID or username"),
    audioUrl: z.string().describe("URL to podcast audio file"),
    podcastTitle: z.string().describe("Podcast title"),
    questions: z
      .array(
        z.object({
          question: z.string(),
          options: z.array(z.string()),
          correctAnswer: z.number(),
          explanation: z.string(),
        })
      )
      .describe("List of quiz questions"),
    scheduledTime: z
      .string()
      .optional()
      .describe("Optional scheduled time to send (ISO format)"),
  }),

  outputSchema: z.object({
    success: z.boolean().describe("Whether message was sent successfully"),
    messageId: z.number().optional().describe("Telegram message ID if sent"),
    scheduledFor: z
      .string()
      .optional()
      .describe("Scheduled time if message was scheduled"),
    message: z.string().describe("Status message"),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📤 [sendToTelegram] Starting Telegram send", {
      channelId: context.channelId,
      podcastTitle: context.podcastTitle,
      questionsCount: context.questions.length,
    });

    try {
      const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

      if (!telegramBotToken) {
        logger?.warn(
          "⚠️ [sendToTelegram] Telegram bot token not found, returning mock response"
        );
        return {
          success: false,
          message:
            "Telegram bot token not configured. Please set TELEGRAM_BOT_TOKEN environment variable.",
        };
      }

      // Format savollarni Telegram uchun
      let messageText = `🎙️ *${context.podcastTitle}*\n\n`;
      messageText += `📝 *Testlar:*\n\n`;

      context.questions.forEach((q, index) => {
        messageText += `*${index + 1}. ${q.question}*\n`;
        q.options.forEach((option, optIndex) => {
          const letter = String.fromCharCode(65 + optIndex); // A, B, C, D
          const isCorrect = optIndex === q.correctAnswer ? "✅" : "";
          messageText += `   ${letter}) ${option} ${isCorrect}\n`;
        });
        messageText += `\n💡 _${q.explanation}_\n\n`;
      });

      logger?.info("📡 [sendToTelegram] Sending to Telegram API");

      // Audio faylni yuborish
      const audioResponse = await fetch(
        `https://api.telegram.org/bot${telegramBotToken}/sendAudio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: context.channelId,
            audio: context.audioUrl,
            caption: `🎙️ ${context.podcastTitle}`,
            parse_mode: "Markdown",
          }),
        }
      );

      if (!audioResponse.ok) {
        const errorText = await audioResponse.text();
        logger?.error("❌ [sendToTelegram] Failed to send audio", {
          error: errorText,
        });
        throw new Error(`Telegram API error: ${errorText}`);
      }

      // Testlarni alohida xabar sifatida yuborish
      const messageResponse = await fetch(
        `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: context.channelId,
            text: messageText,
            parse_mode: "Markdown",
          }),
        }
      );

      if (!messageResponse.ok) {
        const errorText = await messageResponse.text();
        logger?.error("❌ [sendToTelegram] Failed to send message", {
          error: errorText,
        });
        throw new Error(`Telegram API error: ${errorText}`);
      }

      const messageData = await messageResponse.json();

      logger?.info("✅ [sendToTelegram] Successfully sent to Telegram", {
        messageId: messageData.result?.message_id,
      });

      return {
        success: true,
        messageId: messageData.result?.message_id,
        message: "Content successfully sent to Telegram channel",
      };
    } catch (error) {
      logger?.error("❌ [sendToTelegram] Error sending to Telegram", {
        error,
      });

      return {
        success: false,
        message: `Failed to send to Telegram: ${error}`,
      };
    }
  },
});
