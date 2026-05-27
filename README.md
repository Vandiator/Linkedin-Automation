# 🤖 LinkedIn Auto-Poster — Full Automation Pipeline

## Project Owner
- **Name:** Vineet (GitHub: Vandiator)
- **Goal:** Fully automated LinkedIn carousel post generator that runs every week without any manual input
- **Niche:** AI, Tech, Coding, Design
- **Style:** Professional blue & white LinkedIn look (NOT dark YouTube thumbnail style)

---

## 📌 Project Status

| Phase | Status | Description |
|---|---|---|
| Phase 1 — Base pipeline | ✅ Done | Brendan's repo cloned and working |
| Phase 2 — Image generation | ✅ Done | Switched from OpenAI to Hugging Face FLUX |
| Phase 3 — Content generation | ✅ Done | Groq (Llama 3.3) generates fresh slide content |
| Phase 4 — Slide rendering | 🔄 In Progress | Puppeteer renders HTML slides as PNGs |
| Phase 5 — Slide quality | ❌ Needs work | Current Puppeteer slides look bad, need redesign |
| Phase 6 — Full automation | ❌ Not built yet | GitHub Actions weekly scheduler |
| Phase 7 — Self-improvement | ❌ Future | Karpathy AutoResearch loop for content optimization |

---

## 🏗️ Architecture Overview

### Current Pipeline (Manual — Level 1)
```
User runs commands manually
         ↓
node generate-content.js    ← Groq writes slide content from latest AI news
         ↓
node render-slides.js       ← Puppeteer renders HTML slides as PNGs
         ↓
node schedule-linkedin-post.js  ← Stitches PDF, uploads to Cloudinary, schedules via Buffer
```

### Target Pipeline (Fully Automated — Level 3)
```
GitHub Actions triggers every Monday 9am automatically
         ↓
generate-content.js runs    ← Groq fetches latest AI/Tech news and writes slide content
         ↓
render-slides.js runs       ← Puppeteer renders 6 beautiful slides as PNGs
         ↓
schedule-linkedin-post.js   ← PDF stitched, uploaded to Cloudinary, scheduled via Buffer API
         ↓
Post goes live on LinkedIn at scheduled time
         ↓
Zero human input required ✅
```

### Future Pipeline (Self-Improving — Level 4)
```
Same as Level 3 PLUS:
         ↓
AutoResearch loop (Karpathy style) analyzes post performance
         ↓
Claude Code agent reads engagement data
         ↓
Tests different content styles, hooks, formats
         ↓
Keeps what gets more engagement, discards what doesn't
         ↓
Content quality improves automatically every week
```

---

## 📁 File Structure

```
claude-linkedin-auto-poster/
│
├── .env                          ← All API keys (never commit this!)
├── .env.example                  ← Template showing required keys
├── .gitignore                    ← Ensures .env is never pushed to GitHub
│
├── package.json                  ← Node.js dependencies
│
├── carousel.js                   ← OLD: Used Gemini/HuggingFace for image gen (REPLACED)
├── generate-content.js           ← NEW: Groq generates slide content from AI news
├── render-slides.js              ← NEW: Puppeteer renders HTML slides as PNGs
├── schedule-linkedin-post.js     ← Stitches PDF + schedules via Buffer API
│
├── client.js                     ← Cloudinary SDK configuration
├── upload.js                     ← Cloudinary upload helper function
├── gallery.js                    ← Local gallery server to preview images
├── list.js                       ← Lists uploaded carousels
│
├── Style-Guide/                  ← Brand reference images (not used by current pipeline)
│   └── *.jpg                     ← Sample images from Brendan's original repo
│
├── output/                       ← Generated files (gitignored)
│   ├── slide-content.json        ← JSON content from generate-content.js
│   ├── slide-1-hook.png          ← Rendered slide images
│   ├── slide-2-*.png
│   ├── slide-3-*.png
│   ├── slide-4-*.png
│   ├── slide-5-*.png
│   ├── slide-6-cta.png
│   └── carousel-tech-ai-news.pdf ← Final PDF for LinkedIn
│
└── .github/
    └── workflows/
        └── weekly-post.yml       ← GitHub Actions automation (NOT BUILT YET)
```

---

## 🔑 Environment Variables (.env)

```env
# Cloudinary — Image hosting
CLOUDINARY_CLOUD_NAME=dad1bd3st
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
PORT=3000

# Hugging Face — Image generation (currently not in use, replaced by Puppeteer)
HF_API_KEY=hf_your_key

# Groq — Free AI for content generation (Llama 3.3 70B model)
GROQ_API_KEY=gsk_your_key

# Buffer — LinkedIn post scheduling
BUFFER_API_TOKEN=your_token
LINKEDIN_CHANNEL_ID=6a0a27cd090476fb992ea29c

# GitHub Actions secrets (same keys, added in GitHub repo settings)
# Settings → Secrets and variables → Actions → New repository secret
```

---

## 📦 Dependencies

