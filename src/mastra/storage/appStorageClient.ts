import { Client } from "@replit/object-storage";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";

/**
 * App Storage Client for managing audio files
 * Supports both Replit Object Storage and Railway file system
 */
class AppStorageClient {
  private client: Client | null = null;
  private initialized: boolean = false;
  private bucketId: string = "replit-objstore-f00a83e7-474d-4079-93c4-d7b576bbad69";
  private bucketName: string = "audio-files";
  private useFileSystem: boolean;
  private storageDir: string = "/tmp/audio"; // Railway storage directory

  constructor() {
    // Use file system storage on Railway (NODE_ENV=production without Replit)
    // Use Replit Object Storage on Replit
    this.useFileSystem = process.env.NODE_ENV === "production" && !process.env.REPLIT_DEPLOYMENT;
    
    if (this.useFileSystem) {
      // Ensure storage directory exists
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } else {
      // Initialize Replit Object Storage client
      this.client = new Client({
        bucketId: this.bucketId,
      });
    }
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
   * Upload audio stream to storage (Replit Object Storage or Railway file system)
   * @param audioStream - Readable stream from ElevenLabs/Lahajati
   * @param podcastTitle - Title for generating filename
   * @returns Storage path to the uploaded audio file
   */
  async uploadAudioStream(
    audioStream: Readable,
    podcastTitle: string,
    logger?: any
  ): Promise<{ url: string; filename: string }> {
    try {
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

      if (this.useFileSystem) {
        // Railway: Save to file system
        logger?.info("📤 [Railway] Uploading to file system:", filename);
        
        const fullPath = path.join(this.storageDir, filename);
        const dir = path.dirname(fullPath);
        
        // Ensure directory exists
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Convert stream to buffer and save
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
          audioStream.on('end', () => resolve());
          audioStream.on('error', (error) => reject(error));
        });
        
        const buffer = Buffer.concat(chunks);
        fs.writeFileSync(fullPath, buffer);
        
        logger?.info("✅ [Railway] Upload complete to file system:", { path: fullPath, size: buffer.length });
        
        // Return file path as storage reference
        return { url: fullPath, filename };
      } else {
        // Replit: Save to Object Storage
        logger?.info("📤 [Replit] Uploading to Object Storage:", this.bucketName);
        
        if (!this.client) {
          throw new Error("Replit Object Storage client not initialized");
        }
        
        await this.client.uploadFromStream(filename, audioStream);
        logger?.info("✅ [Replit] Upload complete");

        // Generate public URL for App Storage
        const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
        
        if (!domain) {
          const url = `http://localhost:5000/_app_storage/${this.bucketId}/${filename}`;
          logger?.info("📍 Local public URL generated:", url);
          return { url, filename };
        }
        
        const url = `https://${domain}/_app_storage/${this.bucketId}/${filename}`;
        logger?.info("📍 Public URL generated:", url);
        return { url, filename };
      }
    } catch (error) {
      throw new Error(`Failed to upload audio to storage: ${error}`);
    }
  }

  /**
   * Check if a file exists in storage
   */
  async exists(filename: string): Promise<boolean> {
    await this.init();
    
    if (this.useFileSystem) {
      const fullPath = path.join(this.storageDir, filename);
      return fs.existsSync(fullPath);
    } else {
      if (!this.client) return false;
      const result = await this.client.exists(filename);
      return result.ok ? result.value : false;
    }
  }

  /**
   * Delete a file from storage
   */
  async delete(filename: string): Promise<boolean> {
    await this.init();
    
    if (this.useFileSystem) {
      const fullPath = path.join(this.storageDir, filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
      }
      return false;
    } else {
      if (!this.client) return false;
      const result = await this.client.delete(filename);
      return result.ok;
    }
  }

  /**
   * Download a file from storage as Buffer
   * @param filenameOrPath - Filename for Replit, full path for Railway
   */
  async downloadAsBuffer(filenameOrPath: string, logger?: any): Promise<Buffer> {
    await this.init();
    
    if (this.useFileSystem) {
      // Railway: Read from file system
      // filenameOrPath is already a full path like /tmp/audio/audio/2025/11/...
      logger?.info("📥 [Railway] Reading from file system:", filenameOrPath);
      
      if (!fs.existsSync(filenameOrPath)) {
        throw new Error(`File not found: ${filenameOrPath}`);
      }
      
      const buffer = fs.readFileSync(filenameOrPath);
      logger?.info("✅ [Railway] Read from file system:", { size: buffer.length });
      return buffer;
    } else {
      // Replit: Download from Object Storage
      logger?.info("📥 [Replit] Downloading from Object Storage:", filenameOrPath);
      
      if (!this.client) {
        throw new Error("Replit Object Storage client not initialized");
      }
      
      const stream = await this.client.downloadAsStream(filenameOrPath);
      
      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          logger?.info("✅ [Replit] Downloaded from Object Storage:", { size: buffer.length });
          resolve(buffer);
        });
        
        stream.on('error', (error) => {
          logger?.error("❌ Failed to download from Object Storage:", error);
          reject(error);
        });
      });
    }
  }
}

// Singleton instance
export const appStorageClient = new AppStorageClient();
