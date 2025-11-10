import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { sharedPostgresStorage } from "../storage";
import { createOpenAI } from "@ai-sdk/openai";

// Import all content maker tools
import { generatePodcastContent } from "../tools/generatePodcastContent";
import { generateQuestions } from "../tools/generateQuestions";
import { generateAudio } from "../tools/generateAudio";
import { generateImage } from "../tools/generateImage";
import { requestAdminApproval } from "../tools/requestAdminApproval";
import { sendToTelegram } from "../tools/sendToTelegram";

/**
 * LLM Configuration for Content Maker Agent
 * Using Replit AI Integrations (no API key needed)
 */
const openai = createOpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

/**
 * Content Maker Agent
 *
 * Bu agent har kuni A2-B1 darajasidagi podcast va testlar yaratadi.
 * AI va ta'lim sohasidagi yangiliklardan foydalanadi.
 */
export const contentMakerAgent = new Agent({
  name: "Content Maker Agent",

  instructions: `
أنت "Content Maker Agent" - مساعد ذكاء اصطناعي محترف لإنشاء محتوى تعليمي.

🎯 مهامك الأساسية:
- إنشاء نص بودكاست يومي بمستوى A2-B1
- اختيار مواضيع مثيرة من أخبار الذكاء الاصطناعي والتعليم
- إنشاء 3 أسئلة اختيار من متعدد للبودكاست
- إنشاء صوت احترافي عبر ElevenLabs
- طلب موافقة المدير والحصول عليها
- بعد الموافقة، إرسال المحتوى إلى قناة Telegram

📝 قواعد إنشاء المحتوى:
1. استخدم دائماً لغة بمستوى A2-B1
2. جمل بسيطة ومفهومة
3. مواضيع مثيرة ومفيدة للتعلم
4. نهج احترافي وتعليمي
5. **مُهِمٌّ جِدًّا:** نَصُّ البُودْكَاسْتِ يَجِبُ أَنْ يَكُونَ 20 كَلِمَةً فَقَطْ (لِلاخْتِبَارِ!)
6. أَضِفِ التَّشْكِيلَ الكَامِلَ لِكُلِّ كَلِمَةٍ عَرَبِيَّةٍ
7. 2 أَسْئِلَةٍ فَقَطْ (لِلاخْتِبَارِ)

❓ قواعد إنشاء الاختبارات:
1. كل اختبار له 4 خيارات (A, B, C, D)
2. إجابة صحيحة واحدة
3. الاختبارات مبنية على محتوى البودكاست
4. شرح مختصر لكل إجابة

🔄 سير العمل:
1. generatePodcastContent - إنشاء نص البودكاست
2. generateQuestions - إنشاء 3 اختبارات
3. generateAudio - إنشاء الصوت
4. requestAdminApproval - طلب موافقة المدير
5. إذا وافق المدير -> sendToTelegram - إرسال إلى القناة
6. إذا رفض المدير -> إنشاء بودكاست جديد

📊 مهم:
- أنشئ دائماً محتوى احترافي وعالي الجودة
- خذ بعين الاعتبار ملاحظات المدير
- اكتب السجلات بشكل جيد للتصحيح
- تعامل مع الأخطاء بشكل صحيح

أتمنى لك النجاح! 🚀
`,

  model: openai.responses("gpt-5"),

  tools: {
    generatePodcastContent,
    generateQuestions,
    generateAudio,
    generateImage,
    requestAdminApproval,
    sendToTelegram,
  },

  memory: new Memory({
    options: {
      threads: {
        generateTitle: true,
      },
      lastMessages: 20, // Ko'proq context uchun
    },
    storage: sharedPostgresStorage,
  }),
});
