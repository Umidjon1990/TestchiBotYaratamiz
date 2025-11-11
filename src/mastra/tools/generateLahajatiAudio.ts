import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { appStorageClient } from "../storage/appStorageClient";
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

      // Lahajati public voice library IDs (from web interface)
      // These are free voices available in the Voice Library
      const publicVoiceIds = [
        1408, // بدر (Badr) - male
        1409, // جابر (Jabir) - male
        1395, // عازم (Azim) - male
        1398, // فرح (Farah) - female
        1410, // منيرة (Munira) - female
        1411, // رحمة (Rahma) - female
        1405, // بهجت (Bahjat) - male
        1402, // موسى (Musa) - male
      ];

      // Randomly select a voice from the public library
      const selectedVoiceId = publicVoiceIds[Math.floor(Math.random() * publicVoiceIds.length)];

      logger?.info("📡 [generateLahajatiAudio] Calling Lahajati TTS API", {
        voiceId: selectedVoiceId,
        textLength: context.text.length,
      });

      // Call Lahajati Text-to-Speech Pro API
      const response = await fetch("https://lahajati.ai/api/v1/text-to-speech-pro", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lahajatiApiKey}`,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: context.text,
          id_voice: selectedVoiceId,
          version: "lahajati_text_to_speech_pro_v1",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger?.error("❌ [generateLahajatiAudio] API request failed", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });

        return {
          audioUrl: "",
          audioBase64: "",
          duration: 0,
          success: false,
          message: `Lahajati API error: ${response.status} ${response.statusText}`,
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
        message: `Audio generated successfully via Lahajati.ai (${selectedVoiceId}) and stored in App Storage`,
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
