import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { appStorageClient } from "../storage/appStorageClient";
import { demoRepository } from "../storage/demoRepository";
import { Readable } from "stream";

/**
 * Lahajati Audio Generator Tool
 * 
 * Lahajati.ai API orqali matndan Arabic audio yaratadi va App Storage'ga saqlaydi
 * Har safar turli ovozlar (voices) bilan audio yaratadi
 */
export const generateLahajatiAudio = createTool({
  id: "generate-lahajati-audio",

  description:
    "Generates professional Arabic audio from text using Lahajati.ai API with varied voices and stores it in App Storage for podcast production.",

  inputSchema: z.object({
    text: z.string().describe("Arabic text content to convert to audio (with tashkeel)"),
    title: z.string().describe("Podcast title for filename generation"),
  }),

  outputSchema: z.object({
    audioUrl: z.string().describe("Public URL to the generated audio file"),
    audioBase64: z.string().describe("Base64-encoded audio data for direct delivery"),
    duration: z.number().describe("Audio duration in seconds (estimated)"),
    success: z.boolean().describe("Whether audio generation and storage was successful"),
    message: z.string().describe("Status message"),
    filename: z.string().optional().describe("Storage filename"),
    voiceId: z.string().optional().describe("Selected Lahajati voice ID"),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🎧 [generateLahajatiAudio] Starting audio generation and storage", {
      textLength: context.text.length,
      title: context.title,
    });

    try {
      const lahajatiApiKey = process.env.LAHAJATI_API_KEY;

      if (!lahajatiApiKey) {
        logger?.warn("⚠️ [generateLahajatiAudio] Lahajati API key not found");
        return {
          audioUrl: "",
          audioBase64: "",
          duration: 0,
          success: false,
          message: "Lahajati API key not configured. Please set LAHAJATI_API_KEY environment variable.",
        };
      }

      // Get current voice rotation state from database
      logger?.info("🔄 [generateLahajatiAudio] Fetching voice rotation state");
      const rotationState = await demoRepository.getVoiceRotationState(logger);
      
      let selectedVoiceId: string | null = null;
      let selectedVoiceName: string = "Unknown";
      let clonedVoices: Array<{ id_voice: string; display_name: string }> = [];
      
      try {
        // Fetch user's cloned voices from Lahajati API
        logger?.info("📡 [generateLahajatiAudio] Fetching user's cloned voices from Lahajati API");
        
        const voicesResponse = await fetch("https://lahajati.ai/api/v1/voices-absolute-control?per_page=50", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${lahajatiApiKey}`,
            "Accept": "application/json",
          },
        });

        if (voicesResponse.ok) {
          const voicesData = await voicesResponse.json();
          const allVoices = voicesData?.data || [];
          
          // Filter to get only cloned voices (user's own voices)
          clonedVoices = allVoices
            .filter((v: any) => v.is_cloned === true)
            .map((v: any) => ({
              id_voice: v.id_voice,
              display_name: v.display_name,
            }));
          
          if (clonedVoices.length > 0) {
            logger?.info("✅ [generateLahajatiAudio] Found cloned voices", {
              totalClonedVoices: clonedVoices.length,
              voices: clonedVoices.map(v => v.display_name).join(", "),
            });
            
            // Calculate next voice index (round-robin rotation)
            const currentIndex = rotationState.lastUsedVoiceIndex || 0;
            const nextIndex = (currentIndex + 1) % clonedVoices.length;
            
            // Select next voice in rotation
            const selectedVoice = clonedVoices[nextIndex];
            selectedVoiceId = selectedVoice.id_voice;
            selectedVoiceName = selectedVoice.display_name;
            
            logger?.info("🎤 [generateLahajatiAudio] Voice selected via rotation", {
              voiceId: selectedVoiceId,
              voiceName: selectedVoiceName,
              currentIndex,
              nextIndex,
              totalVoices: clonedVoices.length,
            });
            
            // Update rotation state for next run
            await demoRepository.updateVoiceRotationState(nextIndex, clonedVoices, logger);
            
          } else {
            logger?.warn("⚠️ [generateLahajatiAudio] No cloned voices found, using default");
            selectedVoiceId = "rXBH9gG2s34pMDKFrPXcrKDf"; // Umidjon (fallback)
            selectedVoiceName = "Umidjon";
          }
        } else {
          logger?.warn("⚠️ [generateLahajatiAudio] API request failed, using cached voices");
          
          // Use cached voices from database if API fails
          const cachedVoices = rotationState.cachedVoices || [];
          if (cachedVoices.length > 0) {
            const currentIndex = rotationState.lastUsedVoiceIndex || 0;
            const nextIndex = (currentIndex + 1) % cachedVoices.length;
            
            const selectedVoice = cachedVoices[nextIndex];
            selectedVoiceId = selectedVoice.id_voice;
            selectedVoiceName = selectedVoice.display_name;
            
            logger?.info("🎤 [generateLahajatiAudio] Using cached voice", {
              voiceId: selectedVoiceId,
              voiceName: selectedVoiceName,
            });
            
            await demoRepository.updateVoiceRotationState(nextIndex, undefined, logger);
          } else {
            selectedVoiceId = "rXBH9gG2s34pMDKFrPXcrKDf"; // Umidjon (fallback)
            selectedVoiceName = "Umidjon";
          }
        }
      } catch (error) {
        logger?.warn("⚠️ [generateLahajatiAudio] Error in voice rotation logic, using fallback", { error });
        selectedVoiceId = "rXBH9gG2s34pMDKFrPXcrKDf"; // Umidjon (fallback)
        selectedVoiceName = "Umidjon";
      }

      // Final fallback to known cloned voice
      if (!selectedVoiceId) {
        selectedVoiceId = "rXBH9gG2s34pMDKFrPXcrKDf"; // Umidjon (user's cloned voice)
        selectedVoiceName = "Umidjon";
        logger?.info("🎤 [generateLahajatiAudio] Using final fallback voice", {
          voiceId: selectedVoiceId,
          voiceName: selectedVoiceName,
        });
      }

      // Fetch performance styles and dialects for Absolute Control
      let performanceId = "1795"; // Default: Radio news reader (professional, clear)
      let dialectId = "1"; // Default: Modern Standard Arabic
      
      try {
        // Try to fetch available performance styles
        const perfResponse = await fetch("https://lahajati.ai/api/v1/performance-absolute-control", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${lahajatiApiKey}`,
            "Accept": "application/json",
          },
        });
        
        if (perfResponse.ok) {
          const perfData = await perfResponse.json();
          const performances = perfData?.data || [];
          if (performances.length > 0) {
            // Prefer educational/professional styles (news reader, clear speech)
            const preferred = performances.find((p: any) => 
              p.performance_id === 1795 || // Radio news reader
              p.display_name?.includes("إخبار") || 
              p.display_name?.includes("واضح")
            );
            performanceId = String(preferred?.performance_id || performances[0].performance_id);
            logger?.info("📻 [generateLahajatiAudio] Performance style selected", {
              performanceId,
              name: preferred?.display_name || performances[0].display_name,
            });
          }
        }
      } catch (error) {
        logger?.warn("⚠️ [generateLahajatiAudio] Using default performance style", { error });
      }

      logger?.info("📡 [generateLahajatiAudio] Calling Lahajati TTS API", {
        voiceId: selectedVoiceId,
        performanceId,
        dialectId,
        textLength: context.text.length,
      });

      // Call Lahajati Text-to-Speech Absolute Control API
      const response = await fetch("https://lahajati.ai/api/v1/text-to-speech-absolute-control", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lahajatiApiKey}`,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: context.text,
          id_voice: selectedVoiceId,
          input_mode: "0", // Structured mode
          performance_id: performanceId,
          dialect_id: dialectId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger?.error("❌ [generateLahajatiAudio] API request failed", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });

        // Return error to let workflow handle fallback to ElevenLabs
        return {
          audioUrl: "",
          audioBase64: "",
          duration: 0,
          success: false,
          message: `Lahajati API error (${response.status}): ${errorText}. Workflow will fallback to ElevenLabs.`,
        };
      }

      logger?.info("📦 [generateLahajatiAudio] Audio response received, processing...");

      // Get audio buffer from response
      const audioArrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(audioArrayBuffer);

      logger?.info("📦 [generateLahajatiAudio] Audio buffered:", { size: audioBuffer.length });

      // Convert buffer to base64 for Telegram delivery
      const audioBase64 = audioBuffer.toString("base64");
      logger?.info("📦 [generateLahajatiAudio] Audio converted to base64 for delivery");

      // Convert buffer to Node.js Readable stream
      const nodeStream = Readable.from(audioBuffer);

      // Upload audio stream to App Storage
      const { url, filename } = await appStorageClient.uploadAudioStream(
        nodeStream,
        context.title,
        logger
      );

      const estimatedDuration = Math.ceil(context.text.length / 10); // ~10 characters per second

      logger?.info("✅ [generateLahajatiAudio] Audio generated and stored successfully", {
        filename,
        url,
        estimatedDuration,
        base64Length: audioBase64.length,
        voiceId: selectedVoiceId,
      });

      return {
        audioUrl: url,
        audioBase64,
        duration: estimatedDuration,
        success: true,
        message: `Audio generated successfully via Lahajati.ai using cloned voice "${selectedVoiceName}" and stored in App Storage`,
        filename,
        voiceId: String(selectedVoiceId),
      };
    } catch (error) {
      logger?.error("❌ [generateLahajatiAudio] Error generating/storing audio", { error });

      return {
        audioUrl: "",
        audioBase64: "",
        duration: 0,
        success: false,
        message: `Audio generation/storage failed: ${error}`,
      };
    }
  },
});
