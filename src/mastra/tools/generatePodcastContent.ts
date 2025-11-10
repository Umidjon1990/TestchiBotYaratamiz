import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Podcast Content Generator Tool
 * 
 * A2-B1 darajasidagi AI va ta'lim sohasidagi yangiliklardan
 * qiziqarli podcast matn yaratadi
 */
export const generatePodcastContent = createTool({
  id: "generate-podcast-content",

  description:
    "Generates A2-B1 level podcast content about AI and education news. Creates engaging content suitable for language learners.",

  inputSchema: z.object({
    topic: z
      .string()
      .optional()
      .describe("Optional specific topic, otherwise random AI/education news"),
    targetLevel: z
      .string()
      .optional()
      .default("A2-B1")
      .describe("Language proficiency level (default: A2-B1)"),
  }),

  outputSchema: z.object({
    title: z.string().describe("Podcast title"),
    content: z.string().describe("Podcast text content in Uzbek"),
    topic: z.string().describe("Topic covered"),
    wordCount: z.number().describe("Number of words in content"),
    timestamp: z.string().describe("Generation timestamp"),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🎙️ [generatePodcastContent] Starting podcast generation", {
      topic: context.topic,
      targetLevel: context.targetLevel,
    });

    try {
      // AI va ta'lim sohasidagi mavzular ro'yxati
      const topics = [
        "Sun'iy intellekt va til o'rganish",
        "ChatGPT va ta'limda yangi imkoniyatlar",
        "Onlayn ta'lim platformalari rivojlanishi",
        "AI yordamchi o'qituvchilar",
        "Zamonaviy texnologiyalar maktablarda",
        "Til o'rganishda mobil ilovalar",
        "Virtual reallik va ta'lim",
        "AI orqali shaxsiylashtirilgan ta'lim",
        "Kelajakda ta'lim qanday bo'ladi",
        "Texnologiya va o'qituvchilar roli",
      ];

      // Random mavzu tanlash yoki berilgan mavzudan foydalanish
      const selectedTopic =
        context.topic || topics[Math.floor(Math.random() * topics.length)];

      logger?.info("📝 [generatePodcastContent] Topic selected", {
        topic: selectedTopic,
      });

      // A2-B1 darajasidagi oddiy va tushunarli matn yaratish
      // Bu yerda real AI integration bo'lishi kerak, lekin demo uchun template ishlatamiz
      const podcastContent = `
Assalomu alaykum, aziz tinglovchilar!

Bugun biz siz bilan "${selectedTopic}" mavzusida gaplashamiz.

Zamonaviy dunyo juda tez o'zgarmoqda. Har kuni yangi texnologiyalar paydo bo'lmoqda. Bu texnologiyalar bizning hayotimizni osonlashtirmoqda.

Sun'iy intellekt hozirgi paytda eng mashhur texnologiya hisoblanadi. U ko'plab sohalarda ishlatilmoqda. Ta'lim sohasida ham AI juda foydali.

Masalan, til o'rganish uchun zamonaviy ilovalar bor. Bu ilovalar talabalarning xatolarini topadi va tuzatadi. Ular har bir talabaga individual yondashuv qo'llaydi.

O'qituvchilar ham AI dan foydalanmoqda. Bu ularga vaqt tejashda yordam beradi. Ular ko'proq vaqtni talabalar bilan muloqotga sarflaydi.

Lekin texnologiya faqat vosita. Eng muhimi - bilim olishga bo'lgan ishtiyoq va mehnat.

Tinglaganingiz uchun rahmat! Keyingi podcastda yana uchrashguncha!
`;

      const wordCount = podcastContent
        .split(/\s+/)
        .filter((w) => w.length > 0).length;

      logger?.info("✅ [generatePodcastContent] Content generated successfully", {
        wordCount,
      });

      return {
        title: `Podcast: ${selectedTopic}`,
        content: podcastContent.trim(),
        topic: selectedTopic,
        wordCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger?.error("❌ [generatePodcastContent] Error generating content", {
        error,
      });
      throw error;
    }
  },
});
