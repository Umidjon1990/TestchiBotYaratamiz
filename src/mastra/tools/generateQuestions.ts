import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Questions Generator Tool
 * 
 * Podcast matni asosida 3 dona multiple choice savol yaratadi
 */
export const generateQuestions = createTool({
  id: "generate-questions",

  description:
    "Generates 3 multiple choice questions based on podcast content to test comprehension.",

  inputSchema: z.object({
    podcastContent: z.string().describe("Podcast text content"),
    podcastTitle: z.string().describe("Podcast title for context"),
  }),

  outputSchema: z.object({
    questions: z.array(
      z.object({
        question: z.string().describe("Question text"),
        options: z.array(z.string()).describe("4 answer options (A, B, C, D)"),
        correctAnswer: z
          .number()
          .describe("Index of correct answer (0-3)"),
        explanation: z.string().describe("Brief explanation in Arabic"),
      })
    ),
    totalQuestions: z.number().describe("Total number of questions generated"),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("❓ [generateQuestions] Starting question generation", {
      podcastTitle: context.podcastTitle,
      contentLength: context.podcastContent.length,
    });

    try {
      // في التطبيق الحقيقي يجب استخدام AI integration (OpenAI)
      // للتوضيح نستخدم أسئلة ثابتة
      // في التطبيق الفعلي يتم إنشاء أسئلة ديناميكية باستخدام GPT

      const questions = [
        {
          question: "ما هو موضوع البودكاست؟",
          options: [
            "الرياضة والصحة",
            "الذكاء الاصطناعي والتعليم",
            "التاريخ والثقافة",
            "الاقتصاد والأعمال",
          ],
          correctAnswer: 1,
          explanation:
            "البودكاست يناقش الأخبار في مجال الذكاء الاصطناعي والتعليم.",
        },
        {
          question: "ما هي الميزة الأساسية للذكاء الاصطناعي في التعليم؟",
          options: [
            "فقط ينشئ الاختبارات",
            "يستبدل المعلمين",
            "نهج فردي لكل طالب",
            "يستخدم فقط لتعلم اللغات",
          ],
          correctAnswer: 2,
          explanation:
            "الذكاء الاصطناعي يمكنه تقديم تعليم شخصي حسب احتياجات كل طالب.",
        },
        {
          question: "ما هو الأهم حسب البودكاست؟",
          options: [
            "امتلاك أحدث التقنيات",
            "إنفاق الكثير من المال",
            "الشغف بالمعرفة والاجتهاد",
            "استخدام الذكاء الاصطناعي فقط",
          ],
          correctAnswer: 2,
          explanation:
            "التكنولوجيا مجرد وسيلة، الأهم هو الشغف بالتعلم والاجتهاد.",
        },
      ];

      logger?.info("✅ [generateQuestions] Questions generated successfully", {
        count: questions.length,
      });

      return {
        questions,
        totalQuestions: questions.length,
      };
    } catch (error) {
      logger?.error("❌ [generateQuestions] Error generating questions", {
        error,
      });
      throw error;
    }
  },
});
