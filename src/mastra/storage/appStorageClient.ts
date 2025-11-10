import { Client } from "@replit/object-storage";
import { Readable } from "stream";

/**
 * App Storage Client for managing audio files
 */
class AppStorageClient {
  private client: Client;
  private initialized: boolean = false;
  private bucketName: string = "audio-files";

  constructor() {
    // Initialize client with our specific bucket ID
    // Note: bucketId can be found in App Storage panel or use bucket name
    this.client = new Client({
      bucketId: this.bucketName,
    });
  }

  /**
   * Initialize the App Storage client with specific bucket
   */
  async init(): Promise<void> {
    if (!this.initialized) {
      // Client auto-initializes on first use
      // Just set bucket via environment or constructor
      this.initialized = true;
    }
  }

  /**
   * Upload audio stream to App Storage
   * @param audioStream - Readable stream from ElevenLabs
   * @param podcastTitle - Title for generating filename
   * @returns Public URL to the uploaded audio file
   */
  async uploadAudioStream(
    audioStream: Readable,
    podcastTitle: string,
    logger?: any
  ): Promise<{ url: string; filename: string }> {
    try {
      // Ensure client is initialized
      await this.init();

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, "-");
      const slug = podcastTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .substring(0, 50);
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, "0");
      const filename = `audio/${year}/${month}/${slug}-${timestamp}.mp3`;

      // Upload stream to App Storage
      logger?.info("📤 Uploading to bucket:", this.bucketName);
      await this.client.uploadFromStream(filename, audioStream);
      logger?.info("✅ Upload complete");

      // Generate public URL for App Storage
      // Pattern: https://<domain>/_app_storage/<bucket-name>/<filename>
      const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
      
      if (!domain) {
        // Local development fallback
        const url = `http://localhost:5000/_app_storage/${this.bucketName}/${filename}`;
        logger?.info("📍 Local public URL generated:", url);
        return { url, filename };
      }
      
      const url = `https://${domain}/_app_storage/${this.bucketName}/${filename}`;
      logger?.info("📍 Public URL generated:", url);
      return { url, filename };
    } catch (error) {
      throw new Error(`Failed to upload audio to App Storage: ${error}`);
    }
  }

  /**
   * Check if a file exists in App Storage
   */
  async exists(filename: string): Promise<boolean> {
    await this.init();
    const result = await this.client.exists(filename);
    return result.ok ? result.value : false;
  }

  /**
   * Delete a file from App Storage
   */
  async delete(filename: string): Promise<boolean> {
    await this.init();
    const result = await this.client.delete(filename);
    return result.ok;
  }
}

// Singleton instance
export const appStorageClient = new AppStorageClient();
