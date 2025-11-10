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
    content: z.string().describe("Podcast text content in Arabic"),
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
      // مواضيع في مجال الذكاء الاصطناعي والتعليم
      const topics = [
        "الذكاء الاصطناعي وتعلم اللغات",
        "ChatGPT وفرص جديدة في التعليم",
        "تطور منصات التعليم عبر الإنترنت",
        "المعلمون المساعدون بالذكاء الاصطناعي",
        "التكنولوجيا الحديثة في المدارس",
        "تطبيقات الهاتف لتعلم اللغات",
        "الواقع الافتراضي والتعليم",
        "التعليم الشخصي عبر الذكاء الاصطناعي",
        "كيف سيكون التعليم في المستقبل",
        "التكنولوجيا ودور المعلمين",
      ];

      // اختيار موضوع عشوائي أو استخدام الموضوع المقدم
      const selectedTopic =
        context.topic || topics[Math.floor(Math.random() * topics.length)];

      logger?.info("📝 [generatePodcastContent] Topic selected", {
        topic: selectedTopic,
      });

      // إنشاء نص بسيط ومفهوم بمستوى A2-B1
      // في التطبيق الحقيقي، يجب استخدام AI integration
      const podcastContent = `
السلام عليكم، أعزائي المستمعين!

اليوم سنتحدث معكم عن موضوع "${selectedTopic}".

العالم الحديث يتغير بسرعة كبيرة. كل يوم تظهر تقنيات جديدة. هذه التقنيات تسهل حياتنا.

الذكاء الاصطناعي يعتبر الآن أكثر التقنيات شهرة. يستخدم في مجالات كثيرة. في مجال التعليم أيضاً، الذكاء الاصطناعي مفيد جداً.

على سبيل المثال، توجد تطبيقات حديثة لتعلم اللغات. هذه التطبيقات تجد أخطاء الطلاب وتصححها. تستخدم نهجاً فردياً لكل طالب.

المعلمون أيضاً يستخدمون الذكاء الاصطناعي. هذا يساعدهم في توفير الوقت. يقضون وقتاً أكثر في التواصل مع الطلاب.

لكن التكنولوجيا هي مجرد وسيلة. الأهم هو الشغف بالمعرفة والاجتهاد.

شكراً لاستماعكم! نلتقي في البودكاست القادم!
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
