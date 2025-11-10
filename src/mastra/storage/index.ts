import { PostgresStore } from "@mastra/pg";
import { Pool } from "pg";

// Create a single shared PostgreSQL storage instance for Mastra
export const sharedPostgresStorage = new PostgresStore({
  connectionString:
    process.env.DATABASE_URL || "postgresql://localhost:5432/mastra",
});

// Create a separate pg Pool for direct database access (used by Drizzle)
export const pgPool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://localhost:5432/mastra",
});
