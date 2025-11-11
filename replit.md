# Overview

This is a Mastra-based AI automation framework built on TypeScript. Mastra is an all-in-one framework for building AI-powered applications and agents with a modern TypeScript stack. The application enables users to build agentic automations using Agents, Tools, and Workflows with support for time-based triggers and webhook triggers (Slack, Telegram, etc.).

The system integrates with Inngest for durable workflow execution, ensuring failed workflows can seamlessly resume from their last successful state. It includes a Mastra Playground UI for visualizing and testing workflows, though this UI is only accessible to users (not the code agent).

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Framework Architecture

**Framework**: Mastra (v0.20.0+)
- **Rationale**: Purpose-built for TypeScript AI applications with built-in patterns for agents, workflows, tools, and memory management
- **Alternatives**: LangChain, AutoGen - Mastra chosen for its TypeScript-first design and integrated workflow orchestration
- **Key benefits**: Unified interface for 47+ AI providers (800+ models), built-in suspend/resume, streaming support, and production-ready observability

## AI Model Integration

**Model Router**: Mastra's unified model interface
- **Rationale**: Single API to access models from OpenAI, Anthropic, Google, xAI, OpenRouter without managing multiple SDKs
- **Pattern**: Models specified as `"provider/model-name"` (e.g., `"openai/gpt-4o"`, `"anthropic/claude-opus-4.1"`)
- **Key feature**: Automatic API key detection from environment variables with clear error messages
- **Supported**: Model fallbacks for high availability, mix-and-match models for different tasks

## Agent Architecture

**Primary Model**: OpenAI GPT-4o-mini (configurable)
- **Agent System**: Uses Mastra's `Agent` class with `.generateLegacy()` method for backward compatibility with Replit Playground UI
- **Memory System**: Multi-tier architecture
  - **Working Memory**: Persistent user preferences/state stored as Markdown or Zod schemas
  - **Conversation History**: Last N messages from current thread (default: 10)
  - **Semantic Recall**: RAG-based vector search for retrieving relevant past messages
- **Memory Scoping**: Two-tier system (thread-scoped and resource-scoped) with `thread` and `resource` identifiers
- **Guardrails**: Input/output processors for content moderation, prompt injection prevention, sanitization

## Workflow Orchestration

**Workflow Engine**: Mastra workflows with Inngest integration
- **Rationale**: Provides explicit control over execution flow vs. relying solely on LLM reasoning
- **Key capabilities**:
  - Step-by-step execution with input/output schemas (Zod)
  - Branching, merging, parallel execution
  - Suspend/resume for human-in-the-loop interactions
  - Snapshot-based state persistence
- **Inngest Integration** (`@mastra/inngest`):
  - Durable execution with automatic step memoization
  - Real-time monitoring via publish-subscribe
  - Automatic retry on failure with configurable policies
  - Production deployment on Replit infrastructure

## Storage & Persistence

**Storage Adapters**: Pluggable architecture supporting multiple backends
- **LibSQL** (`@mastra/libsql`): Local file-based or remote SQLite storage
- **PostgreSQL** (`@mastra/pg`): Full Postgres with pgvector for semantic search
- **Shared Storage**: Single `PostgresStore` instance in `src/mastra/storage.ts` used across workflows
- **Memory Storage**: Stores conversation threads, messages, working memory, and vector embeddings
- **Snapshot Storage**: Persists workflow execution state for suspend/resume functionality

## Trigger System

**Webhook Triggers**: Custom webhook handlers for third-party integrations
- **Location**: `src/triggers/` directory
- **Pattern**: Each connector has dedicated trigger file (e.g., `slackTriggers.ts`, `telegramTriggers.ts`)
- **Registration**: Uses `registerApiRoute()` from `src/mastra/inngest` to create HTTP endpoints
- **Example connectors**: Slack (message.channels), Telegram (message), Linear (issue.created)
- **Flow**: Webhook payload → trigger handler → Mastra workflow/agent execution

**Time-based Triggers**: Cron workflows via Inngest
- **Registration**: `registerCronWorkflow()` in `src/mastra/inngest`

## Logging & Observability

**Logger**: Custom ProductionPinoLogger extending MastraLogger
- **Implementation**: Pino-based structured logging with JSON output
- **Format**: ISO timestamps, level labels, custom formatters
- **Levels**: DEBUG, INFO, WARN, ERROR
- **Integration**: Passed to Mastra instance for framework-wide logging

