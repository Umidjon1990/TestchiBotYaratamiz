import { demoRepository } from "../storage/demoRepository";
import { appStorageClient } from "../storage/appStorageClient";
import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * Content Generation Helper - Inngest'siz
 * Railway deployment uchun oddiy function
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

// OpenAI client for direct AI calls (Railway deployment)
const openai = createOpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// Content output schema for structured generation
const ContentSchema = z.object({
  topic: z.string().describe("موضوع المحتوى"),
  podcastTitle: z.string().describe("عنوان المحتوى مع التشكيل"),
  podcastContent: z.string().describe("النص الكامل مع التشكيل"),
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()).length(4),
    correctAnswer: z.enum(["A", "B", "C", "D"]).describe("الإجابة الصحيحة (A أو B أو C أو D)"),
    explanation: z.string(),
  })).length(5),
  imageUrl: z.string().optional().default(""),
});

export interface ContentGenerationParams {
  contentType: "podcast" | "listening" | "reading";
  level: "A1" | "A2" | "B1" | "B2";
  topic?: string;
  audioProvider?: "elevenlabs" | "lahajati";
}

export async function generateContentDirectly(
  params: ContentGenerationParams,
  mastra: any
): Promise<{ success: boolean; error?: string; demoId?: number }> {
  const logger = mastra?.getLogger();
  const { contentType = "podcast", level = "B1", topic, audioProvider = "elevenlabs" } = params;
  
  logger?.info("🚀 [Helper] Starting content generation (Inngest'siz)", {
    contentType,
    level,
    topic: topic || "random",
    audioProvider,
  });

  try {
    // Step 1: Generate content with agent
    logger?.info("🤖 [Helper Step 1] Generating content with agent...");
    
    const contentTypeArabic = contentType === "listening" ? "تِنْجْلَاش (مُحْتَوَى صَوْتِيّ)" : contentType === "reading" ? "أُوقِيش (مُحْتَوَى قِرَائِيّ)" : "بُودْكَاسْت";
    
    const contentInstruction = contentType === "listening"
      ? `أنشئ نص صَوْتِيّ (audio script) بمستوى ${level} عن هذا الموضوع - يَجِبُ أَنْ يَحْتَوِيَ عَلَى 50 كَلِمَةً عَلَى الأَقَلِّ`
      : contentType === "reading"
      ? `أنشئ نص قِرَائِيّ (reading text) بمستوى ${level} عن هذا الموضوع - يَجِبُ أَنْ يَحْتَوِيَ عَلَى 100 كَلِمَةٍ عَلَى الأَقَلِّ. **مُهِمٌّ:** هَذَا النَّصُّ مُخْتَلِفٌ عَنِ النَّصِّ الصَّوْتِيِّ - اكْتُبْ مُحْتَوًى جَدِيدًا تَمَامًا لِلْقِرَاءَةِ`
      : `أنشئ نص podcast بمستوى ${level} عن هذا الموضوع - يَجِبُ أَنْ يَحْتَوِيَ عَلَى 80 كَلِمَةً عَلَى الأَقَلِّ`;
    
    const questionInstruction = contentType === "listening" 
      ? "**مُهِمٌّ جِدًّا:** الأسئلة يَجِبُ أَنْ تَكُونَ عَنْ مَا سَمِعَهُ الْمُتَعَلِّمُ فِي الصَّوْتِ (مَثَلاً: مَا الَّذِي سَمِعْتَهُ عَنْ...؟ / مَاذَا ذُكِرَ فِي الصَّوْتِ عَنْ...؟)"
      : contentType === "reading"
      ? "**مُهِمٌّ جِدًّا:** الأسئلة يَجِبُ أَنْ تَكُونَ عَنْ مَا قَرَأَهُ الْمُتَعَلِّمُ فِي النَّصِّ (مَثَلاً: مَا الَّذِي قَرَأْتَهُ عَنْ...؟ / مَاذَا ذُكِرَ فِي النَّصِّ عَنْ...؟)"
      : "الأسئلة عَنْ مَحْتَوَى الْبُودْكَاسْتِ";
    
    const levelDifficulty = {
      "A1": `الأسئلة يَجِبُ أَنْ تَكُونَ سَهْلَةً - مَعْلُومَاتٌ أَسَاسِيَّةٌ مِنَ النَّصِّ`,
      "A2": `الأسئلة يَجِبُ أَنْ تَكُونَ سَهْلَةً إِلَى مُتَوَسِّطَةٍ - مَعْلُومَاتٌ وَاضِحَةٌ مَعَ قَلِيلٍ مِنَ الاسْتِنْتَاجِ`,
      "B1": `الأسئلة يَجِبُ أَنْ تَكُونَ مُتَوَسِّطَةَ الصُّعُوبَةِ - تَحْتَاجُ فَهْمًا عَمِيقًا وَرَبْطَ الأَفْكَارِ`,
      "B2": `الأسئلة يَجِبُ أَنْ تَكُونَ صَعْبَةً - تَحْتَاجُ تَحْلِيلًا نَقْدِيًّا وَفَهْمًا شَامِلًا`,
    };
    
    const topicInstruction = topic
      ? `1. أنشئ محتوى حول الموضوع التالي: "${topic}"`
      : `1. اختر موضوعاً مثيراً من أحد المجالات التالية (تَجَنَّبْ المَوَاضِيعَ الدِّينِيَّةَ):
   - العلوم، التكنولوجيا، الصحة، الثقافة، التاريخ، البيئة، التعليم، الأعمال`;
      
    const prompt = `
الرجاء القيام بالمهام التالية باللغة العربية مع الحركات (التشكيل الكامل):

نوع المحتوى: ${contentTypeArabic}
المستوى: ${level}

${topicInstruction}
2. **مُهِمٌّ جِدًّا:** ${contentInstruction} مع التشكيل الكامل
3. أنشئ **5 أسئلة اختيار من متعدد بالضبط** حول المحتوى مع التشكيل
4. ${questionInstruction}
5. **مُهِمٌّ:** ${levelDifficulty[level]}

يَجِبُ أَنْ يَكُونَ جَمِيعُ النَّصِّ بِالتَّشْكِيلِ الكَامِلِ (الحركات على كل حرف).

**CRITICAL: You MUST respond with ONLY valid JSON in this exact format (no markdown, no extra text):**

{
  "topic": "موضوع المحتوى",
  "podcastTitle": "عنوان المحتوى مع التشكيل",
  "podcastContent": "النص الكامل مع التشكيل (${contentType === "listening" ? "75+ كلمة" : "100+ كلمة"})",
  "questions": [
    {
      "question": "السؤال مع التشكيل؟",
      "options": ["الخيار A", "الخيار B", "الخيار C", "الخيار D"],
      "correctAnswer": "A",
      "explanation": "شرح الإجابة الصحيحة"
    }
  ],
  "imageUrl": ""
}

Return ONLY the JSON object above, nothing else.
`;

    let content;
    try {
      const result = await generateObject({
        model: openai.responses("gpt-5"),
        schema: ContentSchema,
        prompt,
        temperature: 0.7,
      });
      content = result.object;
    } catch (firstError: any) {
      logger?.warn("⚠️ [Helper Step 1] First attempt failed, retrying...", {
        error: firstError?.message,
      });
      
      // Retry once for transient errors
      try {
        const result = await generateObject({
          model: openai.responses("gpt-5"),
          schema: ContentSchema,
          prompt,
          temperature: 0.8, // Slightly higher temp for retry
        });
        content = result.object;
        logger?.info("✅ [Helper Step 1] Retry successful");
      } catch (retryError: any) {
        logger?.error("❌ [Helper Step 1] Both attempts failed", {
          firstError: firstError?.message,
          retryError: retryError?.message,
        });
        throw new Error(`AI generation failed after retry: ${retryError?.message}`);
      }
    }

    logger?.info("✅ [Helper Step 1] Content generated with structured output", {
      title: content.podcastTitle,
      questions: content.questions?.length || 0,
    });

    // Step 2: Generate audio if listening content
    let audioStoragePath = "";
    let audioUrl = "";
    
    if (contentType === "listening" || contentType === "podcast") {
      logger?.info("🎙️ [Helper Step 2] Generating audio...");
      
      const audioTool = audioProvider === "lahajati" 
        ? mastra.getTool("generate-lahajati-audio")
        : mastra.getTool("generate-audio");
      
      if (!audioTool) {
        throw new Error(`Audio tool not found: ${audioProvider}`);
      }

      const audioResult = await audioTool.execute(
        {
          text: content.podcastContent || "",
          title: content.podcastTitle,
        },
        { mastra }
      );

      if (!audioResult || !audioResult.success) {
        throw new Error(`Audio generation failed: ${audioResult?.error || "Unknown error"}`);
      }

      audioStoragePath = audioResult.storagePath || "";
      audioUrl = audioResult.publicUrl || "";
      
      logger?.info("✅ [Helper Step 2] Audio generated", {
        storagePath: audioStoragePath,
        hasPublicUrl: !!audioUrl,
      });
    }

    // Step 3: Convert correctAnswer from string ("A", "B", "C", "D") to number (0, 1, 2, 3)
    logger?.info("📝 [Helper Step 3] Converting question answers to numeric format...");
    
    const questionsWithNumberAnswers = content.questions.map((q, idx) => {
      const answer = q.correctAnswer.trim().toUpperCase();
      let numericAnswer: number;
      
      if (answer === "A") numericAnswer = 0;
      else if (answer === "B") numericAnswer = 1;
      else if (answer === "C") numericAnswer = 2;
      else if (answer === "D") numericAnswer = 3;
      else {
        logger?.error(`❌ Invalid correctAnswer for question ${idx + 1}: "${q.correctAnswer}" - expected A, B, C, or D`);
        throw new Error(`Invalid correctAnswer: "${q.correctAnswer}" (expected A, B, C, or D)`);
      }
      
      return {
        ...q,
        correctAnswer: numericAnswer,
      };
    });
    
    // Step 4: Save to database
    logger?.info("💾 [Helper Step 4] Saving to database...");
    
    const demoSession = await demoRepository.createDemoSession({
      podcastTitle: content.podcastTitle,
      podcastContent: content.podcastContent || "",
      questions: questionsWithNumberAnswers,
      imageUrl: content.imageUrl || "",
      audioUrl,
      audioStoragePath,
      contentType,
      level,
      topic: topic || content.topic || "Random",
      audioProvider: (contentType === "listening" || contentType === "podcast") ? audioProvider : undefined,
    }, logger);

    const demoId = demoSession.id;
    
    // Update status to draft (preview sent to admin, waiting approval)
    await demoRepository.updateDemoStatusById(demoId, "draft", logger);
    
    logger?.info("✅ [Helper Step 3] Saved to database", { demoId });

    // Step 5: Send preview to admin
    logger?.info("📤 [Helper Step 5] Sending preview to admin...");
    
    await sendAdminPreview({
      demoId,
      title: content.podcastTitle,
      content: content.podcastContent || "",
      questions: questionsWithNumberAnswers, // Use numeric format for correct ✅ markers
      imageUrl: content.imageUrl || "",
      audioStoragePath,
      contentType,
    }, logger);

    logger?.info("✅ [Helper] Content generation complete!", { demoId });

    return { success: true, demoId };

  } catch (error: any) {
    logger?.error("❌ [Helper] Content generation failed", {
      error: error?.message,
      stack: error?.stack,
    });

    return { success: false, error: error?.message || "Unknown error" };
  }
}

