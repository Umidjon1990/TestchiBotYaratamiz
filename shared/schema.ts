import { pgTable, text, timestamp, jsonb, varchar, serial } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Demo Sessions Table
 * Stores podcast content drafts for admin preview and editing
 */
export const demoSessions = pgTable("demo_sessions", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  podcastTitle: text("podcast_title").notNull(),
  podcastContent: text("podcast_content").notNull(),
  questions: jsonb("questions").notNull().$type<
    Array<{
      question: string;
      options: string[];
      correctAnswer: number;
      explanation: string;
    }>
  >(),
  imageUrl: text("image_url").notNull(),
  audioUrl: text("audio_url").notNull(),
  audioStoragePath: text("audio_storage_path"), // Just the filename for App Storage downloads
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, approved, rejected, posted
  contentType: varchar("content_type", { length: 20 }).notNull().default("podcast"), // podcast, listening, reading
  level: varchar("level", { length: 5 }).default("B1"), // A1, A2, B1, B2
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Demo Revisions Table (Optional - for tracking edit history)
 * Stores history of admin edits to demo content
 */
export const demoRevisions = pgTable("demo_revisions", {
  id: serial("id").primaryKey(),
  demoId: serial("demo_id").references(() => demoSessions.id).notNull(),
  field: varchar("field", { length: 100 }).notNull(), // podcastTitle, podcastContent, imageUrl, etc.
  oldValue: text("old_value"),
  newValue: text("new_value"),
  editedBy: varchar("edited_by", { length: 255 }).notNull(), // admin telegram ID
  editedAt: timestamp("edited_at").defaultNow().notNull(),
});
