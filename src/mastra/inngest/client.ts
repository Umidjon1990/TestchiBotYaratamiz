import { Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime";

// Always use development mode (no Inngest Cloud dependency)
// This allows the bot to work on-demand via webhooks without needing Inngest Cloud
export const inngest = new Inngest({
  id: "mastra",
  baseUrl: process.env.NODE_ENV === "production" 
    ? "http://localhost:3000"  // Production: local Inngest (no cloud)
    : "http://localhost:3000",  // Development: local Inngest
  isDev: true,
  middleware: [realtimeMiddleware()],
});
