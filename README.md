# 📚 Content Maker Bot - Arabic Educational Content Automation

> Automated Arabic educational content generation system for Telegram channels with A1-B2 CEFR level materials.

## 🎯 Overview

**Content Maker Bot** is a Mastra-based AI automation framework that creates daily Arabic educational content (listening and reading materials) for language learners. The system generates:

- **Listening Content**: 75+ word audio scripts with professional Arabic TTS (Lahajati/ElevenLabs) + 5 CEFR-appropriate quizzes
- **Reading Content**: 100+ word texts with 5 CEFR-appropriate quizzes (no audio)

## 📋 Features

### Content Generation
- 🎓 **CEFR Levels**: A1 (Beginner) → A2 (Elementary) → B1 (Intermediate) → B2 (Upper-Intermediate)
- 🎙️ **Audio Providers**: 
  - **Lahajati API**: 329 professional Arabic voices with rotation
  - **ElevenLabs**: High-quality multilingual TTS with Arabic support
- 📝 **Topics**: Science, Technology, Health, Culture, History, Environment, Education, Business (no religious content)
- ❓ **Quizzes**: 5 multiple-choice questions per content, CEFR-compliant difficulty levels

### Workflow
1. **Admin triggers** content creation via Telegram bot
2. **AI Agent** generates educational content + questions
3. **Admin reviews** and approves/rejects preview
4. **Scheduled publishing** to Telegram channel at 9:00 AM Tashkent time (4:00 AM UTC)

## 🛠️ Tech Stack

- **Framework**: [Mastra](https://mastra.ai) v0.20.0+ (TypeScript AI automation framework)
- **AI Models**: OpenAI GPT-4o via Replit AI Integrations
- **Orchestration**: Inngest for durable workflow execution
- **Database**: PostgreSQL with pgvector for memory storage
- **TTS**: Lahajati API (Arabic), ElevenLabs (fallback)
- **Messaging**: Telegram Bot API

## 📦 Installation

### Prerequisites
- Node.js >= 20.9.0
- PostgreSQL database
- Telegram Bot Token
- Lahajati API Key (optional)
- ElevenLabs API Key (optional)

### Setup

1. **Clone the repository:**
```bash
git clone https://github.com/YOUR_USERNAME/content-maker-bot.git
cd content-maker-bot
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment variables:**

Create a `.env` file:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/dbname

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_admin_chat_id
TELEGRAM_CHANNEL_ID=@your_channel_id

# AI Integration (Replit AI - or use your own OpenAI key)
AI_INTEGRATIONS_OPENAI_BASE_URL=https://...
AI_INTEGRATIONS_OPENAI_API_KEY=your_api_key

# TTS Providers (Optional)
LAHAJATI_API_KEY=your_lahajati_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Session
SESSION_SECRET=your_random_secret_key
```

4. **Initialize database:**
```bash
npm run db:push
```

5. **Start development servers:**

Terminal 1 - Inngest:
```bash
./scripts/inngest.sh
```

Terminal 2 - Mastra:
```bash
npm run dev
```

## 🎮 Usage

### Admin Commands (Telegram)
- `/start` - Start content creation workflow
- Select topic, content type, audio provider, and CEFR level
- Review and approve generated content
- Content publishes automatically at scheduled time

### Testing Workflow Directly
```bash
# Test workflow execution
curl -X POST http://localhost:5000/api/mastra/workflows/content-maker-workflow/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputData": {
      "topic": "Technology",
      "contentType": "listening",
      "audioProvider": "lahajati",
      "level": "A2"
    }
  }'
```

## 📁 Project Structure

```
content-maker-bot/
├── src/
│   ├── mastra/
│   │   ├── agents/          # AI agents
│   │   ├── tools/           # Mastra tools (content generation, TTS, etc.)
│   │   ├── workflows/       # Workflow orchestration
│   │   ├── config/          # Lahajati voices, etc.
│   │   └── index.ts         # Main Mastra instance
│   ├── triggers/            # Telegram webhook handlers
│   └── repositories/        # Database repositories
├── shared/
│   └── schema.ts            # Drizzle database schema
├── scripts/
│   └── inngest.sh           # Inngest server startup
├── package.json
└── tsconfig.json
```

## 🔧 Key Components

### Mastra Agent
- **Content Maker Agent**: Generates Arabic educational content with CEFR-compliant questions
- Uses OpenAI GPT-4o for intelligent content generation
- Maintains conversation memory for context

### Mastra Tools
- `generatePodcastContent` - Creates educational text (75+ or 100+ words)
- `generateQuestions` - Creates 5 CEFR-appropriate quizzes
- `generateLahajatiAudio` - Professional Arabic TTS with voice rotation
- `generateAudio` - ElevenLabs TTS fallback
- `requestAdminApproval` - Sends preview to admin via Telegram
- `sendToTelegram` - Publishes approved content to channel

### Workflow
- **Content Maker Workflow**: Orchestrates the entire content creation pipeline
- Registered with Inngest for durable execution
- Supports suspend/resume for admin approval

## 🌐 Deployment

### Replit
This project is optimized for Replit deployment with built-in workflows.

### Other Platforms
1. Set up PostgreSQL database
2. Configure environment variables
3. Run database migrations: `npm run db:push`
4. Start Inngest server: `./scripts/inngest.sh`
5. Start Mastra server: `npm run dev`

## 📊 CEFR Question Standards

### A1 (Beginner)
- Direct facts from text
- Same vocabulary as content
- Clear wrong answers

### A2 (Elementary)
- Basic information
- Simple synonyms
- Simple connections

### B1 (Intermediate)
- Main ideas and relationships
- Medium synonyms
- Simple inference required

### B2 (Upper-Intermediate)
- Deep analysis
- Advanced synonyms
- Complex inference and reasoning

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - feel free to use this project for your own educational content automation.

## 🙏 Acknowledgments

- [Mastra](https://mastra.ai) - AI automation framework
- [Inngest](https://inngest.com) - Workflow orchestration
- [Lahajati](https://lahajati.com) - Arabic TTS provider
- [ElevenLabs](https://elevenlabs.io) - Multilingual TTS
- [OpenAI](https://openai.com) - Language models

## 📞 Support

For issues and questions, please open an issue on GitHub.

---

**Made with ❤️ for Arabic language learners**
