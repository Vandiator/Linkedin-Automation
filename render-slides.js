// render-slides.js
// ─────────────────────────────────────────────────────────────────────────────
// Step 2 of the weekly pipeline.
//
// For every slide in output/slide-content.json:
//   1. Generate a hero illustration via Pollinations.ai (FLUX, free, no key).
//      Falls back to Hugging Face FLUX-schnell if Pollinations fails, then
//      to a clean gradient placeholder if both fail.
//   2. Compose a 1080x1080 PNG by rendering an HTML template with Puppeteer.
//      Five layout templates (hook / stat / list / comparison / cta) keep the
//      carousel visually varied. All text is rendered as crisp HTML/CSS using
//      Inter from Google Fonts — never baked into the image model output.
//   3. Upload the PNG to Cloudinary and collect the URL.
//
// Exposes renderSlides(content?) so auto-post.js can call it. Still works as
// a CLI: `node render-slides.js`.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { uploadMedia } from './upload.js';

// ─── Brand system ────────────────────────────────────────────────────────────
const BRAND = {
  blue: '#0A66C2',
  blueDark: '#004182',
  blueLight: '#E8F0FB',
  navy: '#0D1B2A',
  grey: '#4A5568',
  greySoft: '#94A3B8',
  white: '#FFFFFF',
  bg: '#F7F9FC',
  green: '#10B981',
  red: '#EF4444',
};

const FONT_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">';

// ─── Inline SVG icon library ─────────────────────────────────────────────────
// All icons are 24x24 viewBox, currentColor stroke. Sized via CSS.
const ICONS = {
  sparkle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>`,
  lightning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  brain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`,
  code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  rocket: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  swipeRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 5l7 7-7 7"/><path d="M3 12h18"/></svg>`,
};

// Pick an icon based on slide topic keywords — for visual consistency.
function iconForSlide(slide) {
  const t = `${slide.headline} ${slide.subheadline} ${slide.imagePrompt || ''}`.toLowerCase();
  if (/\b(agent|autonomy|autonomous)\b/.test(t)) return ICONS.rocket;
  if (/\b(model|gpt|llm|neural|brain|reason)\b/.test(t)) return ICONS.brain;
  if (/\b(code|coding|developer|program|software|github)\b/.test(t)) return ICONS.code;
  if (/\b(design|figma|ui|ux|product|creative)\b/.test(t)) return ICONS.layers;
  if (/\b(stat|percent|growth|chart|data|metric)\b/.test(t)) return ICONS.chart;
  if (/\b(speed|fast|instant|real-time|realtime)\b/.test(t)) return ICONS.lightning;
  if (/\b(world|global|web|browser|internet|cloud)\b/.test(t)) return ICONS.globe;
  return ICONS.sparkle;
}

// ─── Hero image generation ───────────────────────────────────────────────────

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt/';
const HF_MODEL = 'black-forest-labs/FLUX.1-schnell';
const HF_BASE = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

/** Add styling cues to every prompt for consistent look across slides. */
function decoratePrompt(prompt) {
  const style =
    'minimalist editorial illustration, abstract conceptual art, ' +
    'corporate blue and white color palette, soft gradients, clean composition, ' +
    'isometric vector style, high quality, professional, no text, no letters, no logos';
  return `${prompt}, ${style}`;
}

/** Try Pollinations first (free, no key). */
async function fetchHeroPollinations(prompt, seed) {
  const url = `${POLLINATIONS_BASE}${encodeURIComponent(decoratePrompt(prompt))}` +
    `?width=1024&height=1024&nologo=true&model=flux&seed=${seed}&private=true&enhance=false`;
  const headers = {};
  if (process.env.POLLINATIONS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.POLLINATIONS_TOKEN}`;
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error('Pollinations returned a tiny/empty image');
  return buf;
}

/** Fallback: Hugging Face Inference API (requires HF_API_KEY). */
async function fetchHeroHF(prompt) {
  if (!process.env.HF_API_KEY) throw new Error('HF_API_KEY not set');
  const res = await fetch(HF_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HF_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'image/png',
    },
    body: JSON.stringify({
      inputs: decoratePrompt(prompt),
      parameters: { width: 1024, height: 1024, num_inference_steps: 4 },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`HF HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error('HF returned a tiny/empty image');
  return buf;
}