## Development & Deployment

**Build System**:
- **TypeScript**: ES2022 target with ES modules (type: "module")
- **Module Resolution**: Bundler strategy for modern tooling
- **Scripts**: `mastra dev`, `mastra build`, TypeScript type checking, Prettier formatting

**Runtime Requirements**:
- **Node.js**: >=20.9.0
- **Package Manager**: npm with lockfile v3

**Development Tools**:
- **tsx**: Fast TypeScript execution for development
- **mastra CLI**: Dev server, build tooling, and scaffolding
- **Prettier**: Code formatting
- **TypeScript**: Strict mode enabled

## Key Architectural Decisions

1. **Legacy API Compatibility**: Uses `.generateLegacy()` and `.streamLegacy()` methods instead of v5 `.generate()` for Replit Playground UI compatibility
2. **Inngest for Durability**: All production workflows run through Inngest for automatic recovery and step memoization
3. **Shared Storage Pattern**: Single storage instance shared across all workflows to maintain consistency
4. **Trigger-based Activation**: No direct user-facing frontend - all interactions via webhooks or cron schedules
5. **Agent-first Tools**: Tools extend agent capabilities vs. standalone functions, always executed within agent context

# External Dependencies

## AI Model Providers

- **OpenAI** (`@ai-sdk/openai`): Primary model provider, GPT-4o/GPT-4o-mini models
- **OpenRouter** (`@openrouter/ai-sdk-provider`): Gateway access to multiple model providers
- **Vercel AI SDK** (`ai`): Core AI SDK for model interactions (v4 compatibility mode)

## Mastra Ecosystem

- **@mastra/core**: Core framework (agents, workflows, tools)
- **@mastra/inngest**: Inngest integration for durable workflows
- **@mastra/memory**: Memory management system
- **@mastra/libsql**: LibSQL storage adapter
- **@mastra/pg**: PostgreSQL storage adapter with pgvector
- **@mastra/loggers**: Logging abstractions
- **@mastra/mcp**: Model Context Protocol support

## Infrastructure & Orchestration

- **Inngest** (`inngest`, `@inngest/realtime`): Workflow orchestration, durable execution, real-time monitoring
- **inngest-cli**: CLI for Inngest development/deployment

## External Service Integrations

- **Slack** (`@slack/web-api`): Webhook triggers, message posting, conversation management
- **Telegram**: Webhook integration for bot messages (via webhook endpoints)
- **Exa** (`exa-js`): Search/research capabilities
- **WhatsApp**: Business API integration for chat bots
- **Lahajati** (Arabic TTS): Arabic text-to-speech service with professional voice cloning
  - **Voice**: Umidjon clone voice (ID: `rXBH9gG2s34pMDKFrPXcrKDf`) - hardcoded for reliability
  - **Style**: Radio news reader (professional, clear)
  - **Dialect**: Modern Standard Arabic
  - **Fallback**: Auto-switches to ElevenLabs if Lahajati API fails
- **ElevenLabs** (`@elevenlabs/elevenlabs-js`): High-quality multilingual TTS with Arabic support
  - **Voice**: "Adam" (pre-made voice)
  - **Model**: eleven_turbo_v2_5 (optimized for speed and quality)
  - **Primary use**: Fallback provider when Lahajati unavailable

## Database & Storage

- **PostgreSQL**: Primary relational database with pgvector extension
  - Type definitions: `@types/pg`
  - Connection via `DATABASE_URL` environment variable
- **LibSQL**: SQLite-compatible embedded database option
- **Vector Storage**: pgvector for semantic recall and embeddings

## Development Dependencies

- **TypeScript** (v5.9.3): Type safety and compilation
- **ts-node**: TypeScript execution for scripts
- **Prettier**: Code formatting
- **dotenv**: Environment variable management
- **pino**: Structured logging library
- **zod**: Runtime type validation and schema definition

## Environment Variables Required

- `OPENAI_API_KEY`: OpenAI model access
- `ANTHROPIC_API_KEY`: Anthropic models (if used)
- `DATABASE_URL`: PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN`: Telegram webhook integration
- `WHATSAPP_*`: WhatsApp Business API credentials
- `SLACK_*`: Slack API credentials (inferred from code)
- Provider-specific keys for other model providers as needed