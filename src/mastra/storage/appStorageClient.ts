import { Client } from "@replit/object-storage";
import { Readable } from "stream";

/**
 * App Storage Client for managing audio files
 */
class AppStorageClient {
  private client: Client;
  private initialized: boolean = false;

  constructor() {
    this.client = new Client();
  }

  /**
   * Initialize the App Storage client
   */
  async init(): Promise<void> {
    if (!this.initialized) {
      // Client is auto-initialized, just mark as ready
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
    podcastTitle: string
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
      await this.client.uploadFromStream(filename, audioStream);

      // Generate public URL
      // Note: Replit App Storage automatically serves files at a public URL
      // The URL pattern is: https://<repl-name>.<username>.repl.co/<bucket-name>/<filename>
      const url = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost'}/${filename}`;

      return { url: `https://${url}`, filename };
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
