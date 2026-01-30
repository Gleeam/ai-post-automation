# 🚀 Gleeam Article Automation

Automation script for generating SEO-optimized articles with multilingual support and CMS integration.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--5-purple.svg)](https://openai.com/)

## ✨ Features

- **🔍 Trend Research** : Automatic identification of trending topics via Brave Search, Serper.dev or News API
- **🤖 Advanced AI Generation** : Natural content that's hard to detect as AI-generated
- **📝 6-Step Process** : Topic analysis → Detailed outline → Writing → Post-processing → SEO → Assembly
- **🔎 Complete SEO Optimization** : Meta title, description, keywords, H1-H6 structure, SEO scoring
- **🌍 Multilingual** : Automatic generation and translation FR ↔ EN ↔ ES
- **⏰ CRON Automation** : Dedicated script for scheduled generation
- **💾 CMS Integration** : Direct publishing to Payload CMS / MongoDB

## 📦 Installation

```bash
git clone https://github.com/gleeam/article-automation.git
cd article-automation
npm install
cp .env.example .env
```

Edit `.env` with your API keys.

## ⚙️ Configuration

### Environment Variables

```env
# Required
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-5-mini          # or gpt-5-nano, gpt-5.2, gpt-4o-mini
MONGODB_URI=mongodb://localhost:27017/gleeam-blog

# Search APIs (at least one recommended)
BRAVE_API_KEY=your-key           # 2000 req/month free
SERPER_API_KEY=your-key          # 2500 req free
NEWS_API_KEY=your-key            # 100 req/day free

# Options
DEFAULT_LANGUAGE=en
DEFAULT_AUTHOR=Gleeam
LOG_LEVEL=info
```

### Supported OpenAI Models

| Model | Use Case | Cost |
|-------|----------|------|
| `gpt-5-mini` | **Recommended** - Balanced | $$ |
| `gpt-5-nano` | Simple tasks, fast | $ |
| `gpt-5.2` | Complex tasks | $$$ |
| `gpt-4o-mini` | Stable alternative | $$ |

### Trend Search APIs

| API | Free Quota | Sign Up |
|-----|------------|---------|
| **Brave Search** | 2000 req/month | [brave.com/search/api](https://brave.com/search/api/) |
| **Serper.dev** | 2500 req | [serper.dev](https://serper.dev/) |
| **News API** | 100 req/day | [newsapi.org](https://newsapi.org/) |

The script automatically uses the available API: Brave → Serper → News API → Local fallback.

## 🚀 Usage

### Interactive Mode

```bash
npm start
```

Interactive menu with options:
- Generate on a specific topic
- Generate on a current trend
- Generate on a random topic
- Search trends
- Get suggestions

### Command Line

```bash
# Article on a topic
npm run generate -- --topic "What's new in Next.js 16"

# With specific category
npm run generate -- --topic "AI in 2026" -c artificialIntelligence

# Multilingual (FR + EN + ES)
npm run generate -- --topic "Web3 and blockchain" --multilingual

# Search trends
npm run research

# Batch generation
npm run batch -- --count 5
```

### CLI Options

| Option | Description |
|--------|-------------|
| `-t, --topic <topic>` | Article topic |
| `-c, --category <id>` | Category (see list below) |
| `-l, --language <lang>` | Source language (fr, en, es) |
| `-m, --multilingual` | Translate to FR + EN + ES |
| `--auto-publish` | Publish directly |

## ⏰ CRON Automation

### Dedicated Script

```bash
# 1 random article (draft)
npm run cron

# 1 published + multilingual article
npm run cron:daily

# 5 published + multilingual articles
npm run cron:weekly
```

### CRON Options

```bash
node src/cron.js [options]

Options:
  -n, --count <n>       Number of articles (default: 1)
  -p, --publish         Publish directly
  -m, --multilingual    Translate to FR/EN/ES
  -c, --category <id>   Specific category
  --dry-run             Test without saving
```

### Crontab Configuration

```bash
# Edit crontab
crontab -e

# Daily generation at 9am
0 9 * * * cd /path/to/automations && node src/cron.js -p -m >> logs/cron.log 2>&1

# Weekly generation (Monday 8am, 3 articles)
0 8 * * 1 cd /path/to/automations && node src/cron.js -n 3 -p -m >> logs/cron.log 2>&1
```

## 📂 Available Categories

| ID | Category |
|----|----------|
| `webDevelopment` | 🌐 Web Development |
| `mobileDevelopment` | 📱 Mobile Development |
| `artificialIntelligence` | 🤖 Artificial Intelligence |
| `blockchain` | ⛓️ Blockchain & Web3 |
| `softwareArchitecture` | 🏗️ Software Architecture |
| `databases` | 🗄️ Databases |
| `dataAnalytics` | 📊 Data Analytics |
| `cloudDevOps` | ☁️ Cloud & DevOps |
| `cybersecurity` | 🔒 Cybersecurity |
| `uxDesign` | 🎨 UX/UI Design |

## 🔧 Generation Process

The script uses a **6-step process** for optimal quality:

```
1. 🔍 Topic Analysis      → Original angle, catchy title
2. 📋 Outline Creation    → Detailed H2/H3 structure
3. ✍️  Writing            → Content based on outline
4. 🔄 Post-processing     → Natural variations, anti-AI detection
5. 🎯 SEO Optimization    → Meta tags, keywords, scoring
6. 📦 Final Assembly      → Validation and CMS formatting
```

## 🎨 Content Quality

Techniques used for natural content:

- **Conversational tone** : Approachable yet professional
- **Syntactic variations** : Alternating short and long sentences
- **Idiomatic expressions** : Natural language patterns
- **Rhetorical questions** : Reader engagement
- **Concrete examples** : Practical contextualization
- **Normalization** : No excessive UPPERCASE text

## 📁 Project Structure

```
automations/
├── .env.example          # Environment variables template
├── .gitignore            # Ignored files
├── package.json          # Dependencies and scripts
├── README.md             # Documentation (French)
├── README.en.md          # Documentation (this file)
└── src/
    ├── index.js          # Interactive CLI
    ├── cron.js           # CRON automation script
    ├── config/
    │   └── topics.js     # Categories and keywords
    ├── services/
    │   ├── openai.js     # OpenAI client (GPT-5 compatible)
    │   ├── trends.js     # Brave/Serper/News API
    │   └── database.js   # MongoDB / Payload CMS
    ├── generators/
    │   ├── article.js    # Main generator (6 steps)
    │   ├── seo.js        # SEO optimization and scoring
    │   └── translator.js # Multilingual translation
    ├── prompts/
    │   └── templates.js  # Optimized anti-detection prompts
    └── utils/
        ├── logger.js     # Colored logging
        └── helpers.js    # Utilities (slug, SEO, caps)
```

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or pull request.

## 📄 License

MIT © [Gleeam](https://gleeam.com)

---

**[Version française](README.md)** | Made with ❤️ by Gleeam
