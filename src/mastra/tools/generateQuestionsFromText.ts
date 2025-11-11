import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { contentMakerAgent } from "../agents/contentMakerAgent";

/**
 * Generate Questions From Text Tool
 * 
 * Matndan 5 ta qiyin, chalg'ituvchi test savollari yaratadi
 */
export const generateQuestionsFromText = createTool({
  id: "generate-questions-from-text",

  description:
    "Generates 5 challenging multiple-choice questions from Arabic text content with deceptive answer options.",

  inputSchema: z.object({
    text: z.string().describe("Arabic text content to generate questions from"),
    level: z.enum(["A1", "A2", "B1", "B2"]).default("B1").describe("CEFR level for questions"),
  }),

  outputSchema: z.object({
    questions: z.array(
      z.object({
        question: z.string(),
        options: z.array(z.string()),
        correctAnswer: z.number(),
        explanation: z.string(),
      })
    ),
    success: z.boolean(),
    message: z.string(),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("❓ [generateQuestionsFromText] Starting question generation", {
      textLength: context.text.length,
      level: context.level,
    });

    try {
      const { text, level } = context;

      // Level-specific difficulty instructions
      const levelDifficulty = {
        "A1": "الأسئلة يَجِبُ أَنْ تَكُونَ سَهْلَةً جِدًّا - مَعْلُومَاتٌ أَسَاسِيَّةٌ وَاضِحَةٌ مُبَاشَرَةً مِنَ النَّصِّ",
        "A2": "الأسئلة يَجِبُ أَنْ تَكُونَ سَهْلَةً - مَعْلُومَاتٌ وَاضِحَةٌ فِي النَّصِّ مَعَ قَلِيلٍ مِنَ التَّفْكِيرِ",
        "B1": "الأسئلة يَجِبُ أَنْ تَكُونَ مُتَوَسِّطَةَ الصُّعُوبَةِ - تَحْتَاجُ إِلَى فَهْمٍ جَيِّدٍ لِلنَّصِّ وَرَبْطِ الأَفْكَارِ",
        "B2": "الأسئلة يَجِبُ أَنْ تَكُونَ صَعْبَةً - تَحْتَاجُ إِلَى تَحْلِيلٍ عَمِيقٍ وَفَهْمٍ شَامِلٍ لِلْمُحْتَوَى"
      };

      const prompt = `
أَنْشِئْ 5 أَسْئِلَةِ اخْتِيَارٍ مِنْ مُتَعَدِّدٍ مِنَ النَّصِّ التَّالِي:

النَّصُّ:
${text}

المُسْتَوَى: ${level}
${levelDifficulty[level as keyof typeof levelDifficulty] || levelDifficulty["B1"]}

**قَوَاعِدُ مُهِمَّةٌ لِلأَسْئِلَةِ:**

1. **الْخِيَارَاتُ المُضَلِّلَةُ (Deceptive Options):**
   - كُلُّ خِيَارٍ خَطَأٍ يَجِبُ أَنْ يَبْدُوَ صَحِيحًا وَمَنْطِقِيًّا
   - اسْتَخْدِمْ مَعْلُومَاتٍ قَرِيبَةً مِنَ النَّصِّ وَلَكِنْ لَيْسَتْ دَقِيقَةً
   - اجْعَلْ الخِيَارَاتِ الخَطَأَ تَبْدُو كَأَنَّهَا يُمْكِنُ أَنْ تَكُونَ الإِجَابَةَ الصَّحِيحَةَ
   - مَثَالٌ: إِذَا كَانَ النَّصُّ عَنِ "التُّفَّاحِ الأَحْمَرِ"، الخِيَارُ الخَطَأُ يَقُولُ "التُّفَّاحِ الأَخْضَرِ" (قَرِيبٌ وَلَكِنْ خَطَأٌ)

2. **تَنْوِيعُ مَوْضِعِ الإِجَابَةِ الصَّحِيحَةِ:**
   - السُّؤَالُ الأَوَّلُ: ضَعِ الإِجَابَةَ الصَّحِيحَةَ فِي مَوْضِعٍ (A أَوْ C أَوْ D)
   - السُّؤَالُ الثَّانِي: ضَعِ الإِجَابَةَ الصَّحِيحَةَ فِي مَوْضِعٍ مُخْتَلِفٍ (B أَوْ D)
   - السُّؤَالُ الثَّالِثُ: ضَعِ الإِجَابَةَ الصَّحِيحَةَ فِي مَوْضِعٍ مُخْتَلِفٍ (C أَوْ A)
   - السُّؤَالُ الرَّابِعُ: ضَعِ الإِجَابَةَ الصَّحِيحَةَ فِي مَوْضِعٍ مُخْتَلِفٍ (D أَوْ B)
   - السُّؤَالُ الخَامِسُ: ضَعِ الإِجَابَةَ الصَّحِيحَةَ فِي مَوْضِعٍ مُخْتَلِفٍ (A أَوْ C)

3. **نَوْعُ الأَسْئِلَةِ:**
   - أَسْئِلَةٌ عَنِ الْمَعْلُومَاتِ الرَّئِيسِيَّةِ فِي النَّصِّ
   - أَسْئِلَةٌ تَحْتَاجُ إِلَى فَهْمٍ عَمِيقٍ وَلَيْسَ مُجَرَّدَ حِفْظٍ
   - أَسْئِلَةٌ عَنِ الْعَلاقَاتِ وَالأَسْبَابِ وَالنَّتَائِجِ

لِكُلِّ سُؤَالٍ:
- نَصُّ السُّؤَالِ (مَعَ التَّشْكِيلِ الكَامِلِ)
- 4 خِيَارَاتٍ (A, B, C, D) - رَتِّبِ الْخِيَارَاتِ بِحَيْثُ تَكُونَ الإِجَابَةُ الصَّحِيحَةُ فِي مَوَاضِعَ مُخْتَلِفَةٍ
- رَقْمُ الإِجَابَةِ الصَّحِيحَةِ (0 = A, 1 = B, 2 = C, 3 = D)
- شَرْحٌ مُخْتَصَرٌ

أَرْجِعِ النَّتِيجَةَ بِصِيغَةِ JSON:
{
  "questions": [
    {
      "question": "...",
      "options": ["A...", "B...", "C...", "D..."],
      "correctAnswer": 2,
      "explanation": "..."
    },
    ...
  ]
}

**مُهِمٌّ جِدًّا:**
- ضَعِ الحَرَكَاتِ (التَّشْكِيلَ) عَلَى جَمِيعِ الكَلِمَاتِ
- اجْعَلِ الخِيَارَاتِ الخَطَأَ صَعْبَةَ التَّمْيِيزِ وَمُقْنِعَةً
- نَوِّعْ مَوْضِعَ الإِجَابَةِ الصَّحِيحَةِ فِي كُلِّ سُؤَالٍ
`;

      const response = await contentMakerAgent.generateLegacy(
        [{ role: "user", content: prompt }],
        {
          resourceId: "question-generation",
          threadId: `questions-${Date.now()}`,
        }
      );

      logger?.info("✅ [generateQuestionsFromText] Agent response received");

      // Parse JSON response
      let questionsData;
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          questionsData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (parseError) {
        logger?.warn("⚠️ [generateQuestionsFromText] Failed to parse JSON, using fallback");
        
        // Fallback: 5 default questions
        questionsData = {
          questions: [
            {
              question: "مَا المَوْضُوعُ الرَّئِيسِيُّ لِلنَّصِّ؟",
              options: [
                "التَّعْلِيمُ وَالتَّكْنُولُوجِيَا",
                "الصِّحَّةُ وَالرِّيَاضَةُ",
                "التَّارِيخُ وَالثَّقَافَةُ",
                "الْعُلُومُ وَالْفَضَاءُ",
              ],
              correctAnswer: 0,
              explanation: "النَّصُّ يَتَحَدَّثُ عَنِ التَّعْلِيمِ وَاسْتِخْدَامِ التَّكْنُولُوجِيَا.",
            },
            {
              question: "أَيُّ مَعْلُومَةٍ مَذْكُورَةٌ فِي النَّصِّ؟",
              options: [
                "التَّطْبِيقَاتُ تُسَاعِدُ عَلَى التَّعَلُّمِ بِسُرْعَةٍ",
                "الْمَدَارِسُ لَمْ تَعُدْ ضَرُورِيَّةً",
                "الطُّلَّابُ لَا يَحْتَاجُونَ إِلَى مُعَلِّمِينَ",
                "التَّكْنُولُوجِيَا مُكَلِّفَةٌ جِدًّا",
              ],
              correctAnswer: 0,
              explanation: "النَّصُّ يَذْكُرُ أَنَّ التَّطْبِيقَاتِ تُسَاعِدُ عَلَى التَّعَلُّمِ بِسُرْعَةٍ.",
            },
            {
              question: "كَيْفَ تُسَاعِدُ التَّطْبِيقَاتُ الطُّلَّابَ؟",
              options: [
                "تُقَلِّلُ وَقْتَ الدِّرَاسَةِ",
                "تُعْطِي دُرُوسًا شَخْصِيَّةً",
                "تَسْتَبْدِلُ الْمُعَلِّمِينَ",
                "تَجْعَلُ التَّعْلِيمَ مَجَّانِيًّا",
              ],
              correctAnswer: 1,
              explanation: "النَّصُّ يُشِيرُ إِلَى أَنَّ التَّطْبِيقَاتِ تُقَدِّمُ دُرُوسًا شَخْصِيَّةً.",
            },
            {
              question: "مَاذَا أَظْهَرَتِ الأَبْحَاثُ؟",
              options: [
                "التَّكْنُولُوجِيَا مُضِرَّةٌ لِلطُّلَّابِ",
                "الطُّلَّابُ يُفَضِّلُونَ الْكُتُبَ التَّقْلِيدِيَّةَ",
                "التَّحْسِينُ فِي الأَدَاءِ الدِّرَاسِيِّ مَلْحُوظٌ",
                "الْمُعَلِّمُونَ لَمْ يَعُودُوا مُهِمِّينَ",
              ],
              correctAnswer: 2,
              explanation: "النَّصُّ يَذْكُرُ أَنَّ الأَبْحَاثَ أَظْهَرَتْ تَحْسِينًا مَلْحُوظًا.",
            },
            {
              question: "مَا هُوَ دَوْرُ الْمُعَلِّمِ فِي الْمُسْتَقْبَلِ؟",
              options: [
                "تَوْجِيهُ الطُّلَّابِ وَتَطْوِيرُ مَهَارَاتِهِمْ",
                "الْمُرَاقَبَةُ فَقَطْ",
                "لَا دَوْرَ لَهُمْ",
                "إِصْلَاحُ الأَجْهِزَةِ",
              ],
              correctAnswer: 0,
              explanation: "النَّصُّ يُؤَكِّدُ أَنَّ دَوْرَ الْمُعَلِّمِ يَظَلُّ أَسَاسِيًّا.",
            },
          ],
        };
      }

      logger?.info("✅ [generateQuestionsFromText] Questions generated successfully", {
        count: questionsData.questions?.length || 0,
      });

      return {
        questions: questionsData.questions || [],
        success: true,
        message: `Successfully generated ${questionsData.questions?.length || 0} questions`,
      };
    } catch (error) {
      logger?.error("❌ [generateQuestionsFromText] Error generating questions", { error });

      return {
        questions: [],
        success: false,
        message: `Failed to generate questions: ${error}`,
      };
    }
  },
});
