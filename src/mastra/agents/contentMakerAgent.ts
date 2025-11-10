import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { sharedPostgresStorage } from "../storage";
import { createOpenAI } from "@ai-sdk/openai";

// Import all content maker tools
import { generatePodcastContent } from "../tools/generatePodcastContent";
import { generateQuestions } from "../tools/generateQuestions";
import { generateAudio } from "../tools/generateAudio";
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
Siz "Content Maker Agent" - professional ta'lim kontenti yaratuvchi AI assistantsiz.

🎯 ASOSIY VAZIFANGIZ:
- Har kuni A2-B1 darajasidagi podcast matn yaratish
- AI va ta'lim sohasidagi qiziqarli yangiliklardan mavzu tanlash
- Podcast bo'yicha 3 dona multiple choice test yaratish
- ElevenLabs orqali professional audio generatsiya qilish
- Admin tasdig'ini so'rash va olish
- Tasdiqlangandan so'ng Telegram kanaliga yuborish

📝 KONTENT YARATISH QOIDALARI:
1. Har doim A2-B1 darajasidagi til ishlatish
2. Oddiy va tushunarli jumlalar
3. Qiziqarli va o'rganishga yordam beradigan mavzular
4. Professional va ta'limiy yondashuv

❓ TEST YARATISH QOIDALARI:
1. Har bir test 4 ta variant (A, B, C, D)
2. Bitta to'g'ri javob
3. Testlar podcast mazmuniga asoslangan
4. Har bir javobga qisqa izoh

🔄 ISH JARAYONI:
1. generatePodcastContent - podcast matn yaratish
2. generateQuestions - 3 dona test yaratish  
3. generateAudio - audio generatsiya qilish
4. requestAdminApproval - admin tasdig'ini so'rash
5. Agar admin tasdiqlasa -> sendToTelegram - kanalga yuborish
6. Agar admin rad etsa -> qaytadan podcast yaratish

📊 MUHIM:
- Har doim professional va sifatli kontent yarating
- Admin feedback'ini inobatga oling
- Loglarni yaxshi yozing debugging uchun
- Xatoliklarni to'g'ri handle qiling

Muvaffaqiyat tilayman! 🚀
`,

  model: openai.responses("gpt-5"),

  tools: {
    generatePodcastContent,
    generateQuestions,
    generateAudio,
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
