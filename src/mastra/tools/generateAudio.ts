import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { appStorageClient } from "../storage/appStorageClient";
import { Readable } from "stream";

/**
 * Audio Generator Tool
 * 
 * ElevenLabs API orqali matndan professional audio yaratadi va App Storage'ga saqlaydi
 */
export const generateAudio = createTool({
  id: "generate-audio",

  description:
    "Generates professional Arabic audio from text using ElevenLabs API and stores it in App Storage for podcast production.",

  inputSchema: z.object({
    text: z.string().describe("Text content to convert to audio (Arabic with harakats)"),
    title: z.string().describe("Podcast title for filename generation"),
    voiceId: z
      .string()
      .optional()
      .describe("ElevenLabs voice ID (optional, uses Arabic voice if not provided)"),
  }),

  outputSchema: z.object({
    audioUrl: z.string().describe("Public URL to the generated audio file"),
    duration: z.number().describe("Audio duration in seconds (estimated)"),
    success: z.boolean().describe("Whether audio generation and storage was successful"),
    message: z.string().describe("Status message"),
    filename: z.string().optional().describe("Storage filename"),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🎧 [generateAudio] Starting audio generation and storage", {
      textLength: context.text.length,
      title: context.title,
      voiceId: context.voiceId || "default-arabic",
    });

    try {
      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

      if (!elevenLabsApiKey) {
        logger?.warn(
          "⚠️ [generateAudio] ElevenLabs API key not found"
        );
        return {
          audioUrl: "",
          duration: 0,
          success: false,
          message:
            "ElevenLabs API key not configured. Please set ELEVENLABS_API_KEY environment variable.",
        };
      }

      // Initialize ElevenLabs client
      const elevenlabs = new ElevenLabsClient({
        apiKey: elevenLabsApiKey,
      });

      // استخدام صوت عربي - George (صوت واضح للمحتوى التعليمي)
      const voiceId = context.voiceId || "JBFqnCBsd6RMkjVDRZzb"; // George - Arabic educational voice

      logger?.info("📡 [generateAudio] Calling ElevenLabs API", { voiceId });

      // Generate audio with streaming
      const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
        text: context.text,
        modelId: "eleven_multilingual_v2", // يدعم اللغة العربية
        outputFormat: "mp3_44100_128",
      });

      logger?.info("📦 [generateAudio] Audio stream received, uploading to App Storage...");

      // Upload audio stream to App Storage
      const { url, filename } = await appStorageClient.uploadAudioStream(
        audioStream as Readable,
        context.title
      );

      const estimatedDuration = Math.ceil(context.text.length / 10); // ~10 characters per second

      logger?.info("✅ [generateAudio] Audio generated and stored successfully", {
        filename,
        url,
        estimatedDuration,
      });

      return {
        audioUrl: url,
        duration: estimatedDuration,
        success: true,
        message: "Audio generated successfully via ElevenLabs and stored in App Storage",
        filename,
      };
    } catch (error) {
      logger?.error("❌ [generateAudio] Error generating/storing audio", { error });

      return {
        audioUrl: "",
        duration: 0,
        success: false,
        message: `Audio generation/storage failed: ${error}`,
      };
    }
  },
});
