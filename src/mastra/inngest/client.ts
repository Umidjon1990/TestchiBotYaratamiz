import { Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime";

// Use development configuration when NODE_ENV is not "production"
export const inngest = new Inngest(
  process.env.NODE_ENV === "production"
    ? {
        id: "replit-agent-workflow",
        name: "Replit Agent Workflow System",
        eventKey: process.env.INNGEST_EVENT_KEY,
      }
    : {
        id: "mastra",
        baseUrl: "http://localhost:3000",
        isDev: true,
        middleware: [realtimeMiddleware()],
      },
);

// Log warning if INNGEST_EVENT_KEY is missing in production
if (process.env.NODE_ENV === "production" && !process.env.INNGEST_EVENT_KEY) {
  console.warn(
    "⚠️ INNGEST_EVENT_KEY not found! Workflow events will fail. Please set INNGEST_EVENT_KEY in Railway environment variables."
  );
}
