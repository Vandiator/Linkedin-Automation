# LinkedIn Auto-Poster

A fully automated weekly LinkedIn carousel generator. Every Monday at **09:00 India time (IST)**, GitHub Actions runs a pipeline that writes fresh AI/tech content, renders polished blue-and-white slides, and schedules the post on LinkedIn — all without touching a keyboard.

```
                  Monday 09:00 IST
                        │
                        ▼
            ┌─────────────────────────┐
            │   GitHub Actions cron   │
            └───────────┬─────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  generate-content   render-slides   schedule-linkedin-post
  (Groq + HN RSS)    (Pollinations   (Cloudinary PDF
                      + Puppeteer)    + Buffer API)
        │               │               │
        └───────────────┼───────────────┘
                        ▼
                 LinkedIn post live
```

---

## What you get every week

- **5 slides** (hook → stat → list → comparison → CTA), 1080×1080, rendered at 2× pixel density
- **AI-generated hero illustrations** on every slide via [Pollinations.ai](https://pollinations.ai) (free, no key)
- **Crisp typography** (Inter from Google Fonts) and **inline SVG icons** — no emoji, no blurry text
- **A LinkedIn-style caption** written by Groq (Llama 3.3 70B) with hashtags
- **Auto-stitched PDF** uploaded to Cloudinary, scheduled in Buffer for Monday 09:00 IST

---

## One-time setup

### 1. Add API keys to GitHub Secrets

Go to **your repo on GitHub → Settings → Secrets and variables → Actions → New repository secret** and add these one at a time:

| Secret name             | Where to get it                                                   |
| ----------------------- | ----------------------------------------------------------------- |
| `CLOUDINARY_CLOUD_NAME` | [Cloudinary console](https://console.cloudinary.com/) → Dashboard |
| `CLOUDINARY_API_KEY`    | Cloudinary console → Dashboard → API Keys                         |
| `CLOUDINARY_API_SECRET` | Cloudinary console → Dashboard → API Keys                         |
| `GROQ_API_KEY`          | [console.groq.com/keys](https://console.groq.com/keys) (free)     |
| `BUFFER_API_TOKEN`      | [publish.buffer.com/settings/api](https://publish.buffer.com/settings/api) |
| `LINKEDIN_CHANNEL_ID`   | Your Buffer channel ID for LinkedIn (already known: `6a0a27cd090476fb992ea29c`) |

Optional (only if you want fallbacks for image generation):

| Secret name           | Notes                                                         |
| --------------------- | ------------------------------------------------------------- |
| `HF_API_KEY`          | Hugging Face read token — used if Pollinations is down        |
| `POLLINATIONS_TOKEN`  | Only if you signed up at auth.pollinations.ai for higher rate limits |

### 2. Enable PDF delivery in Cloudinary (one-time)

Go to **[Cloudinary Security settings](https://console.cloudinary.com/settings/security)** and turn ON **"Allow delivery of PDF and ZIP files"**. Without this, Buffer can't fetch the carousel PDF.

### 3. Test it once

In your repo → **Actions tab → Weekly LinkedIn Post → Run workflow**.

If everything is configured, you'll see a green checkmark in 3–5 minutes and a scheduled post appear in your Buffer queue.

That's it. From now on, it runs every Monday at 09:00 IST automatically.

---

## How it works

### `generate-content.js` — the writer

1. Pulls the top stories from Hacker News (`https://hnrss.org/best?count=20`).
2. Filters them for AI / coding / tech / design keywords.
3. Sends the headlines plus today's date to **Groq (Llama 3.3 70B)** with a structured prompt.
4. Gets back JSON describing 5 slides (hook + 3 topic + CTA), each with `headline`, `subheadline`, `content`, `layout`, and an `imagePrompt` for the hero illustration.
5. Saves to `output/slide-content.json`.

### `render-slides.js` — the designer

For every slide:

1. Sends the `imagePrompt` to **Pollinations.ai** (FLUX.1) and saves the hero image.
2. If Pollinations fails, falls back to **Hugging Face FLUX.1-schnell**.
3. If both fail, uses a soft blue-gradient placeholder.
4. Picks one of 5 layout templates based on `slide.layout`:
   - `hook` — 4 numbered teaser cards + hero image
   - `stat` — giant percentage/number + supporting bullets
   - `list` — numbered list with hero accent
   - `comparison` — old way vs new way, two columns
   - `cta` — green checklist + follow button
5. Renders the slide as HTML (Inter font, SVG icons, soft shadows) and screenshots it with **Puppeteer** at 1080×1080 @ 2× DPI.
6. Uploads the PNG to **Cloudinary** under `carousel/<slug>/<date>/`.
7. Saves `output/slide-results.json` so the next step knows where everything lives.

### `schedule-linkedin-post.js` — the publisher

1. Stitches the rendered PNGs into a single PDF with `pdf-lib`.
2. Uploads the PDF to Cloudinary as `resource_type: raw`.
3. HEAD-checks the public URL (catches the "PDF delivery is disabled" issue early).
4. Computes **next Monday 09:00 IST** (or the upcoming Monday if today is past it).
5. Calls Buffer's GraphQL API to schedule a LinkedIn document post with the PDF, caption, and the slide-1 image as the thumbnail.

### `auto-post.js` — the conductor

Single entry point that runs the three steps in sequence with friendly logging. This is what GitHub Actions calls.

---

## Design system

| Token         | Hex       | Use                                 |
| ------------- | --------- | ----------------------------------- |
| LinkedIn Blue | `#0A66C2` | Accents, highlights, brand bar      |
| Blue Dark     | `#004182` | CTA gradient end                    |
| Blue Light    | `#E8F0FB` | Pill backgrounds                    |
| Navy          | `#0D1B2A` | Headlines, body                     |
| Grey          | `#4A5568` | Subtext                             |
| Soft Grey     | `#94A3B8` | "Old way" comparison column         |
| Green         | `#10B981` | Checklist icons on CTA              |
| Background    | `#F7F9FC` | Slide background                    |

Typography: **Inter** (400 / 500 / 600 / 700 / 800 / 900) loaded from Google Fonts on every render.

Icons: 12 inline SVGs (sparkle, lightning, brain, code, layers, rocket, globe, chart, check, x, arrow-right, swipe-right) — picked per slide based on keywords.

---

## Running locally

You don't need to. GitHub Actions handles the weekly run for you.

If you want to test locally anyway:

```bash
git clone https://github.com/Vandiator/Linkedin-Automation.git
cd Linkedin-Automation
cp .env.example .env       # fill in your API keys
npm install
node auto-post.js          # runs the full pipeline
```

You can also run the steps individually:

```bash
npm run generate    # generate-content.js  → output/slide-content.json
npm run render      # render-slides.js     → 5 PNGs + slide-results.json
npm run schedule    # schedule-linkedin-post.js → schedule on Buffer
```

---

## Troubleshooting

**The workflow ran but no post appeared on LinkedIn.**
Buffer schedules the post for Monday 09:00 IST. If you ran the workflow on, say, Wednesday, the post is queued but won't go live until Monday. Check **publish.buffer.com → Queue**.

**The workflow failed.**
Open the failed run in the **Actions** tab. If artifacts are attached (PNGs / JSON / PDF), download them to inspect what was generated. The most common causes:

- A required GitHub Secret is missing or wrong — re-check **Settings → Secrets and variables → Actions**.
- Cloudinary's "Allow delivery of PDF and ZIP files" is still OFF — flip it on.
- Buffer API token expired — regenerate at publish.buffer.com/settings/api.

**Pollinations.ai is slow / failing.**
The pipeline auto-falls-back to Hugging Face if you've added `HF_API_KEY` to Secrets. If that also fails, slides render with a clean gradient instead of a hero image — the post still ships.

**Slides look different from what I expected.**
Layouts rotate by content type. Edit the prompts in `generate-content.js` to bias toward more `stat`, `list`, or `comparison` layouts.

---

## File map

```
.
├── .github/workflows/weekly-post.yml   ← GitHub Actions cron + manual trigger
├── auto-post.js                        ← Single entry point (calls the 3 steps)
├── generate-content.js                 ← Step 1: Groq + HN RSS → slide JSON
├── render-slides.js                    ← Step 2: Pollinations + Puppeteer → PNGs
├── schedule-linkedin-post.js           ← Step 3: PDF + Cloudinary + Buffer
├── client.js                           ← Cloudinary SDK setup
├── upload.js                           ← Cloudinary upload helper
├── carousel.js                         ← Legacy (HF FLUX direct) — not used by pipeline
├── gallery.js, list.js, public/        ← Local Cloudinary preview server
├── package.json
├── .env.example                        ← Template for local .env
└── output/                             ← Generated files (gitignored)
    ├── slide-content.json              ← Step 1 output
    ├── hero-slide-*.png                ← AI-generated hero images
    ├── slide-*.png                     ← Final rendered slides
    ├── slide-results.json              ← Step 2 output
    └── carousel-*.pdf                  ← Stitched PDF for LinkedIn
```

---

## What's NOT in this version (yet)

- **Self-improvement loop** — analyzing past post engagement and adjusting the prompt automatically. Tracked as a future Phase 7.
- **Live web scraping** — content uses Hacker News RSS as its only signal. Adding TechCrunch, The Verge, etc. would give richer context.
- **Multi-channel publishing** — pipeline is LinkedIn-only. Same PDF could be posted to X / IG carousel with minor work.

---

## Tech stack

| Tool           | Purpose                       | Cost                      |
| -------------- | ----------------------------- | ------------------------- |
| Node.js 20     | Runtime                       | Free                      |
| Groq (Llama 3.3 70B) | Content generation      | Free                      |
| Pollinations.ai (FLUX) | Hero illustrations    | Free, no API key needed   |
| Hugging Face FLUX-schnell | Image fallback     | Free tier                 |
| Puppeteer      | HTML → PNG                    | Free                      |
| pdf-lib        | PNG → PDF                     | Free                      |
| Cloudinary     | Image + PDF hosting           | Free tier                 |
| Buffer         | LinkedIn scheduling           | Free tier                 |
| GitHub Actions | Weekly cron runner            | Free (2000 min/mo)        |
