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
    audioBase64: z.string().describe("Base64-encoded audio data for direct delivery"),
    duration: z.number().describe("Audio duration in seconds (estimated)"),
    success: z.boolean().describe("Whether audio generation and storage was successful"),
    message: z.string().describe("Status message"),
    filename: z.string().optional().describe("Storage filename"),
    voiceName: z.string().optional().describe("Selected voice name"),
    voiceGender: z.string().optional().describe("Selected voice gender"),
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
          audioBase64: "",
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

      // Arabic voices collection - different speakers for variety
      const arabicVoices = [
        { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "male" },
        { id: "pqHfZKP75CvOlQylNhV4", name: "Bill", gender: "male" },
        { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", gender: "female" },
        { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", gender: "female" },
        { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", gender: "female" },
        { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", gender: "female" },
      ];

      let selectedVoice: { id: string; name: string; gender: string };
      let voiceId: string;

      if (context.voiceId) {
        // User provided a specific voiceId - honor it even if not in our list
        const knownVoice = arabicVoices.find(v => v.id === context.voiceId);
        if (knownVoice) {
          selectedVoice = knownVoice;
        } else {
          // Custom voice not in our list
          selectedVoice = { id: context.voiceId, name: "Custom", gender: "custom" };
          logger?.info("🎤 Using custom voice ID not in curated list", { voiceId: context.voiceId });
        }
        voiceId = context.voiceId;
      } else {
        // Randomly select from curated voices
        selectedVoice = arabicVoices[Math.floor(Math.random() * arabicVoices.length)];
        voiceId = selectedVoice.id;
      }

      logger?.info("📡 [generateAudio] Calling ElevenLabs API", { 
        voiceId,
        voiceName: selectedVoice.name,
        gender: selectedVoice.gender,
      });

      // Generate audio with streaming
      const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
        text: context.text,
        modelId: "eleven_multilingual_v2", // يدعم اللغة العربية
        outputFormat: "mp3_44100_128",
      });

      logger?.info("📦 [generateAudio] Audio stream received, buffering and uploading to App Storage...");

      // Buffer the audio stream (ElevenLabs returns web ReadableStream)
      const chunks: Uint8Array[] = [];
      const reader = audioStream.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      
      const audioBuffer = Buffer.concat(chunks);
      logger?.info("📦 Audio buffered:", { size: audioBuffer.length });
      
      // Convert buffer to base64 for Telegram delivery
      const audioBase64 = audioBuffer.toString('base64');
      logger?.info("📦 Audio converted to base64 for delivery");
      
      // Convert buffer to Node.js Readable stream
      const nodeStream = Readable.from(audioBuffer);

      // Upload audio stream to App Storage
      const { url, filename } = await appStorageClient.uploadAudioStream(
        nodeStream,
        context.title,
        logger
      );

      const estimatedDuration = Math.ceil(context.text.length / 10); // ~10 characters per second

      logger?.info("✅ [generateAudio] Audio generated and stored successfully", {
        filename,
        url,
        estimatedDuration,
        base64Length: audioBase64.length,
        voice: `${selectedVoice.name} (${selectedVoice.gender})`,
      });

      return {
        audioUrl: url,
        audioBase64,
        duration: estimatedDuration,
        success: true,
        message: `Audio generated successfully via ElevenLabs (${selectedVoice.name}) and stored in App Storage`,
        filename,
        voiceName: selectedVoice.name,
        voiceGender: selectedVoice.gender,
      };
    } catch (error) {
      logger?.error("❌ [generateAudio] Error generating/storing audio", { error });

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
