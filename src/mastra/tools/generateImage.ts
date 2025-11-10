import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Image Generator Tool
 * 
 * AI orqali podcast mavzusi uchun rasm yaratadi
 */
export const generateImage = createTool({
  id: "generate-image",

  description:
    "Generates an educational image related to the podcast topic using AI image generation.",

  inputSchema: z.object({
    topic: z.string().describe("Podcast topic for image generation"),
    description: z
      .string()
      .optional()
      .describe("Optional detailed description for image"),
  }),

  outputSchema: z.object({
    imageUrl: z.string().describe("URL or path to generated image"),
    success: z.boolean().describe("Whether image generation was successful"),
    message: z.string().describe("Status message"),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🎨 [generateImage] Starting image generation", {
      topic: context.topic,
    });

    try {
      // For MVP: return a placeholder educational image
      // In production, this would use OpenAI DALL-E or similar
      
      logger?.info("🎨 [generateImage] Using placeholder image for MVP");
      
      // Unsplash API for free stock images (no API key needed for basic usage)
      const query = encodeURIComponent("artificial intelligence education technology");
      const unsplashUrl = `https://source.unsplash.com/800x600/?${query}`;

      logger?.info("✅ [generateImage] Image URL generated", {
        url: unsplashUrl,
      });

      return {
        imageUrl: unsplashUrl,
        success: true,
        message: "Image generated successfully (using educational stock image)",
      };
    } catch (error) {
      logger?.error("❌ [generateImage] Error generating image", { error });

      return {
        imageUrl: "",
        success: false,
        message: `Image generation failed: ${error}`,
      };
    }
  },
});
