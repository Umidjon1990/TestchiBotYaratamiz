import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Audio Generator Tool
 * 
 * ElevenLabs API orqali matndan professional audio yaratadi
 */
export const generateAudio = createTool({
  id: "generate-audio",

  description:
    "Generates professional audio from text using ElevenLabs API for podcast production.",

  inputSchema: z.object({
    text: z.string().describe("Text content to convert to audio"),
    voiceId: z
      .string()
      .optional()
      .describe("ElevenLabs voice ID (optional, uses default if not provided)"),
  }),

  outputSchema: z.object({
    audioUrl: z.string().describe("URL or path to generated audio file"),
    duration: z.number().describe("Audio duration in seconds (estimated)"),
    success: z.boolean().describe("Whether audio generation was successful"),
    message: z.string().describe("Status message"),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🎧 [generateAudio] Starting audio generation", {
      textLength: context.text.length,
      voiceId: context.voiceId || "default",
    });

    try {
      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

      if (!elevenLabsApiKey) {
        logger?.warn(
          "⚠️ [generateAudio] ElevenLabs API key not found, returning mock audio"
        );
        return {
          audioUrl: "https://example.com/mock-podcast-audio.mp3",
          duration: 120,
          success: false,
          message:
            "ElevenLabs API key not configured. Please set ELEVENLABS_API_KEY environment variable.",
        };
      }

      // ElevenLabs API integration
      const voiceId = context.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Default voice

      logger?.info("📡 [generateAudio] Calling ElevenLabs API", { voiceId });

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": elevenLabsApiKey,
          },
          body: JSON.stringify({
            text: context.text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger?.error("❌ [generateAudio] ElevenLabs API error", {
          status: response.status,
          error: errorText,
        });
        throw new Error(
          `ElevenLabs API error: ${response.status} - ${errorText}`
        );
      }

      // Audio faylni saqlash (bu yerda temporary storage)
      const audioBuffer = await response.arrayBuffer();
      const audioBlob = Buffer.from(audioBuffer);

      // Real implementation'da faylni object storage yoki CDN ga yuklash kerak
      // Hozircha mock URL qaytaramiz
      const estimatedDuration = Math.ceil(context.text.length / 10); // ~10 characters per second

      logger?.info("✅ [generateAudio] Audio generated successfully", {
        size: audioBlob.length,
        estimatedDuration,
      });

      return {
        audioUrl: "https://storage.example.com/podcast-audio.mp3",
        duration: estimatedDuration,
        success: true,
        message: "Audio generated successfully via ElevenLabs",
      };
    } catch (error) {
      logger?.error("❌ [generateAudio] Error generating audio", { error });

      return {
        audioUrl: "",
        duration: 0,
        success: false,
        message: `Audio generation failed: ${error}`,
      };
    }
  },
});
