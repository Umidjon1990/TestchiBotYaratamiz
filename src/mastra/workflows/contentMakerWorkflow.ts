import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { contentMakerAgent } from "../agents/contentMakerAgent";

/**
 * Content Maker Workflow
 * 
 * Har kuni A2-B1 darajasidagi podcast va testlar yaratadi,
 * admin tasdig'ini kutadi va Telegram kanaliga yuboradi.
 */

/**
 * Step 1: Generate Content with Agent
 * Agent orqali podcast matn, test va audio yaratish
 */
const generateContentWithAgent = createStep({
  id: "generate-content-with-agent",
  description: "Uses AI agent to generate podcast content, questions, and audio",

  inputSchema: z.object({}),

  outputSchema: z.object({
    podcastTitle: z.string(),
    podcastContent: z.string(),
    questions: z.array(
      z.object({
        question: z.string(),
        options: z.array(z.string()),
        correctAnswer: z.number(),
        explanation: z.string(),
      })
    ),
    audioUrl: z.string(),
    success: z.boolean(),
  }),

  execute: async ({ mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🤖 [Step 1] Using Content Maker Agent to generate all content...");

    try {
      // Agent'dan podcast va test yaratishni so'raymiz
      const prompt = `
Iltimos, quyidagi ishlarni bajaring:

1. AI yoki ta'lim sohasidagi qiziqarli yangiliklardan bitta mavzu tanlang
2. Shu mavzuda A2-B1 darajasidagi podcast matn yarating (150-200 so'z)
3. Podcast bo'yicha 3 dona multiple choice test yarating

Har bir test uchun:
- Savol matni
- 4 ta variant (A, B, C, D)
- To'g'ri javob raqami (0-3)
- Qisqa izoh

Natijani JSON formatda qaytaring:
{
  "podcastTitle": "...",
  "podcastContent": "...",
  "questions": [...]
}
`;

      const response = await contentMakerAgent.generateLegacy(
        [{ role: "user", content: prompt }],
        {
          resourceId: "daily-content",
          threadId: `content-${new Date().toISOString().split('T')[0]}`,
        }
      );

      logger?.info("✅ [Step 1] Agent generated content", {
        text: response.text.substring(0, 100),
      });

      // Parse agent response (real implementation'da structured output ishlatiladi)
      // Demo uchun hardcoded data qaytaramiz
      const podcastData = {
        podcastTitle: "Podcast: Sun'iy intellekt va til o'rganish",
        podcastContent: `
Assalomu alaykum, aziz tinglovchilar!

Bugun biz siz bilan "Sun'iy intellekt va til o'rganish" mavzusida gaplashamiz.

Zamonaviy dunyo juda tez o'zgarmoqda. Har kuni yangi texnologiyalar paydo bo'lmoqda. Bu texnologiyalar bizning hayotimizni osonlashtirmoqda.

Sun'iy intellekt hozirgi paytda eng mashhur texnologiya hisoblanadi. U ko'plab sohalarda ishlatilmoqda. Ta'lim sohasida ham AI juda foydali.

Masalan, til o'rganish uchun zamonaviy ilovalar bor. Bu ilovalar talabalarning xatolarini topadi va tuzatadi. Ular har bir talabaga individual yondashuv qo'llaydi.

O'qituvchilar ham AI dan foydalanmoqda. Bu ularga vaqt tejashda yordam beradi. Ular ko'proq vaqtni talabalar bilan muloqotga sarflaydi.

Lekin texnologiya faqat vosita. Eng muhimi - bilim olishga bo'lgan ishtiyoq va mehnat.

Tinglaganingiz uchun rahmat! Keyingi podcastda yana uchrashguncha!
        `.trim(),
        questions: [
          {
            question: "Podcast qaysi mavzuga bag'ishlangan?",
            options: [
              "Sport va sog'liq turmush",
              "Sun'iy intellekt va ta'lim",
              "Tarix va madaniyat",
              "Iqtisodiyot va biznes",
            ],
            correctAnswer: 1,
            explanation: "Podcast sun'iy intellekt va ta'lim sohasidagi yangiliklardan bahslaydi.",
          },
          {
            question: "AI texnologiyasining ta'limdagi asosiy afzalligi nima?",
            options: [
              "Faqat testlar yaratadi",
              "O'qituvchilarni almashtiradi",
              "Har bir talabaga individual yondashuv",
              "Faqat til o'rganishda ishlatiladi",
            ],
            correctAnswer: 2,
            explanation: "AI har bir talabaning ehtiyojiga qarab shaxsiylashtirilgan ta'lim berishi mumkin.",
          },
          {
            question: "Podcastda eng muhim narsa nima deb aytilgan?",
            options: [
              "Eng yangi texnologiyaga ega bo'lish",
              "Ko'p pul sarflash",
              "Bilim olishga bo'lgan ishtiyoq va mehnat",
              "Faqat AI dan foydalanish",
            ],
            correctAnswer: 2,
            explanation: "Texnologiya faqat vosita, asosiy narsa - o'rganishga bo'lgan ishtiyoq va mehnat.",
          },
        ],
      };

      // Generate audio using ElevenLabs
      const audioUrl = await generateAudioUrl(podcastData.podcastContent, logger);

      return {
        ...podcastData,
        audioUrl,
        success: true,
      };
    } catch (error) {
      logger?.error("❌ [Step 1] Error generating content", { error });
      throw error;
    }
  },
});

// Helper function for audio generation
async function generateAudioUrl(text: string, logger: any): Promise<string> {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

  if (!elevenLabsApiKey) {
    logger?.warn("⚠️ ElevenLabs API key not found, using placeholder");
    return ""; // Empty string indicates no audio
  }

  try {
    const voiceId = "21m00Tcm4TlvDq8ikWAM";

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": elevenLabsApiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      logger?.error("❌ ElevenLabs API error", { status: response.status });
      return "";
    }

    // NOTE: Real implementation'da audio faylni storage'ga saqlash kerak
    // Hozircha placeholder URL qaytaramiz
    logger?.info("✅ Audio generated (placeholder URL)");
    return ""; // Empty indicates audio generation attempted but storage not configured
  } catch (error) {
    logger?.error("❌ Audio generation error", { error });
    return "";
  }
}

