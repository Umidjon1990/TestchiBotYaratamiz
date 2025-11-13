import { Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime";

// Use development configuration when NODE_ENV is not "production"
export const inngest = new Inngest(
  process.env.NODE_ENV === "production"
    ? {
        id: "replit-agent-workflow",
        name: "Replit Agent Workflow System",
        eventKey: process.env.INNGEST_EVENT_KEY,
        signingKey: process.env.INNGEST_SIGNING_KEY,
      }
    : {
        id: "mastra",
        baseUrl: "http://localhost:3000",
        isDev: true,
        middleware: [realtimeMiddleware()],
      },
);

// Log warnings if required Inngest keys are missing in production
if (process.env.NODE_ENV === "production") {
  if (!process.env.INNGEST_EVENT_KEY) {
    console.warn(
      "⚠️ INNGEST_EVENT_KEY not found! Workflow events will fail. Please set INNGEST_EVENT_KEY in Railway environment variables."
    );
  }
  if (!process.env.INNGEST_SIGNING_KEY) {
    console.warn(
      "⚠️ INNGEST_SIGNING_KEY not found! Signature verification will fail. Please set INNGEST_SIGNING_KEY in Railway environment variables."
    );
  }
}
