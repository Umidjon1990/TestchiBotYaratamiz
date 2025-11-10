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
        explanation: z.string().describe("Brief explanation in Uzbek"),
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
      // Bu yerda real AI integration bo'lishi kerak (OpenAI)
      // Demo uchun hardcoded questions ishlatamiz
      // Real implementation'da GPT dan foydalanib dinamik savollar yaratiladi

      const questions = [
        {
          question: "Podcast qaysi mavzuga bag'ishlangan?",
          options: [
            "Sport va sog'liq turmush",
            "Sun'iy intellekt va ta'lim",
            "Tarix va madaniyat",
            "Iqtisodiyot va biznes",
          ],
          correctAnswer: 1,
          explanation:
            "Podcast sun'iy intellekt va ta'lim sohasidagi yangiliklardan bahslaydi.",
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
          explanation:
            "AI har bir talabaning ehtiyojiga qarab shaxsiylashtirilgan ta'lim berishi mumkin.",
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
          explanation:
            "Texnologiya faqat vosita, asosiy narsa - o'rganishga bo'lgan ishtiyoq va mehnat.",
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
