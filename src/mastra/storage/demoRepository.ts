import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import { pgPool } from "./index";
import * as schema from "../../../shared/schema";
import { randomBytes } from "crypto";

// Create Drizzle client from pg Pool
const db = drizzle(pgPool, { schema });

export interface CreateDemoSessionInput {
  podcastTitle: string;
  podcastContent: string;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>;
  imageUrl: string;
  audioUrl: string;
  audioStoragePath?: string;
  contentType?: string;
  level?: string;
  topic?: string;
  audioProvider?: string;
}

export interface UpdateDemoSessionInput {
  podcastTitle?: string;
  podcastContent?: string;
  imageUrl?: string;
  questions?: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>;
}

/**
 * Demo Repository
 * Handles all database operations for demo content
 */
export const demoRepository = {
  /**
   * Create a new demo session
   */
  async createDemoSession(input: CreateDemoSessionInput, logger?: any) {
    logger?.info("📝 [DemoRepository] Creating new demo session", {
      title: input.podcastTitle,
    });

    try {
      // Generate unique slug
      const slug = `demo-${Date.now()}-${randomBytes(4).toString("hex")}`;

      const [newDemo] = await db
        .insert(schema.demoSessions)
        .values({
          slug,
          podcastTitle: input.podcastTitle,
          podcastContent: input.podcastContent,
          questions: input.questions,
          imageUrl: input.imageUrl,
          audioUrl: input.audioUrl,
          audioStoragePath: input.audioStoragePath || null,
          contentType: input.contentType || "podcast",
          level: input.level || "B1",
          topic: input.topic || null,
          audioProvider: input.audioProvider || "elevenlabs",
          status: "draft",
        })
        .returning();

      logger?.info("✅ [DemoRepository] Demo session created", {
        id: newDemo.id,
        slug: newDemo.slug,
      });

      return newDemo;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error creating demo session", {
        error,
      });
      throw error;
    }
  },

  /**
   * Get demo session by slug
   */
  async getDemoBySlug(slug: string, logger?: any) {
    logger?.info("🔍 [DemoRepository] Fetching demo by slug", { slug });

    try {
      const [demo] = await db
        .select()
        .from(schema.demoSessions)
        .where(eq(schema.demoSessions.slug, slug))
        .limit(1);

      if (demo) {
        logger?.info("✅ [DemoRepository] Demo found", { id: demo.id });
      } else {
        logger?.warn("⚠️ [DemoRepository] Demo not found", { slug });
      }

      return demo || null;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error fetching demo", { error });
      throw error;
    }
  },

  /**
   * Update demo session
   */
  async updateDemoSession(
    slug: string,
    updates: UpdateDemoSessionInput,
    editedBy: string,
    logger?: any
  ) {
    logger?.info("📝 [DemoRepository] Updating demo session", {
      slug,
      updates: Object.keys(updates),
    });

    try {
      // Get current demo for revision history
      const currentDemo = await this.getDemoBySlug(slug, logger);
      if (!currentDemo) {
        throw new Error(`Demo not found: ${slug}`);
      }

      // Update demo
      const [updatedDemo] = await db
        .update(schema.demoSessions)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(schema.demoSessions.slug, slug))
        .returning();

      // Create revision records for each changed field
      const revisionPromises = Object.entries(updates).map(([field, newValue]) => {
        const oldValue = currentDemo[field as keyof typeof currentDemo];
        return db.insert(schema.demoRevisions).values({
          demoId: currentDemo.id,
          field,
          oldValue: oldValue ? String(oldValue) : null,
          newValue: newValue ? String(newValue) : null,
          editedBy,
        });
      });

      await Promise.all(revisionPromises);

      logger?.info("✅ [DemoRepository] Demo session updated", {
        id: updatedDemo.id,
        revisionsCreated: revisionPromises.length,
      });

      return updatedDemo;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error updating demo", { error });
      throw error;
    }
  },

  /**
   * Update demo status by slug
   */
  async updateDemoStatus(
    slug: string,
    status: "draft" | "approved" | "rejected" | "posted",
    logger?: any
  ) {
    logger?.info("🔄 [DemoRepository] Updating demo status", { slug, status });

    try {
      const [updatedDemo] = await db
        .update(schema.demoSessions)
        .set({ status, updatedAt: new Date() })
        .where(eq(schema.demoSessions.slug, slug))
        .returning();

      logger?.info("✅ [DemoRepository] Status updated", {
        id: updatedDemo.id,
        status,
      });

      return updatedDemo;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error updating status", { error });
      throw error;
    }
  },

  /**
   * Update demo status by ID
   */
  async updateDemoStatusById(
    id: number,
    status: "draft" | "approved" | "rejected" | "posted",
    logger?: any
  ) {
    logger?.info("🔄 [DemoRepository] Updating demo status by ID", { id, status });

    try {
      const [updatedDemo] = await db
        .update(schema.demoSessions)
        .set({ status, updatedAt: new Date() })
        .where(eq(schema.demoSessions.id, id))
        .returning();

      logger?.info("✅ [DemoRepository] Status updated", {
        id: updatedDemo.id,
        status,
      });

      return updatedDemo;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error updating status", { error });
      throw error;
    }
  },

  /**
   * Get all demos (for admin)
   */
  async listDemos(limit = 10, logger?: any) {
    logger?.info("📋 [DemoRepository] Listing demos", { limit });

    try {
      const demos = await db
        .select()
        .from(schema.demoSessions)
        .orderBy(schema.demoSessions.createdAt)
        .limit(limit);

      logger?.info("✅ [DemoRepository] Demos listed", { count: demos.length });

      return demos;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error listing demos", { error });
      throw error;
    }
  },

  /**
   * Get demos by content type (listening/reading)
   */
  async listDemosByContentType(contentType: string, limit = 20, logger?: any) {
    logger?.info("📋 [DemoRepository] Listing demos by content type", { contentType, limit });

    try {
      const demos = await db
        .select()
        .from(schema.demoSessions)
        .where(eq(schema.demoSessions.contentType, contentType))
        .orderBy(schema.demoSessions.createdAt)
        .limit(limit);

      logger?.info("✅ [DemoRepository] Demos listed by content type", { 
        contentType, 
        count: demos.length 
      });

      return demos;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error listing demos by content type", { error });
      throw error;
    }
  },

  /**
   * Get demos by content type and level (listening/reading + A1/A2/B1/B2)
   */
  async listDemosByContentTypeAndLevel(contentType: string, level: string, limit = 20, logger?: any) {
    logger?.info("📋 [DemoRepository] Listing demos by content type and level", { contentType, level, limit });

    try {
      const demos = await db
        .select()
        .from(schema.demoSessions)
        .where(
          and(
            eq(schema.demoSessions.contentType, contentType),
            eq(schema.demoSessions.level, level)
          )
        )
        .orderBy(schema.demoSessions.createdAt)
        .limit(limit);

      logger?.info("✅ [DemoRepository] Demos listed by content type and level", { 
        contentType,
        level, 
        count: demos.length 
      });

      return demos;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error listing demos by content type and level", { error });
      throw error;
    }
  },

  /**
   * Get demo by ID
   */
  async getDemoById(id: number, logger?: any) {
    logger?.info("🔍 [DemoRepository] Fetching demo by ID", { id });

    try {
      const [demo] = await db
        .select()
        .from(schema.demoSessions)
        .where(eq(schema.demoSessions.id, id))
        .limit(1);

      if (demo) {
        logger?.info("✅ [DemoRepository] Demo found", { id: demo.id });
      } else {
        logger?.warn("⚠️ [DemoRepository] Demo not found", { id });
      }

      return demo || null;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error fetching demo by ID", { error });
      throw error;
    }
  },

  /**
   * Create a new custom content (user-uploaded text + audio)
   */
  async createCustomContent(input: {
    title: string;
    textContent: string;
    audioFileId?: string;
    audioUrl: string;
    audioStoragePath?: string;
    questions: Array<{
      question: string;
      options: string[];
      correctAnswer: number;
      explanation: string;
    }>;
    level?: string;
  }, logger?: any) {
    logger?.info("📝 [DemoRepository] Creating new custom content", {
      title: input.title,
    });

    try {
      const slug = `custom-${Date.now()}-${randomBytes(4).toString("hex")}`;

      const [newContent] = await db
        .insert(schema.customContent)
        .values({
          slug,
          title: input.title,
          textContent: input.textContent,
          audioFileId: input.audioFileId || null,
          audioUrl: input.audioUrl,
          audioStoragePath: input.audioStoragePath || null,
          questions: input.questions,
          level: input.level || "B1",
          status: "draft",
        })
        .returning();

      logger?.info("✅ [DemoRepository] Custom content created", {
        id: newContent.id,
        slug: newContent.slug,
      });

      return newContent;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error creating custom content", { error });
      throw error;
    }
  },

  /**
   * Get custom content by slug
   */
  async getCustomContentBySlug(slug: string, logger?: any) {
    logger?.info("🔍 [DemoRepository] Fetching custom content by slug", { slug });

    try {
      const [content] = await db
        .select()
        .from(schema.customContent)
        .where(eq(schema.customContent.slug, slug))
        .limit(1);

      if (content) {
        logger?.info("✅ [DemoRepository] Custom content found", { slug });
      } else {
        logger?.warn("⚠️ [DemoRepository] Custom content not found", { slug });
      }

      return content || null;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error fetching custom content", { error });
      throw error;
    }
  },

  /**
   * Update custom content status (draft → approved → posted)
   */
  async updateCustomContentStatus(slug: string, status: string, logger?: any) {
    logger?.info("📝 [DemoRepository] Updating custom content status", { slug, status });

    try {
      const [updated] = await db
        .update(schema.customContent)
        .set({ 
          status,
          updatedAt: new Date(),
        })
        .where(eq(schema.customContent.slug, slug))
        .returning();

      if (updated) {
        logger?.info("✅ [DemoRepository] Custom content status updated", {
          slug,
          newStatus: status,
        });
      } else {
        logger?.warn("⚠️ [DemoRepository] Custom content not found for update", { slug });
      }

      return updated || null;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error updating custom content status", { error });
      throw error;
    }
  },

  /**
   * List all pending custom content (for admin review)
   */
  async listPendingCustomContent(logger?: any) {
    logger?.info("📋 [DemoRepository] Listing pending custom content");

    try {
      const content = await db
        .select()
        .from(schema.customContent)
        .where(eq(schema.customContent.status, "draft"))
        .orderBy(schema.customContent.createdAt);

      logger?.info("✅ [DemoRepository] Pending custom content listed", { count: content.length });
      return content;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error listing pending custom content", { error });
      throw error;
    }
  },

  /**
   * Get current voice rotation state (singleton row)
   */
  async getVoiceRotationState(logger?: any) {
    logger?.info("🎤 [DemoRepository] Fetching voice rotation state");

    try {
      const [state] = await db
        .select()
        .from(schema.voiceRotationState)
        .limit(1);

      if (!state) {
        logger?.info("📝 [DemoRepository] No rotation state found, creating default");
        const [newState] = await db
          .insert(schema.voiceRotationState)
          .values({
            lastUsedVoiceIndex: 0,
            cachedVoices: [],
            updatedAt: new Date(),
          })
          .returning();
        return newState;
      }

      logger?.info("✅ [DemoRepository] Voice rotation state found", {
        lastIndex: state.lastUsedVoiceIndex,
        voicesCount: state.cachedVoices?.length || 0,
      });

      return state;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error fetching voice rotation state", { error });
      throw error;
    }
  },

  /**
   * Update voice rotation state with next voice index and cache voices
   */
  async updateVoiceRotationState(
    nextIndex: number,
    cachedVoices?: Array<{ id_voice: string; display_name: string }>,
    logger?: any
  ) {
    logger?.info("🔄 [DemoRepository] Updating voice rotation state", {
      nextIndex,
      voicesCount: cachedVoices?.length || 0,
    });

    try {
      const currentState = await this.getVoiceRotationState(logger);

      const updateData: any = {
        lastUsedVoiceIndex: nextIndex,
        updatedAt: new Date(),
      };

      if (cachedVoices) {
        updateData.cachedVoices = cachedVoices;
      }

      const [updated] = await db
        .update(schema.voiceRotationState)
        .set(updateData)
        .where(eq(schema.voiceRotationState.id, currentState.id))
        .returning();

      logger?.info("✅ [DemoRepository] Voice rotation state updated", {
        newIndex: nextIndex,
      });

      return updated;
    } catch (error) {
      logger?.error("❌ [DemoRepository] Error updating voice rotation state", { error });
      throw error;
    }
  },
};