```json
{
  "@google/genai": "^2.3.0",      // Gemini SDK (not currently used)
  "cloudinary": "^2.5.1",         // Image/file hosting
  "dotenv": "^16.4.5",            // Load .env variables
  "express": "^4.21.1",           // Local gallery server
  "openai": "^4.77.0",            // OpenAI SDK (not currently used)
  "pdf-lib": "^1.17.1",           // Stitch PNGs into PDF
  "puppeteer": "latest",           // Headless browser for rendering slides
  "groq-sdk": "latest"             // Groq AI for content generation
}
```

Install all:
```bash
npm install
```

---

## 🎨 Design System

### Colors
| Variable | Hex | Usage |
|---|---|---|
| LinkedIn Blue | `#0A66C2` | Accents, borders, highlight blocks, bottom bar |
| Navy | `#0D1B2A` | Headlines, bold text |
| Grey | `#4A5568` | Subtext, descriptions |
| White | `#FFFFFF` | Card backgrounds |
| Background | `#F7F9FC` | Slide background |

### Slide Structure (6 slides per carousel)
| Slide | ID | Purpose |
|---|---|---|
| 1 | `slide-1-hook` | Hook — grabs attention, shows what's inside |
| 2 | `slide-2` | Topic 1 — first main point with stats/visuals |
| 3 | `slide-3` | Topic 2 — second main point |
| 4 | `slide-4` | Topic 3 — third main point |
| 5 | `slide-5` | Topic 4 — fourth main point |
| 6 | `slide-6-cta` | CTA — what's coming next + follow prompt |