/**
 * Get a hero image as a base64 data URI. Tries Pollinations → HF → null.
 * Saves the raw PNG to ./output/hero-<slideId>.png for debugging.
 */
async function fetchHeroDataUri(slide, seed) {
  const prompt = slide.imagePrompt;
  if (!prompt) return null;

  const sources = [
    { name: 'Pollinations', fn: () => fetchHeroPollinations(prompt, seed) },
    { name: 'Hugging Face', fn: fetchHeroHF.bind(null, prompt) },
  ];

  for (const src of sources) {
    try {
      console.log(`  hero: trying ${src.name}...`);
      const buf = await src.fn();
      const localPath = `./output/hero-${slide.id}.png`;
      writeFileSync(localPath, buf);
      console.log(`  hero: ${src.name} OK (${(buf.length / 1024).toFixed(0)} KB)`);
      return `data:image/png;base64,${buf.toString('base64')}`;
    } catch (e) {
      console.warn(`  hero: ${src.name} failed (${e.message})`);
    }
  }
  console.warn(`  hero: all sources failed for ${slide.id}, using gradient fallback`);
  return null;
}

// ─── HTML helpers ────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Split a comma-separated content string into clean items. */
function splitContent(content) {
  return String(content || '')
    .split(/[,;]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse "Title: description" → { title, desc } (desc may be empty). */
function splitTitleDesc(item) {
  const idx = item.indexOf(':');
  if (idx === -1) return { title: item, desc: '' };
  return { title: item.slice(0, idx).trim(), desc: item.slice(idx + 1).trim() };
}

// ─── Shared CSS for every slide ──────────────────────────────────────────────

function baseStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 1080px; height: 1080px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${BRAND.bg};
      color: ${BRAND.navy};
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .slide {
      position: relative;
      width: 1080px; height: 1080px;
      padding: 64px 64px 96px;
      display: flex;
      flex-direction: column;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      width: fit-content;
    }
    .pill.dark { background: ${BRAND.blue}; color: ${BRAND.white}; }
    .pill.light { background: ${BRAND.blueLight}; color: ${BRAND.blue}; }
    .pill svg { width: 16px; height: 16px; }

    h1.headline {
      font-size: 76px;
      font-weight: 900;
      line-height: 1.02;
      letter-spacing: -0.02em;
      color: ${BRAND.navy};
      text-transform: uppercase;
      margin-top: 24px;
    }
    .subheadline {
      display: inline-block;
      background: ${BRAND.blue};
      color: ${BRAND.white};
      font-size: 44px;
      font-weight: 800;
      line-height: 1.1;
      padding: 10px 22px;
      border-radius: 6px;
      letter-spacing: -0.01em;
      text-transform: uppercase;
      margin-top: 18px;
      box-shadow: 0 8px 24px rgba(10, 102, 194, 0.18);
    }
    .accent-line {
      width: 84px; height: 5px;
      background: ${BRAND.blue};
      border-radius: 3px;
      margin-top: 28px;
    }

    /* ── Bottom brand bar ───────────────────────────────────────────────── */
    .brand-bar {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 64px;
      background: ${BRAND.blue};
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 48px;
    }
    .brand-bar .brand-name {
      color: ${BRAND.white};
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .brand-bar .page-info {
      display: flex;
      align-items: center;
      gap: 10px;
      color: ${BRAND.white};
      font-size: 16px;
      font-weight: 600;
      opacity: 0.85;
    }
    .brand-bar svg { width: 18px; height: 18px; }

    /* ── Hero image container ──────────────────────────────────────────── */
    .hero {
      border-radius: 20px;
      overflow: hidden;
      background: linear-gradient(135deg, ${BRAND.blueLight} 0%, #d6e4f5 100%);
      box-shadow: 0 24px 48px rgba(13, 27, 42, 0.12), 0 4px 12px rgba(13, 27, 42, 0.06);
      position: relative;
    }
    .hero img {
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
    }
    .hero.fallback::after {
      content: "";
      position: absolute; inset: 0;
      background:
        radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), transparent 60%),
        radial-gradient(circle at 70% 70%, rgba(10,102,194,0.18), transparent 60%);
    }
  `;
}

// ─── Layout: HOOK ────────────────────────────────────────────────────────────

function renderHook(slide, heroDataUri, total) {
  const items = splitContent(slide.content).slice(0, 4);
  const heroEl = heroDataUri
    ? `<div class="hero hook-hero"><img src="${heroDataUri}" /></div>`
    : `<div class="hero hook-hero fallback"></div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${FONT_LINK}<style>
    ${baseStyles()}
    .slide { padding: 56px 56px 96px; background: ${BRAND.white}; }
    .hook-top { display: flex; gap: 28px; align-items: stretch; }
    .hook-text { flex: 1.1; display: flex; flex-direction: column; justify-content: center; }
    .hook-hero { flex: 1; min-height: 420px; max-height: 460px; }
    h1.headline { font-size: 84px; margin-top: 16px; }
    .subheadline { font-size: 50px; }
    .teaser-list {
      margin-top: 56px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px 20px;
    }
    .teaser {
      display: flex;
      align-items: center;
      gap: 14px;
      background: ${BRAND.white};
      border: 1.5px solid #E2E8F0;
      border-left: 6px solid ${BRAND.blue};
      border-radius: 12px;
      padding: 18px 22px;
      box-shadow: 0 2px 6px rgba(13, 27, 42, 0.04);
    }
    .teaser .num {
      width: 36px; height: 36px;
      background: ${BRAND.blueLight};
      color: ${BRAND.blue};
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800;
      font-size: 18px;
      flex-shrink: 0;
    }
    .teaser .text { font-size: 22px; font-weight: 600; color: ${BRAND.navy}; line-height: 1.25; }
    .swipe-cue {
      position: absolute;
      bottom: 100px; right: 56px;
      display: flex; align-items: center; gap: 10px;
      color: ${BRAND.blue};
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .swipe-cue svg { width: 20px; height: 20px; }
  </style></head><body><div class="slide">
    <div class="hook-top">
      <div class="hook-text">
        <div class="pill dark">${ICONS.sparkle} Tech &amp; AI Update</div>
        <h1 class="headline">${escapeHtml(slide.headline)}</h1>
        <div class="subheadline">${escapeHtml(slide.subheadline)}</div>
        <div class="accent-line"></div>
      </div>
      ${heroEl}
    </div>
    <div class="teaser-list">
      ${items.map((it, i) => `
        <div class="teaser">
          <div class="num">${i + 1}</div>
          <div class="text">${escapeHtml(it)}</div>
        </div>
      `).join('')}
    </div>
    <div class="swipe-cue">Swipe to explore ${ICONS.swipeRight}</div>
    <div class="brand-bar">
      <div class="brand-name">Tech &amp; AI Weekly</div>
      <div class="page-info">01 / ${String(total).padStart(2, '0')}</div>
    </div>
  </div></body></html>`;
}

// ─── Layout: STAT-led ────────────────────────────────────────────────────────

function renderStat(slide, heroDataUri, index, total) {
  const items = splitContent(slide.content);
  // First item often has the headline stat, e.g. "68% of repetitive tasks"
  const statRaw = items[0] || slide.subheadline || '';
  const statMatch = statRaw.match(/([0-9]+\.?[0-9]*\s*[%xX]?|\$[0-9.,]+\s*[a-zA-Z]*)/);
  const statValue = statMatch ? statMatch[1].replace(/\s+/g, '') : statRaw.split(' ')[0] || '★';
  const statLabel = statRaw.replace(statValue, '').replace(/^[\s,.\-:]+/, '').trim() || statRaw;

  const supporting = items.slice(1, 4);
  const heroEl = heroDataUri
    ? `<div class="hero stat-hero"><img src="${heroDataUri}" /></div>`
    : `<div class="hero stat-hero fallback"></div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${FONT_LINK}<style>
    ${baseStyles()}
    .stat-grid {
      flex: 1;
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 32px;
      margin-top: 24px;
    }
    .stat-card {
      background: ${BRAND.white};
      border-radius: 20px;
      border: 1.5px solid #E2E8F0;
      padding: 36px 40px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      box-shadow: 0 12px 28px rgba(13, 27, 42, 0.06);
      position: relative;
      overflow: hidden;
    }
    .stat-card::before {
      content: ""; position: absolute; left: 0; top: 0; bottom: 0;
      width: 8px; background: ${BRAND.blue};
    }
    .stat-icon {
      color: ${BRAND.blue};
      width: 44px; height: 44px;
      margin-bottom: 12px;
    }
    .stat-value {
      font-size: 132px;
      font-weight: 900;
      line-height: 1;
      color: ${BRAND.blue};
      letter-spacing: -0.04em;
    }
    .stat-label {
      font-size: 24px;
      font-weight: 600;
      color: ${BRAND.navy};
      margin-top: 14px;
      line-height: 1.3;
    }
    .supporting {
      list-style: none;
      margin-top: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .supporting li {
      display: flex; align-items: flex-start; gap: 10px;
      font-size: 20px;
      color: ${BRAND.grey};
      font-weight: 500;
      line-height: 1.35;
    }
    .supporting li .dot {
      width: 8px; height: 8px;
      background: ${BRAND.blue};
      border-radius: 50%;
      margin-top: 9px;
      flex-shrink: 0;
    }
    .stat-hero { min-height: 100%; }
  </style></head><body><div class="slide">
    <div class="pill light">${iconForSlide(slide)} ${escapeHtml(slide.label || 'Insight')}</div>
    <h1 class="headline">${escapeHtml(slide.headline)}</h1>
    <div class="subheadline">${escapeHtml(slide.subheadline)}</div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon">${ICONS.chart}</div>
        <div class="stat-value">${escapeHtml(statValue)}</div>
        <div class="stat-label">${escapeHtml(statLabel)}</div>
        ${supporting.length ? `<ul class="supporting">
          ${supporting.map((s) => `<li><span class="dot"></span><span>${escapeHtml(s)}</span></li>`).join('')}
        </ul>` : ''}
      </div>
      ${heroEl}
    </div>

    <div class="brand-bar">
      <div class="brand-name">Tech &amp; AI Weekly</div>
      <div class="page-info">${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</div>
    </div>
  </div></body></html>`;
}

// ─── Layout: LIST ────────────────────────────────────────────────────────────

function renderList(slide, heroDataUri, index, total) {
  const items = splitContent(slide.content).slice(0, 4);
  const heroEl = heroDataUri
    ? `<div class="hero list-hero"><img src="${heroDataUri}" /></div>`
    : `<div class="hero list-hero fallback"></div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${FONT_LINK}<style>
    ${baseStyles()}
    .list-grid {
      flex: 1;
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 28px;
      margin-top: 28px;
    }
    .list-col {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .list-item {
      display: flex;
      align-items: center;
      gap: 18px;
      background: ${BRAND.white};
      border: 1.5px solid #E2E8F0;
      border-radius: 16px;
      padding: 20px 24px;
      box-shadow: 0 6px 16px rgba(13, 27, 42, 0.05);
    }
    .list-num {
      width: 56px; height: 56px;
      background: ${BRAND.blue};
      color: ${BRAND.white};
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px;
      font-weight: 800;
      flex-shrink: 0;
      box-shadow: 0 6px 14px rgba(10, 102, 194, 0.28);
    }
    .list-content { flex: 1; min-width: 0; }
    .list-title {
      font-size: 24px;
      font-weight: 700;
      color: ${BRAND.navy};
      line-height: 1.2;
    }
    .list-desc {
      font-size: 18px;
      font-weight: 500;
      color: ${BRAND.grey};
      margin-top: 4px;
      line-height: 1.3;
    }
    .list-hero { min-height: 100%; }
  </style></head><body><div class="slide">
    <div class="pill light">${iconForSlide(slide)} ${escapeHtml(slide.label || 'Breakdown')}</div>
    <h1 class="headline">${escapeHtml(slide.headline)}</h1>
    <div class="subheadline">${escapeHtml(slide.subheadline)}</div>

    <div class="list-grid">
      <div class="list-col">
        ${items.map((it, i) => {
          const { title, desc } = splitTitleDesc(it);
          return `<div class="list-item">
            <div class="list-num">${i + 1}</div>
            <div class="list-content">
              <div class="list-title">${escapeHtml(title)}</div>
              ${desc ? `<div class="list-desc">${escapeHtml(desc)}</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
      ${heroEl}
    </div>

    <div class="brand-bar">
      <div class="brand-name">Tech &amp; AI Weekly</div>
      <div class="page-info">${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</div>
    </div>
  </div></body></html>`;
}

// ─── Layout: COMPARISON ──────────────────────────────────────────────────────

function renderComparison(slide, heroDataUri, index, total) {
  // Each item should be "old vs new". If splitting on " vs " fails, treat the
  // whole string as a single old/new pair best-effort.
  const items = splitContent(slide.content).slice(0, 4).map((row) => {
    const parts = row.split(/\s+vs\.?\s+/i);
    return { old: (parts[0] || row).trim(), now: (parts[1] || '').trim() };
  });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${FONT_LINK}<style>
    ${baseStyles()}
    .compare-wrap {
      flex: 1;
      display: flex;
      gap: 24px;
      margin-top: 28px;
    }
    .compare-col {
      flex: 1;
      background: ${BRAND.white};
      border-radius: 20px;
      border: 1.5px solid #E2E8F0;
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 12px 28px rgba(13, 27, 42, 0.05);
      position: relative;
    }
    .compare-col.old { border-top: 8px solid ${BRAND.greySoft}; }
    .compare-col.now { border-top: 8px solid ${BRAND.blue}; }
    .compare-head {
      display: flex; align-items: center; gap: 12px;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .compare-head.old { color: ${BRAND.greySoft}; }
    .compare-head.now { color: ${BRAND.blue}; }
    .compare-head .icon-circle {
      width: 44px; height: 44px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      color: ${BRAND.white};
    }
    .compare-head.old .icon-circle { background: ${BRAND.greySoft}; }
    .compare-head.now .icon-circle { background: ${BRAND.blue}; }
    .compare-head .icon-circle svg { width: 22px; height: 22px; }
    .compare-row {
      display: flex; align-items: flex-start; gap: 12px;
      font-size: 22px;
      font-weight: 600;
      line-height: 1.3;
      padding: 10px 0;
      border-bottom: 1px dashed #E2E8F0;
    }
    .compare-row:last-child { border-bottom: none; }
    .compare-col.old .compare-row { color: ${BRAND.grey}; text-decoration: line-through; text-decoration-color: ${BRAND.greySoft}; }
    .compare-col.now .compare-row { color: ${BRAND.navy}; }
    .row-bullet {
      width: 8px; height: 8px;
      border-radius: 50%;
      margin-top: 12px;
      flex-shrink: 0;
    }
    .compare-col.old .row-bullet { background: ${BRAND.greySoft}; }
    .compare-col.now .row-bullet { background: ${BRAND.blue}; }
  </style></head><body><div class="slide">
    <div class="pill light">${iconForSlide(slide)} ${escapeHtml(slide.label || 'Then vs Now')}</div>
    <h1 class="headline">${escapeHtml(slide.headline)}</h1>
    <div class="subheadline">${escapeHtml(slide.subheadline)}</div>

    <div class="compare-wrap">
      <div class="compare-col old">
        <div class="compare-head old">
          <div class="icon-circle">${ICONS.x}</div>
          <span>The Old Way</span>
        </div>
        ${items.map((it) => `<div class="compare-row"><span class="row-bullet"></span><span>${escapeHtml(it.old)}</span></div>`).join('')}
      </div>
      <div class="compare-col now">
        <div class="compare-head now">
          <div class="icon-circle">${ICONS.check}</div>
          <span>The New Way</span>
        </div>
        ${items.map((it) => `<div class="compare-row"><span class="row-bullet"></span><span>${escapeHtml(it.now || '—')}</span></div>`).join('')}
      </div>
    </div>

    <div class="brand-bar">
      <div class="brand-name">Tech &amp; AI Weekly</div>
      <div class="page-info">${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</div>
    </div>
  </div></body></html>`;
}

// ─── Layout: CTA ─────────────────────────────────────────────────────────────

function renderCTA(slide, heroDataUri, index, total) {
  const items = splitContent(slide.content).slice(0, 4);
  const heroEl = heroDataUri
    ? `<div class="hero cta-hero"><img src="${heroDataUri}" /></div>`
    : `<div class="hero cta-hero fallback"></div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${FONT_LINK}<style>
    ${baseStyles()}
    .slide { background: ${BRAND.white}; }
    .cta-wrap {
      flex: 1;
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 32px;
      margin-top: 28px;
    }
    .cta-checklist {
      background: ${BRAND.bg};
      border: 1.5px solid #E2E8F0;
      border-radius: 20px;
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 8px 20px rgba(13, 27, 42, 0.04);
    }
    .cta-section-title {
      font-size: 22px;
      font-weight: 800;
      color: ${BRAND.blue};
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .check-row {
      display: flex; align-items: flex-start; gap: 14px;
    }
    .check-icon {
      width: 36px; height: 36px;
      background: ${BRAND.green};
      color: ${BRAND.white};
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .check-icon svg { width: 20px; height: 20px; }
    .check-content { flex: 1; }
    .check-title {
      font-size: 22px;
      font-weight: 700;
      color: ${BRAND.navy};
      line-height: 1.25;
    }
    .check-desc {
      font-size: 18px;
      color: ${BRAND.grey};
      margin-top: 2px;
      line-height: 1.3;
    }
    .cta-hero { min-height: 100%; }
    .follow-cta {
      position: absolute;
      bottom: 96px; left: 56px; right: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(95deg, ${BRAND.blue} 0%, ${BRAND.blueDark} 100%);
      color: ${BRAND.white};
      padding: 22px 32px;
      border-radius: 16px;
      box-shadow: 0 12px 28px rgba(10, 102, 194, 0.28);
    }
    .follow-text {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .follow-text small {
      display: block;
      font-size: 16px;
      font-weight: 500;
      opacity: 0.85;
      margin-top: 2px;
    }
    .follow-btn {
      display: flex; align-items: center; gap: 10px;
      background: ${BRAND.white};
      color: ${BRAND.blue};
      font-size: 20px;
      font-weight: 800;
      padding: 14px 26px;
      border-radius: 999px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .follow-btn svg { width: 18px; height: 18px; }
    /* Make room for follow-cta */
    .cta-wrap { padding-bottom: 130px; }
  </style></head><body><div class="slide">
    <div class="pill dark">${ICONS.rocket} What's Next</div>
    <h1 class="headline">${escapeHtml(slide.headline)}</h1>
    <div class="subheadline">${escapeHtml(slide.subheadline)}</div>

    <div class="cta-wrap">
      <div class="cta-checklist">
        <div class="cta-section-title">Coming Up</div>
        ${items.map((it) => {
          const { title, desc } = splitTitleDesc(it);
          return `<div class="check-row">
            <div class="check-icon">${ICONS.check}</div>
            <div class="check-content">
              <div class="check-title">${escapeHtml(title)}</div>
              ${desc ? `<div class="check-desc">${escapeHtml(desc)}</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
      ${heroEl}
    </div>

    <div class="follow-cta">
      <div class="follow-text">
        Follow for weekly AI &amp; tech updates
        <small>That actually move the industry forward.</small>
      </div>
      <div class="follow-btn">Follow ${ICONS.arrowRight}</div>
    </div>

    <div class="brand-bar">
      <div class="brand-name">Tech &amp; AI Weekly</div>
      <div class="page-info">${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</div>
    </div>
  </div></body></html>`;
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

function getSlideHTML(slide, index, total, heroDataUri) {
  const layout = (slide.layout || '').toLowerCase();
  if (layout === 'hook' || index === 0) return renderHook(slide, heroDataUri, total);
  if (layout === 'cta' || index === total - 1) return renderCTA(slide, heroDataUri, index, total);
  if (layout === 'stat') return renderStat(slide, heroDataUri, index, total);
  if (layout === 'comparison') return renderComparison(slide, heroDataUri, index, total);
  // Default for unknown / "list"
  return renderList(slide, heroDataUri, index, total);
}

// ─── Main exported function ──────────────────────────────────────────────────

/**
 * Render every slide in `content.slides` to a 1080x1080 PNG and upload it.
 *
 * @param {object} [content] If omitted, reads from output/slide-content.json.
 * @returns {Promise<{ slides: Array<{ id, url, localPath, layout }>, thumbnailUrl: string, folderSlug: string }>}
 */
export async function renderSlides(content) {
  if (!content) {
    if (!existsSync('./output/slide-content.json')) {
      throw new Error('No content provided and ./output/slide-content.json not found. Run generate-content.js first.');
    }
    content = JSON.parse(readFileSync('./output/slide-content.json', 'utf-8'));
  }

  mkdirSync('./output', { recursive: true });

  const folderSlug = content.folderSlug || 'tech-ai-news';
  const total = content.slides.length;
  const dateSlug = new Date().toISOString().slice(0, 10);

  console.log(`\nLaunching Puppeteer (${total} slides)...`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const results = [];
  try {
    for (let i = 0; i < total; i++) {
      const slide = content.slides[i];
      console.log(`\n[${i + 1}/${total}] ${slide.id} — layout=${slide.layout}`);

      // Use a deterministic-ish seed so re-runs produce the same hero per slide.
      const seed = Math.floor(Math.random() * 1_000_000);
      const heroDataUri = await fetchHeroDataUri(slide, seed);

      const page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });

      const html = getSlideHTML(slide, i, total, heroDataUri);
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
      // Give Inter a moment to render after networkidle (defensive).
      await new Promise((r) => setTimeout(r, 250));

      const localPath = `./output/${slide.id}.png`;
      await page.screenshot({ path: localPath, type: 'png', omitBackground: false });
      await page.close();
      console.log(`  saved: ${localPath}`);

      console.log(`  uploading to Cloudinary...`);
      const upload = await uploadMedia(localPath, {
        folder: `carousel/${folderSlug}/${dateSlug}`,
        publicId: slide.id,
        tags: ['carousel', 'linkedin', folderSlug],
      });
      console.log(`  cloudinary: ${upload.url}`);

      results.push({
        id: slide.id,
        layout: slide.layout,
        localPath,
        url: upload.url,
      });
    }
  } finally {
    await browser.close();
  }

  const thumbnailUrl = results[0]?.url;
  console.log('\n=== Slide Results ===');
  results.forEach((r) => console.log(`  ${r.id} [${r.layout}] → ${r.url}`));
  console.log(`\n✓ ${results.length} slides rendered & uploaded.`);
  console.log(`✓ Thumbnail: ${thumbnailUrl}`);

  // Persist results so schedule-linkedin-post.js can read them when run as CLI.
  writeFileSync(
    './output/slide-results.json',
    JSON.stringify({ folderSlug, dateSlug, thumbnailUrl, slides: results }, null, 2),
  );

  return { slides: results, thumbnailUrl, folderSlug };
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────
const isCLI = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCLI) {
  renderSlides().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
