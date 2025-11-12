import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

/**
 * Questions Generator Tool
 * 
 * Content matni asosida 5 dona multiple choice savol yaratadi
 */
export const generateQuestions = createTool({
  id: "generate-questions",

  description:
    "Generates 5 multiple choice questions based on content to test comprehension. Uses synonyms appropriate to the level.",

  inputSchema: z.object({
    podcastContent: z.string().describe("Content text"),
    podcastTitle: z.string().describe("Content title for context"),
    level: z.enum(["A1", "A2", "B1", "B2"]).describe("Content level for appropriate synonym usage"),
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
      title: context.podcastTitle,
      level: context.level,
      contentLength: context.podcastContent.length,
    });

    try {
      // Synonym guidance based on level
      const synonymGuidance = {
        A1: "استخدم نفس الكلمات من النص أو مرادفات بسيطة جداً",
        A2: "استخدم مرادفات بسيطة ومألوفة",
        B1: "استخدم مرادفات متوسطة التعقيد",
        B2: "استخدم مرادفات متقدمة ومعقدة ومهنية"
      };

      const prompt = `أنت خبير في إنشاء اختبارات تعليمية عربية.

النص المطلوب إنشاء أسئلة له:
---
${context.podcastContent}
---

المستوى: ${context.level}

المطلوب: أنشئ **بالضبط 5 أسئلة اختيار من متعدد** لهذا النص.

قواعد مهمة:
1. **عدد الأسئلة:** 5 أسئلة بالضبط - لا أكثر ولا أقل
2. **المرادفات:** ${synonymGuidance[context.level as keyof typeof synonymGuidance]}
3. **الخيارات:** كل سؤال له 4 خيارات (A, B, C, D)
4. **الإجابات المضللة:** اجعل الخيارات الخاطئة معقولة ومتنوعة (ليست واضحة أنها خاطئة)
5. **تنويع الإجابات الصحيحة:** الإجابات الصحيحة يجب أن تكون متنوعة:
   - مثلاً: السؤال 1 (A)، السؤال 2 (C)، السؤال 3 (B)، السؤال 4 (D)، السؤال 5 (A)
   - أو: السؤال 1 (D)، السؤال 2 (B)، السؤال 3 (A)، السؤال 4 (C)، السؤال 5 (B)
   - لا تجعل كل الإجابات A أو B فقط
6. **الشرح:** شرح مختصر لكل إجابة صحيحة

صيغة الرد (JSON):
{
  "questions": [
    {
      "question": "نص السؤال؟",
      "options": ["الخيار A", "الخيار B", "الخيار C", "الخيار D"],
      "correctAnswer": 0,
      "explanation": "الشرح"
    },
    // ... 4 أسئلة أخرى (المجموع 5)
  ]
}

ملاحظة: correctAnswer هو رقم الفهرس (0 للخيار A، 1 للخيار B، 2 للخيار C، 3 للخيار D)`;

      logger?.info("🤖 [generateQuestions] Calling AI to generate questions");

      const result = await generateText({
        model: openai.responses("gpt-5"),
        prompt,
        temperature: 0.7,
      });

      logger?.info("📥 [generateQuestions] AI response received", {
        responseLength: result.text.length,
      });

      // Parse JSON from AI response
      let parsedResponse;
      try {
        // Try to find JSON in the response
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          parsedResponse = JSON.parse(result.text);
        }
      } catch (parseError) {
        logger?.error("❌ [generateQuestions] Failed to parse AI response as JSON", {
          error: parseError,
          response: result.text.substring(0, 500),
        });
        throw new Error("Failed to parse AI response");
      }

      const questions = parsedResponse.questions || [];

      // Validate we have exactly 5 questions
      if (questions.length !== 5) {
        logger?.warn("⚠️ [generateQuestions] Expected 5 questions but got " + questions.length);
      }

      logger?.info("✅ [generateQuestions] Questions generated successfully", {
        count: questions.length,
        correctAnswers: questions.map((q: any) => q.correctAnswer),
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
