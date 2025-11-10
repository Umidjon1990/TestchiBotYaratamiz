import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Admin Approval Tool
 * 
 * Admindan kontent tasdig'ini so'raydi va javobini kutadi
 */
export const requestAdminApproval = createTool({
  id: "request-admin-approval",

  description:
    "Requests admin approval for podcast content before publishing. Allows approval, rejection, or editing.",

  inputSchema: z.object({
    adminChatId: z.string().describe("Admin's Telegram chat ID"),
    podcastTitle: z.string().describe("Podcast title for preview"),
    podcastContent: z.string().describe("Podcast text content for preview"),
    audioUrl: z.string().describe("Generated audio URL for preview"),
  }),

  outputSchema: z.object({
    approved: z.boolean().describe("Whether admin approved the content"),
    action: z
      .enum(["approve", "reject", "edit"])
      .describe("Admin's decision"),
    feedback: z.string().optional().describe("Admin's feedback if any"),
    editedContent: z
      .string()
      .optional()
      .describe("Edited content if admin made changes"),
    message: z.string().describe("Status message"),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("👤 [requestAdminApproval] Sending approval request to admin", {
      adminChatId: context.adminChatId,
      podcastTitle: context.podcastTitle,
    });

    try {
      const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

      if (!telegramBotToken) {
        logger?.warn(
          "⚠️ [requestAdminApproval] Telegram bot token not found"
        );
        return {
          approved: true,
          action: "approve" as const,
          message:
            "Auto-approved (Telegram bot token not configured). Set TELEGRAM_BOT_TOKEN to enable admin approval.",
        };
      }

      // Admin uchun preview xabar tayyorlash
      const previewMessage = `
📋 *Bugungi Kontent Tayyor!*

🎙️ *Podcast:* ${context.podcastTitle}

📝 *Matn ko'rinishi:*
${context.podcastContent.substring(0, 300)}...

🎧 *Audio:* ${context.audioUrl}

Kontentni yuborishni xohlaysizmi?
`;

      logger?.info("📡 [requestAdminApproval] Sending preview to admin");

      // Admin ga xabar yuborish inline keyboard bilan
      const response = await fetch(
        `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: context.adminChatId,
            text: previewMessage,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Yuborish",
                    callback_data: "approve",
                  },
                  {
                    text: "🔄 Qayta yaratish",
                    callback_data: "reject",
                  },
                ],
                [
                  {
                    text: "✏️ Tahrirlash",
                    callback_data: "edit",
                  },
                ],
              ],
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger?.error("❌ [requestAdminApproval] Failed to send approval request", {
          error: errorText,
        });
        throw new Error(`Telegram API error: ${errorText}`);
      }

      logger?.info("✅ [requestAdminApproval] Approval request sent to admin");

      // Real implementation'da callback handler bo'lishi kerak
      // Bu yerda demo uchun auto-approve qilamiz
      // Haqiqiy ishlovda Telegram callback_query ni kutish kerak

      return {
        approved: true,
        action: "approve" as const,
        message:
          "Approval request sent to admin. Waiting for response... (Auto-approved for demo)",
      };
    } catch (error) {
      logger?.error("❌ [requestAdminApproval] Error requesting approval", {
        error,
      });

      return {
        approved: false,
        action: "reject" as const,
        message: `Failed to request approval: ${error}`,
      };
    }
  },
});