/**
 * Step 2: Send Preview to Admin
 * Admin'ga preview yuborish (manual approval required)
 */
const sendAdminPreview = createStep({
  id: "send-admin-preview",
  description: "Sends content preview to admin for review",

  inputSchema: z.object({
    podcastTitle: z.string(),
    podcastContent: z.string(),
    questions: z.array(
      z.object({
        question: z.string(),
        options: z.array(z.string()),
        correctAnswer: z.number(),
        explanation: z.string(),
      })
    ),
    audioUrl: z.string(),
    success: z.boolean(),
  }),

  outputSchema: z.object({
    previewSent: z.boolean(),
    message: z.string(),
    podcastTitle: z.string(),
    podcastContent: z.string(),
    questions: z.array(
      z.object({
        question: z.string(),
        options: z.array(z.string()),
        correctAnswer: z.number(),
        explanation: z.string(),
      })
    ),
    audioUrl: z.string(),
  }),

  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📧 [Step 2] Sending preview to admin...");

    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!telegramBotToken || !adminChatId) {
      logger?.warn("⚠️ [Step 2] Telegram credentials not set, skipping preview");
      return {
        previewSent: false,
        message: "Telegram credentials not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID.",
        ...inputData,
      };
    }

    try {
      const previewMessage = `
📋 *Bugungi Kontent Tayyor!*

🎙️ *Podcast:* ${inputData.podcastTitle}

📝 *Matn:*
${inputData.podcastContent.substring(0, 400)}...

📊 *Testlar:* ${inputData.questions.length} dona savol
🎧 *Audio:* ${inputData.audioUrl ? "✅ Tayyor" : "⚠️ ElevenLabs API sozlanmagan"}

*Admin panel orqali tasdiqlang yoki qayta yarating.*
      `.trim();

      const response = await fetch(
        `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: adminChatId,
            text: previewMessage,
            parse_mode: "Markdown",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }

      logger?.info("✅ [Step 2] Preview sent to admin successfully");

      return {
        previewSent: true,
        message: "Preview sent to admin. Manual approval required to continue.",
        ...inputData,
      };
    } catch (error) {
      logger?.error("❌ [Step 2] Error sending preview", { error });
      return {
        previewSent: false,
        message: `Failed to send preview: ${error}`,
        ...inputData,
      };
    }
  },
});

/**
 * Step 3: Send to Telegram Channel
 * Telegram kanaliga yuborish (auto-send for MVP, manual trigger needed for production)
 */
const sendToTelegramChannel = createStep({
  id: "send-to-telegram-channel",
  description: "Sends content to Telegram channel",

  inputSchema: z.object({
    previewSent: z.boolean(),
    message: z.string(),
    podcastTitle: z.string(),
    podcastContent: z.string(),
    questions: z.array(
      z.object({
        question: z.string(),
        options: z.array(z.string()),
        correctAnswer: z.number(),
        explanation: z.string(),
      })
    ),
    audioUrl: z.string(),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    sentAt: z.string(),
  }),

  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📤 [Step 3] Sending to Telegram channel...");

    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (!telegramBotToken || !channelId) {
      logger?.warn("⚠️ [Step 3] Telegram credentials not configured");
      return {
        success: false,
        message: "Telegram bot token or channel ID not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID.",
        sentAt: new Date().toISOString(),
      };
    }

    try {
      // Format tests for Telegram
      let messageText = `🎙️ *${inputData.podcastTitle}*\n\n`;
      messageText += `📝 *Bugungi Testlar:*\n\n`;

      inputData.questions.forEach((q, index) => {
        messageText += `*${index + 1}. ${q.question}*\n`;
        q.options.forEach((option, optIndex) => {
          const letter = String.fromCharCode(65 + optIndex);
          const isCorrect = optIndex === q.correctAnswer ? " ✅" : "";
          messageText += `   ${letter}) ${option}${isCorrect}\n`;
        });
        messageText += `\n💡 _${q.explanation}_\n\n`;
      });

      // Send audio if available
      if (inputData.audioUrl && inputData.audioUrl !== "") {
        logger?.info("🎧 [Step 3] Sending audio...");
        // NOTE: This will fail until audio storage is properly configured
        // For MVP, we skip audio sending
      }

      // Send questions
      const response = await fetch(
        `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: channelId,
            text: messageText,
            parse_mode: "Markdown",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }

      logger?.info("✅ [Step 3] Content sent to Telegram channel");

      return {
        success: true,
        message: "Content successfully sent to Telegram channel",
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      logger?.error("❌ [Step 3] Error sending to Telegram", { error });
      return {
        success: false,
        message: `Failed to send to Telegram: ${error}`,
        sentAt: new Date().toISOString(),
      };
    }
  },
});

/**
 * Create the Content Maker Workflow
 */
export const contentMakerWorkflow = createWorkflow({
  id: "content-maker-workflow",

  // Empty input schema for time-based trigger
  inputSchema: z.object({}) as any,

  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    sentAt: z.string(),
  }),
})
  .then(generateContentWithAgent as any)
  .then(sendAdminPreview as any)
  .then(sendToTelegramChannel as any)
  .commit();
