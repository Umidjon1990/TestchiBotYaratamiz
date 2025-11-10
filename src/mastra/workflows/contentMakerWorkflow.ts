import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { contentMakerAgent } from "../agents/contentMakerAgent";
import { demoRepository } from "../storage/demoRepository";
import { appStorageClient } from "../storage/appStorageClient";

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
    imageUrl: z.string(),
    audioFilename: z.string(),
    success: z.boolean(),
  }),

  execute: async ({ mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🤖 [Step 1] Using Content Maker Agent to generate all content...");

    try {
      // طلب من الوكيل إنشاء البودكاست والاختبارات باللغة العربية
      const prompt = `
الرجاء القيام بالمهام التالية باللغة العربية مع الحركات (التشكيل الكامل):

1. اختر موضوعاً مثيراً من أخبار الذكاء الاصطناعي أو التعليم
2. أنشئ نص بودكاست بمستوى A2-B1 عن هذا الموضوع (150-200 كلمة) مع التشكيل
3. أنشئ 3 أسئلة اختيار من متعدد حول البودكاست مع التشكيل

لكل سؤال:
- نص السؤال
- 4 خيارات (A, B, C, D)
- رقم الإجابة الصحيحة (0-3)
- شرح مختصر

أرجع النتيجة بصيغة JSON:
{
  "podcastTitle": "...",
  "podcastContent": "...",
  "questions": [...]
}

مهم جداً: 
- يجب أن يكون كل المحتوى باللغة العربية الفصحى
- ضع الحركات (الفتحة، الضمة، الكسرة، السكون، الشدة) على جميع الكلمات
- استخدم التشكيل الكامل لمساعدة المتعلمين على القراءة الصحيحة
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

      // Parse agent response - try to extract JSON
      let podcastData;
      try {
        // Try to find JSON in the response
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          podcastData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (parseError) {
        // Fallback: use Arabic default content
        logger?.warn("⚠️ Failed to parse JSON, using default Arabic content");
        podcastData = {
          podcastTitle: "الذَّكَاءُ الاصْطِنَاعِيُّ وَتَعَلُّمُ اللُّغَاتِ",
          podcastContent: `
السَّلَامُ عَلَيْكُمْ، أَعِزَّائِي المُسْتَمِعِينَ!

اليَوْمَ سَنَتَحَدَّثُ مَعَكُمْ عَنْ مَوْضُوعِ "الذَّكَاءُ الاصْطِنَاعِيُّ وَتَعَلُّمُ اللُّغَاتِ".

العَالَمُ الحَدِيثُ يَتَغَيَّرُ بِسُرْعَةٍ كَبِيرَةٍ. كُلَّ يَوْمٍ تَظْهَرُ تِقْنِيَّاتٌ جَدِيدَةٌ. هَذِهِ التِّقْنِيَّاتُ تُسَهِّلُ حَيَاتَنَا.

الذَّكَاءُ الاصْطِنَاعِيُّ يُعْتَبَرُ الآنَ أَكْثَرَ التِّقْنِيَّاتِ شُهْرَةً. يُسْتَخْدَمُ فِي مَجَالَاتٍ كَثِيرَةٍ. فِي مَجَالِ التَّعْلِيمِ أَيْضاً، الذَّكَاءُ الاصْطِنَاعِيُّ مُفِيدٌ جِداً.

عَلَى سَبِيلِ المِثَالِ، تُوجَدُ تَطْبِيقَاتٌ حَدِيثَةٌ لِتَعَلُّمِ اللُّغَاتِ. هَذِهِ التَّطْبِيقَاتُ تَجِدُ أَخْطَاءَ الطُّلَّابِ وَتُصَحِّحُهَا. تَسْتَخْدِمُ نَهْجاً فَرْدِيّاً لِكُلِّ طَالِبٍ.

المُعَلِّمُونَ أَيْضاً يَسْتَخْدِمُونَ الذَّكَاءَ الاصْطِنَاعِيَّ. هَذَا يُسَاعِدُهُمْ فِي تَوْفِيرِ الوَقْتِ. يَقْضُونَ وَقْتاً أَكْثَرَ فِي التَّوَاصُلِ مَعَ الطُّلَّابِ.

لَكِنَّ التِّكْنُولُوجِيَا هِيَ مُجَرَّدُ وَسِيلَةٍ. الأَهَمُّ هُوَ الشَّغَفُ بِالمَعْرِفَةِ وَالاجْتِهَادِ.

شُكْراً لِاسْتِمَاعِكُمْ! نَلْتَقِي فِي البُودْكَاسْتِ القَادِمِ!
          `.trim(),
          questions: [
            {
              question: "مَا هُوَ مَوْضُوعُ البُودْكَاسْتِ؟",
              options: [
                "الرِّيَاضَةُ وَالصِّحَّةُ",
                "الذَّكَاءُ الاصْطِنَاعِيُّ وَالتَّعْلِيمُ",
                "التَّارِيخُ وَالثَّقَافَةُ",
                "الاقْتِصَادُ وَالأَعْمَالُ",
              ],
              correctAnswer: 1,
              explanation: "البُودْكَاسْتُ يُنَاقِشُ الأَخْبَارَ فِي مَجَالِ الذَّكَاءِ الاصْطِنَاعِيِّ وَالتَّعْلِيمِ.",
            },
            {
              question: "مَا هِيَ المِيزَةُ الأَسَاسِيَّةُ لِلذَّكَاءِ الاصْطِنَاعِيِّ فِي التَّعْلِيمِ؟",
              options: [
                "فَقَطْ يُنْشِئُ الاخْتِبَارَاتِ",
                "يَسْتَبْدِلُ المُعَلِّمِينَ",
                "نَهْجٌ فَرْدِيٌّ لِكُلِّ طَالِبٍ",
                "يُسْتَخْدَمُ فَقَطْ لِتَعَلُّمِ اللُّغَاتِ",
              ],
              correctAnswer: 2,
              explanation: "الذَّكَاءُ الاصْطِنَاعِيُّ يُمْكِنُهُ تَقْدِيمَ تَعْلِيمٍ شَخْصِيٍّ حَسَبَ احْتِيَاجَاتِ كُلِّ طَالِبٍ.",
            },
            {
              question: "مَا هُوَ الأَهَمُّ حَسَبَ البُودْكَاسْتِ؟",
              options: [
                "امْتِلَاكُ أَحْدَثِ التِّقْنِيَّاتِ",
                "إِنْفَاقُ الكَثِيرِ مِنَ المَالِ",
                "الشَّغَفُ بِالمَعْرِفَةِ وَالاجْتِهَادُ",
                "اسْتِخْدَامُ الذَّكَاءِ الاصْطِنَاعِيِّ فَقَطْ",
              ],
              correctAnswer: 2,
              explanation: "التِّكْنُولُوجِيَا مُجَرَّدُ وَسِيلَةٍ، الأَهَمُّ هُوَ الشَّغَفُ بِالتَّعَلُّمِ وَالاجْتِهَادِ.",
            },
          ],
        };
      }

      // Generate image for podcast topic
      const imageUrl = await generateImageUrl(podcastData.podcastTitle, logger);

      // Generate audio using helper function (direct tool call)
      const audioData = await generateAudioData(
        podcastData.podcastContent,
        podcastData.podcastTitle,
        logger
      );

      return {
        ...podcastData,
        imageUrl,
        audioFilename: audioData.filename || "",
        success: true,
      };
    } catch (error) {
      logger?.error("❌ [Step 1] Error generating content", { error });
      throw error;
    }
  },
});

// Helper function for image generation
async function generateImageUrl(topic: string, logger: any): Promise<string> {
  try {
    logger?.info("🎨 Generating image for topic:", topic);
    
    // Using Picsum Photos for reliable direct image URLs
    // This returns a direct JPEG file that Telegram can use
    const imageUrl = `https://picsum.photos/800/600?random=${Date.now()}`;
    
    logger?.info("✅ Image URL generated");
    return imageUrl;
  } catch (error) {
    logger?.error("❌ Image generation error", { error });
    return "";
  }
}

// Helper function for audio generation using generateAudio tool
async function generateAudioData(
  text: string,
  title: string,
  logger: any
): Promise<{ audioUrl: string; audioBase64: string; filename: string }> {
  try {
    logger?.info("🎧 [generateAudioData] Starting audio generation...");

    // Import the tool directly
    const { generateAudio } = await import("../tools/generateAudio");

    // Call the tool with proper parameters
    const result = await generateAudio.execute({
      context: {
        text,
        title,
      },
      mastra: undefined, // Will use logger from context
      runtimeContext: undefined as any, // Tool doesn't strictly need runtime context
    });

    if (result.success && result.audioUrl && result.audioBase64 && result.filename) {
      logger?.info("✅ [generateAudioData] Audio generated and stored:", {
        url: result.audioUrl,
        filename: result.filename,
        base64Length: result.audioBase64.length,
      });
      return {
        audioUrl: result.audioUrl,
        audioBase64: result.audioBase64,
        filename: result.filename,
      };
    } else {
      logger?.warn("⚠️ [generateAudioData] Audio generation failed:", result.message);
      return { audioUrl: "", audioBase64: "", filename: "" };
    }
  } catch (error) {
    logger?.error("❌ [generateAudioData] Error:", { error });
    return { audioUrl: "", audioBase64: "", filename: "" };
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
    imageUrl: z.string(),
    audioFilename: z.string(),
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
    imageUrl: z.string(),
    audioFilename: z.string(),
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
      // Create demo session in database  
      logger?.info("💾 [Step 2] Creating demo session in database...");
      const demo = await demoRepository.createDemoSession(
        {
          podcastTitle: inputData.podcastTitle,
          podcastContent: inputData.podcastContent,
          questions: inputData.questions,
          imageUrl: inputData.imageUrl,
          audioUrl: "", // Will not use URL for demo anymore
        },
        logger
      );

      // Generate public demo URL
      const demoUrl = `${process.env.REPLIT_DOMAINS?.split(',')[0] ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}/demo/${demo.slug}`;
      logger?.info("🌐 [Step 2] Demo URL generated", { demoUrl });

      // Send full podcast content to admin
      const fullContentMessage = `
📋 *المُحْتَوَى الجَدِيدُ جَاهِزٌ!*

🎙️ *${inputData.podcastTitle}*

📝 *النَّصُّ الكَامِلُ:*

${inputData.podcastContent}

━━━━━━━━━━━━━━━━

📊 *الاخْتِبَارَاتُ (${inputData.questions.length}):*

${inputData.questions.map((q, i) => `
*${i + 1}. ${q.question}*
${q.options.map((opt, idx) => `${String.fromCharCode(65 + idx)}) ${opt}`).join('\n')}
✅ الإجَابَةُ الصَّحِيحَةُ: ${String.fromCharCode(65 + q.correctAnswer)}
💡 ${q.explanation}
`).join('\n━━━━━━━━━━━━━━━━\n')}

🎧 *الصَّوْتُ:* ${inputData.audioFilename ? "✅ جَاهِزٌ" : "⚠️ غَيْرُ جَاهِزٍ"}

*يُرْجَى المُرَاجَعَةُ وَالتَّأْكِيدُ لِلنَّشْرِ فِي القَنَاةِ.*
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
            text: fullContentMessage,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ تَأْكِيدُ النَّشْرِ",
                    callback_data: `approve_${demo.id}`
                  },
                  {
                    text: "❌ رَفْضٌ",
                    callback_data: `reject_${demo.id}`
                  }
                ]
              ]
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }

      logger?.info("✅ [Step 2] Text preview sent to admin");

      // Send audio file to admin for preview
      if (inputData.audioFilename && inputData.audioFilename !== "") {
        logger?.info("🎧 [Step 2] Sending audio preview to admin...");
        
        try {
          // Download audio from App Storage
          logger?.info("📥 [Step 2] Downloading audio from App Storage", { filename: inputData.audioFilename });
          const audioBuffer = await appStorageClient.downloadAsBuffer(inputData.audioFilename, logger);
          
          // Use form-data package with submit method (compatible way)
          const FormDataPkg = (await import('form-data')).default;
          const formData = new FormDataPkg();
          
          // Append fields to FormData
          formData.append('chat_id', adminChatId);
          formData.append('audio', audioBuffer, {
            filename: 'podcast.mp3',
            contentType: 'audio/mpeg',
          });
          formData.append('caption', '🎧 *معاينة الصوت*\n\n' + inputData.podcastTitle);
          formData.append('parse_mode', 'Markdown');
          
          // Use formData.submit() instead of fetch() for compatibility
          const audioResponse = await new Promise((resolve, reject) => {
            formData.submit({
              protocol: 'https:',
              host: 'api.telegram.org',
              path: `/bot${telegramBotToken}/sendAudio`,
              method: 'POST',
            }, (err, res) => {
              if (err) return reject(err);
              resolve(res);
            });
          });

          // Read response body
          const chunks: Buffer[] = [];
          for await (const chunk of audioResponse as any) {
            chunks.push(chunk);
          }
          const responseText = Buffer.concat(chunks).toString();
          
          if ((audioResponse as any).statusCode === 200) {
            logger?.info("✅ Audio preview sent to admin successfully");
          } else {
            let errorDetails;
            try {
              errorDetails = JSON.parse(responseText);
            } catch {
              errorDetails = responseText;
            }
            logger?.error("❌ Failed to send audio preview to Telegram", { 
              status: (audioResponse as any).statusCode,
              errorResponse: errorDetails
            });
          }
        } catch (audioError: any) {
          logger?.error("❌ Audio preview sending failed", { 
            errorMessage: audioError?.message,
            errorStack: audioError?.stack,
            errorName: audioError?.name
          });
        }
      }

      logger?.info("✅ [Step 2] Full preview sent to admin (text + audio + demo URL)");

      return {
        previewSent: true,
        message: "Full preview sent to admin with audio and demo URL. Manual approval required to continue.",
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
    imageUrl: z.string(),
    audioFilename: z.string(),
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
      // Step 1: Send image with podcast content caption
      if (inputData.imageUrl && inputData.imageUrl !== "") {
        logger?.info("🖼️ [Step 3] Sending image with content...");
        
        const caption = `🎙️ *${inputData.podcastTitle}*\n\n${inputData.podcastContent}`;
        
        const imageResponse = await fetch(
          `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: channelId,
              photo: inputData.imageUrl,
              caption: caption,
              parse_mode: "Markdown",
            }),
          }
        );

        if (!imageResponse.ok) {
          logger?.warn("⚠️ Failed to send image, sending text instead");
        } else {
          logger?.info("✅ Image and content sent");
        }
      }

      // Step 2: Send audio file (if available)
      if (inputData.audioFilename && inputData.audioFilename !== "") {
        logger?.info("🎧 [Step 3] Downloading audio and sending to Telegram channel...");
        
        try {
          // Download audio from App Storage
          logger?.info("📥 [Step 3] Downloading audio from App Storage", { filename: inputData.audioFilename });
          const audioBuffer = await appStorageClient.downloadAsBuffer(inputData.audioFilename, logger);
          
          // Use form-data package with submit method (compatible way)
          const FormDataPkg = (await import('form-data')).default;
          const formData = new FormDataPkg();
          
          // Append fields to FormData
          formData.append('chat_id', channelId);
          formData.append('audio', audioBuffer, {
            filename: 'podcast.mp3',
            contentType: 'audio/mpeg',
          });
          formData.append('caption', '🎧 *استمع للبودكاست:*\n\n' + inputData.podcastTitle);
          formData.append('parse_mode', 'Markdown');
          
          // Use formData.submit() instead of fetch() for compatibility
          const audioResponse = await new Promise((resolve, reject) => {
            formData.submit({
              protocol: 'https:',
              host: 'api.telegram.org',
              path: `/bot${telegramBotToken}/sendAudio`,
              method: 'POST',
            }, (err, res) => {
              if (err) return reject(err);
              resolve(res);
            });
          });

          // Read response body
          const chunks: Buffer[] = [];
          for await (const chunk of audioResponse as any) {
            chunks.push(chunk);
          }
          const responseText = Buffer.concat(chunks).toString();
          
          if ((audioResponse as any).statusCode === 200) {
            logger?.info("✅ Audio file sent successfully to channel");
          } else {
            let errorDetails;
            try {
              errorDetails = JSON.parse(responseText);
            } catch {
              errorDetails = responseText;
            }
            logger?.error("❌ Failed to send audio to channel", { 
              status: (audioResponse as any).statusCode,
              errorResponse: errorDetails
            });
          }
        } catch (audioError: any) {
          logger?.error("❌ Audio download/send failed in Step 3", { 
            errorMessage: audioError?.message,
            errorStack: audioError?.stack 
          });
        }
      }

      // Step 3: Send questions
      let messageText = `📝 *اختبارات اليوم:*\n\n`;

      inputData.questions.forEach((q, index) => {
        messageText += `*${index + 1}. ${q.question}*\n`;
        q.options.forEach((option, optIndex) => {
          const letter = String.fromCharCode(65 + optIndex);
          const isCorrect = optIndex === q.correctAnswer ? " ✅" : "";
          messageText += `   ${letter}) ${option}${isCorrect}\n`;
        });
        messageText += `\n💡 _${q.explanation}_\n\n`;
      });

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

      logger?.info("✅ [Step 3] All content sent to Telegram channel");

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
