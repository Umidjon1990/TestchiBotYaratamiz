import { Client } from "@replit/object-storage";
import { Readable } from "stream";

/**
 * App Storage Client for managing audio files
 */
class AppStorageClient {
  private client: Client;
  private initialized: boolean = false;
  // Actual bucket ID from App Storage Settings
  private bucketId: string = "replit-objstore-f00a83e7-474d-4079-93c4-d7b576bbad69";
  private bucketName: string = "audio-files"; // Display name for URLs

  constructor() {
    // Initialize client with actual bucket ID from App Storage
    this.client = new Client({
      bucketId: this.bucketId,
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
      // Pattern: https://<domain>/_app_storage/<bucket-id>/<filename>
      const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
      
      if (!domain) {
        // Local development fallback
        const url = `http://localhost:5000/_app_storage/${this.bucketId}/${filename}`;
        logger?.info("📍 Local public URL generated:", url);
        return { url, filename };
      }
      
      const url = `https://${domain}/_app_storage/${this.bucketId}/${filename}`;
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

  /**
   * Download a file from App Storage as Buffer
   */
  async downloadAsBuffer(filename: string, logger?: any): Promise<Buffer> {
    await this.init();
    logger?.info("📥 Downloading from App Storage:", filename);
    
    const stream = await this.client.downloadAsStream(filename);
    
    // Convert Node.js Readable stream to buffer
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        logger?.info("✅ Downloaded from App Storage:", { size: buffer.length });
        resolve(buffer);
      });
      
      stream.on('error', (error) => {
        logger?.error("❌ Failed to download from App Storage:", error);
        reject(error);
      });
    });
  }
}

// Singleton instance
export const appStorageClient = new AppStorageClient();