### Slide Design Rules
- Background: clean white or very light grey (#F7F9FC)
- NO dark backgrounds, NO gradients, NO glow effects
- Headlines: bold, uppercase, deep navy
- Key words: inside solid LinkedIn-blue highlight block with white text
- Layout: minimal, structured, lots of breathing room
- Icons: flat 2D line-art style in blue and navy
- Stats: inside rounded cards with thin blue border and blue left accent bar
- Bottom of every slide: thin blue bar with "Tech & AI Weekly" centered
- Format: 1080x1080px (1:1 square)
- Mood: authoritative, professional — like a McKinsey slide meets LinkedIn post

---

## 🔄 How Each File Works

### `generate-content.js`
- **Input:** Nothing (uses current date to determine relevant news)
- **Process:** Calls Groq API (Llama 3.3 70B) with a prompt asking for latest AI/Tech news
- **Output:** `output/slide-content.json` with topic, post caption, and 6 slide objects
- **Run:** `node generate-content.js`

### `render-slides.js`
- **Input:** `output/slide-content.json`
- **Process:** 
  1. Reads slide content JSON
  2. Generates HTML for each slide using the design system above
  3. Puppeteer launches headless Chrome
  4. Screenshots each slide at 1080x1080px
  5. Uploads each PNG to Cloudinary
- **Output:** 6 PNG files in `output/` + Cloudinary URLs
- **Run:** `node render-slides.js`
- **⚠️ Current Issue:** Slide quality is poor — HTML template needs redesign

### `schedule-linkedin-post.js`
- **Input:** PNG files in `output/` + manual THUMBNAIL_URL and DUE_AT
- **Process:**
  1. Reads all 6 PNG files
  2. Stitches them into a PDF using pdf-lib
  3. Uploads PDF to Cloudinary as `resource_type: raw`
  4. Verifies PDF is publicly accessible
  5. Calls Buffer GraphQL API to schedule post
- **Output:** Scheduled LinkedIn post
- **Run:** `node schedule-linkedin-post.js`
- **⚠️ Note:** Currently requires manual update of THUMBNAIL_URL and DUE_AT

---

## ⚠️ Known Issues & What Needs to Be Fixed

### Issue 1 — Slide Quality (PRIORITY)
- **Problem:** Puppeteer-rendered slides look plain and unprofessional
- **What was tried:** Hugging Face FLUX (bad text rendering), Gemini (quota issues), Puppeteer HTML (too basic)
- **Solution needed:** Redesign the HTML template in `render-slides.js` with better typography, real icons (SVG), visual illustrations, and more polished layout
- **Alternative:** Use a paid image API like Recraft V3 or Ideogram

### Issue 2 — schedule-linkedin-post.js Still Manual
- **Problem:** THUMBNAIL_URL and DUE_AT need to be manually updated each time
- **Solution needed:** Auto-read thumbnail URL from carousel results, auto-calculate next Monday 9am for DUE_AT

### Issue 3 — GitHub Actions Not Built Yet
- **What's needed:** `.github/workflows/weekly-post.yml` that:
  - Runs on schedule (every Monday 9am India time = 3:30am UTC)
  - Has all API keys as GitHub Secrets
  - Runs generate-content.js → render-slides.js → schedule-linkedin-post.js in sequence

---

## 🚀 What Needs to Be Built Next (In Order)

### Step 1 — Fix Slide Quality
Redesign `render-slides.js` HTML template to look professional:
- Add real SVG icons
- Better typography with Google Fonts
- Visual data representations (charts, progress bars)
- Polished card designs with shadows
- Consider splitting into visual illustration + text overlay

### Step 2 — Make schedule-linkedin-post.js Fully Automatic
```js
// Auto-set thumbnail from render-slides output
const THUMBNAIL_URL = results[0].url; // from render-slides.js output

// Auto-calculate next Monday 9am India time
function getNextMonday9am() {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(9, 0, 0, 0);
  return nextMonday.toISOString();
}
```

### Step 3 — Create Master Script `auto-post.js`
Single script that runs everything in sequence:
```js
// auto-post.js
import { generateContent } from './generate-content.js';
import { renderSlides } from './render-slides.js';
import { schedulePost } from './schedule-linkedin-post.js';

async function main() {
  const content = await generateContent();
  const slides = await renderSlides(content);
  await schedulePost(slides);
  console.log('✓ Post scheduled successfully!');
}
main();
```

### Step 4 — Build GitHub Actions Workflow
```yaml
# .github/workflows/weekly-post.yml
name: Weekly LinkedIn Post
on:
  schedule:
    - cron: '30 3 * * 1'  # Every Monday 3:30am UTC = 9am India
  workflow_dispatch:       # Allow manual trigger from GitHub UI

jobs:
  post:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: node auto-post.js
        env:
          CLOUDINARY_CLOUD_NAME: ${{ secrets.CLOUDINARY_CLOUD_NAME }}
          CLOUDINARY_API_KEY: ${{ secrets.CLOUDINARY_API_KEY }}
          CLOUDINARY_API_SECRET: ${{ secrets.CLOUDINARY_API_SECRET }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          HF_API_KEY: ${{ secrets.HF_API_KEY }}
          BUFFER_API_TOKEN: ${{ secrets.BUFFER_API_TOKEN }}
          LINKEDIN_CHANNEL_ID: ${{ secrets.LINKEDIN_CHANNEL_ID }}
```

### Step 5 — Add GitHub Secrets
In GitHub repo → Settings → Secrets and variables → Actions → Add each key from .env

---

## 🔮 Future Vision (Level 4 — Self-Improving)

Based on Karpathy's AutoResearch concept (released March 2026, 66k+ GitHub stars):

```
After each post goes live:
         ↓
Track LinkedIn engagement metrics (views, likes, comments, shares)
         ↓
AutoResearch loop runs (Claude Code agent)
         ↓
Agent reads past post performance data
         ↓
Proposes improvements to slide content style, hooks, CTAs
         ↓
Tests new approach next week
         ↓
Keeps what performs better (ratchet mechanism)
         ↓
Content quality self-improves every week
```

This requires:
- LinkedIn API access for engagement metrics
- Claude Code installed locally or as GitHub Action
- A `program.md` file describing what "good content" looks like
- A `results.json` tracking post performance over time

---

## 📚 Reference Videos

| Creator | Video | What it covers |
|---|---|---|
| Brendan Jowett | [Claude LinkedIn Auto-Poster](https://youtu.be/1q0RmehD8SU) | Original repo — manual pipeline with Claude Code |
| Duncan Rogoff | [5X LinkedIn Engagement](https://youtu.be/TGVhE4XxU3Q) | n8n workflow, scrapes your style, auto-generates text posts |
| Duncan Rogoff | [Claude Code + Karpathy AutoResearch](https://youtu.be/CtB4HP7kHyw) | Self-improving LinkedIn agent using AutoResearch loop |

---

## 🛠️ Tech Stack

| Tool | Purpose | Cost |
|---|---|---|
| Node.js | Runtime | Free |
| Groq API | AI content generation (Llama 3.3 70B) | Free |
| Puppeteer | HTML slide rendering | Free |
| Cloudinary | Image/PDF hosting | Free tier |
| Buffer | LinkedIn post scheduling | Free tier |
| GitHub Actions | Automation scheduler | Free (2000 min/month) |
| Hugging Face | Image generation (backup) | Free tier |

---

## 🔐 Security Notes

- **Never commit `.env`** to GitHub — it's in `.gitignore`
- All API keys go in **GitHub Secrets** for the Actions workflow
- Cloudinary `ALLOW PDF & ZIP delivery` must be enabled in security settings
- Buffer uses GraphQL API — token scoped to LinkedIn channel only

---

## 📞 If Starting Fresh With a New AI

Tell the AI:
1. This is a Node.js project (ES modules — uses `import` not `require`)
2. We use Groq for content generation, Puppeteer for rendering, Cloudinary for hosting, Buffer for scheduling
3. The immediate priority is **fixing slide quality** in `render-slides.js`
4. After that, build `auto-post.js` master script and `.github/workflows/weekly-post.yml`
5. The LinkedIn Channel ID is already known: `6a0a27cd090476fb992ea29c`
6. All credentials are already in `.env` — just need GitHub Secrets for Actions