/**
 * Send preview to admin (Telegram)
 */
async function sendAdminPreview(
  data: {
    demoId: number;
    title: string;
    content: string;
    questions: any[];
    imageUrl: string;
    audioStoragePath: string;
    contentType: string;
  },
  logger: any
) {
  const { demoId, title, content, questions, imageUrl, audioStoragePath, contentType } = data;

  logger?.info("📤 [sendAdminPreview] Preparing preview...", { demoId });

  // Format questions
  const formattedQuestions = questions
    .map((q, i) => {
      const options = q.options.map((opt: string, idx: number) => {
        const letter = String.fromCharCode(97 + idx);
        const isCorrect = idx === q.correctAnswer;
        return `   ${letter}) ${opt}${isCorrect ? " ✅" : ""}`;
      }).join("\n");
      
      return `❓ السُّؤَالُ ${i + 1}: ${q.question}\n${options}\n📝 ${q.explanation}`;
    })
    .join("\n\n");

  const previewText = `🎓 *مُعَايَنَةُ المُحْتَوَى الجَدِيدِ*

📌 *العُنْوَانُ:* ${title}

📝 *النَّصُّ:*
${content}

${formattedQuestions}`;

  // Send preview with audio (if listening)
  if ((contentType === "listening" || contentType === "podcast") && audioStoragePath) {
    logger?.info("🎙️ [sendAdminPreview] Sending audio preview...");
    
    try {
      // Download audio as buffer
      const audioBuffer = await appStorageClient.downloadAsBuffer(audioStoragePath);
      
      // Send audio with caption
      const FormData = (await import("form-data")).default;
      const form = new FormData();
      form.append("chat_id", TELEGRAM_ADMIN_CHAT_ID);
      form.append("audio", audioBuffer, { filename: "preview.mp3" });
      form.append("caption", previewText);
      form.append("parse_mode", "Markdown");
      form.append("reply_markup", JSON.stringify({
        inline_keyboard: [
          [
            { text: "✅ تَأْكِيدٌ", callback_data: `approve_${demoId}` },
            { text: "❌ رَفْضٌ", callback_data: `reject_${demoId}` },
          ],
        ],
      }));

      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`,
        {
          method: "POST",
          body: form as any,
        }
      );

      logger?.info("✅ [sendAdminPreview] Audio preview sent");
    } catch (audioError: any) {
      logger?.error("❌ [sendAdminPreview] Failed to send audio, sending text only", {
        error: audioError?.message,
      });
      
      // Fallback: send text only
      await sendTextPreview(previewText, demoId);
    }
  } else {
    // Reading content - text only
    await sendTextPreview(previewText, demoId);
  }
}

/**
 * Send text-only preview
 */
async function sendTextPreview(text: string, demoId: number) {
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_ADMIN_CHAT_ID,
        text,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ تَأْكِيدٌ", callback_data: `approve_${demoId}` },
              { text: "❌ رَفْضٌ", callback_data: `reject_${demoId}` },
            ],
          ],
        },
      }),
    }
  );
}

/**
 * Send approved content to Telegram channel
 */
export async function sendToTelegramChannelDirectly(
  data: {
    title: string;
    content: string;
    questions: any[];
    imageUrl: string;
    audioStoragePath: string;
    contentType: string;
  },
  logger: any
): Promise<{ success: boolean; error?: string }> {
  const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
  
  if (!TELEGRAM_CHANNEL_ID) {
    throw new Error("TELEGRAM_CHANNEL_ID not configured");
  }

  const { title, content, questions, imageUrl, audioStoragePath, contentType } = data;

  logger?.info("📤 [sendToChannel] Preparing channel post...");

  // Format questions
  const formattedQuestions = questions
    .map((q, i) => {
      const options = q.options.map((opt: string, idx: number) => {
        const letter = String.fromCharCode(97 + idx);
        return `   ${letter}) ${opt}`;
      }).join("\n");
      
      return `❓ السُّؤَالُ ${i + 1}: ${q.question}\n${options}\n\n✅ الإِجَابَةُ الصَّحِيحَةُ: ${String.fromCharCode(97 + q.correctAnswer)}) ${q.options[q.correctAnswer]}\n📝 ${q.explanation}`;
    })
    .join("\n\n");

  const channelText = `🎓 *${title}*

📝 *النَّصُّ:*
${content}

${formattedQuestions}`;

  try {
    // Send audio content (if listening)
    if ((contentType === "listening" || contentType === "podcast") && audioStoragePath) {
      logger?.info("🎙️ [sendToChannel] Sending audio to channel...");
      
      const audioBuffer = await appStorageClient.downloadAsBuffer(audioStoragePath);
      
      const FormData = (await import("form-data")).default;
      const form = new FormData();
      form.append("chat_id", TELEGRAM_CHANNEL_ID);
      form.append("audio", audioBuffer, { filename: "content.mp3" });
      form.append("caption", channelText);
      form.append("parse_mode", "Markdown");

      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`,
        {
          method: "POST",
          body: form as any,
        }
      );

      logger?.info("✅ [sendToChannel] Audio sent to channel");
    } else {
      // Reading content - text only
      logger?.info("📝 [sendToChannel] Sending text to channel...");
      
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHANNEL_ID,
            text: channelText,
            parse_mode: "Markdown",
          }),
        }
      );

      logger?.info("✅ [sendToChannel] Text sent to channel");
    }

    return { success: true };
  } catch (error: any) {
    logger?.error("❌ [sendToChannel] Failed to send to channel", {
      error: error?.message,
      stack: error?.stack,
    });

    return { success: false, error: error?.message || "Unknown error" };
  }
}
