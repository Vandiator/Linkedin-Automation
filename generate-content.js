// generate-content.js
// ─────────────────────────────────────────────────────────────────────────────
// Step 1 of the weekly pipeline.
//
// 1. Pull the top AI/tech headlines from Hacker News' "best" RSS feed.
// 2. Feed those headlines plus the current date into Groq (Llama 3.3 70B).
// 3. Ask Groq to return a structured JSON object describing a LinkedIn
//    carousel: topic, post caption, and 5 slides (hook + 3 topic + CTA).
//    Each topic slide also includes:
//      - layout: "stat" | "list" | "comparison" (renderer picks template)
//      - imagePrompt: a clean visual prompt for Pollinations (no text in the
//        image — text is overlaid by Puppeteer)
// 4. Save the result to output/slide-content.json.
//
// Exposes generateContent() so auto-post.js can call it programmatically.
// Still runs as a CLI when invoked directly: `node generate-content.js`.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Groq from 'groq-sdk';
import RSSParser from 'rss-parser';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const rss = new RSSParser({ timeout: 8000 });

// Hacker News "best" feed — high-signal, regularly updated.
// Docs: https://hnrss.org
const HN_URL = 'https://hnrss.org/best?count=20';

// Keywords used to bias headlines toward our niche (AI / tech / coding / design).
const NICHE_KEYWORDS = [
  'ai', 'gpt', 'llm', 'claude', 'gemini', 'openai', 'anthropic', 'meta',
  'agent', 'agents', 'model', 'neural', 'machine learning', 'ml',
  'coding', 'developer', 'software', 'code', 'github', 'cursor',
  'design', 'figma', 'ux', 'ui', 'product',
  'startup', 'launch', 'release', 'open source', 'opensource',
  'robot', 'humanoid', 'tesla', 'apple', 'google', 'microsoft',
  'quantum', 'chip', 'gpu', 'nvidia', 'amd', 'intel',
  'cloud', 'aws', 'azure', 'browser', 'spatial', 'ar', 'vr', 'xr',
];

/**
 * Fetch the latest AI/tech headlines from Hacker News.
 * Returns an array of plain strings. If RSS is unreachable, returns [] so the
 * pipeline can still run with a generic prompt rather than failing the week.
 */
async function fetchTrendingHeadlines() {
  try {
    console.log(`Fetching headlines from ${HN_URL} ...`);
    const feed = await rss.parseURL(HN_URL);
    const items = (feed.items || []).map((it) => (it.title || '').trim()).filter(Boolean);

    // Bias toward niche keywords; if not enough match, fall back to top items.
    const matches = items.filter((title) => {
      const t = title.toLowerCase();
      return NICHE_KEYWORDS.some((kw) => t.includes(kw));
    });

    const chosen = (matches.length >= 6 ? matches : items).slice(0, 10);
    console.log(`Got ${chosen.length} headlines (${matches.length} niche-matched).`);
    return chosen;
  } catch (e) {
    console.warn(`RSS fetch failed (${e.message}). Continuing without headlines.`);
    return [];
  }
}

/**
 * Build the user prompt for Groq, embedding the headlines (if any).
 */
function buildPrompt(headlines) {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const headlinesBlock = headlines.length
    ? `Here are ${headlines.length} recent headlines from Hacker News for context. Pick the most interesting AI/tech angle from these (or a closely related theme) — do NOT just rephrase a headline:\n` +
      headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')
    : `(No live headlines available — use your knowledge of recent AI/tech trends.)`;

  return `Today is ${today}.

${headlinesBlock}

Create content for a 5-slide LinkedIn carousel for a professional audience interested in AI, tech, coding, and design.

Slide structure (exactly 5 slides):
  1. HOOK — grabs attention, teases what's inside
  2. TOPIC 1 — first specific point with stats / facts / tool names
  3. TOPIC 2 — second specific point with stats / facts / tool names
  4. TOPIC 3 — third specific point with stats / facts / tool names
  5. CTA — what's coming next + follow prompt

Each TOPIC slide MUST include a "layout" field, one of:
  - "stat"        → leads with one big number/percentage and 2-3 supporting points
  - "list"        → a numbered list of 3-4 short items
  - "comparison"  → "old way vs new way" two-column contrast (use ' vs ' inside content)

Distribute the three layouts across the three topic slides (each used once).

Each slide MUST include an "imagePrompt" field describing a CONCEPTUAL background visual for Pollinations.ai. Rules for imagePrompt:
  - NO text, NO words, NO letters, NO numbers in the image
  - NO faces of real people, NO logos, NO brand marks
  - Style: minimalist editorial illustration, clean blue and white, soft shadows, subtle gradients, abstract tech aesthetic, isometric or flat vector look
  - Subject: an abstract symbolic representation of the slide topic (e.g. "abstract neural network nodes glowing softly", "isometric stack of translucent code blocks")
  - One sentence, 15-25 words

CRITICAL FORMAT RULES:
- Respond with ONLY a valid JSON object — no markdown, no backticks, no explanation
- All string values on a single line — no line breaks inside strings
- Use real tool names, real company names, plausible recent stats

Return EXACTLY this JSON shape:
{"topic":"main theme in 4-7 words","folderSlug":"kebab-case-slug","postCaption":"full LinkedIn post 150-200 words with line breaks shown as \\n and 4-6 hashtags at the end","slides":[{"id":"slide-1-hook","label":"Hook","layout":"hook","headline":"BIG HEADLINE IN CAPS","subheadline":"highlighted phrase","content":"3-4 short teaser items separated by commas","imagePrompt":"conceptual visual prompt"},{"id":"slide-2","label":"Topic 1","layout":"stat","headline":"SLIDE 2 HEADLINE","subheadline":"highlighted phrase","content":"the stat goes first like '68% of X', then 3 short supporting points separated by commas","imagePrompt":"conceptual visual prompt"},{"id":"slide-3","label":"Topic 2","layout":"list","headline":"SLIDE 3 HEADLINE","subheadline":"highlighted phrase","content":"4 short items separated by commas","imagePrompt":"conceptual visual prompt"},{"id":"slide-4","label":"Topic 3","layout":"comparison","headline":"SLIDE 4 HEADLINE","subheadline":"highlighted phrase","content":"old way vs new way, old way 2 vs new way 2, old way 3 vs new way 3","imagePrompt":"conceptual visual prompt"},{"id":"slide-5-cta","label":"CTA","layout":"cta","headline":"STAY AHEAD OF","subheadline":"EVERY AI SHIFT","content":"4 upcoming trends separated by commas, each in 'Title: short description' format","imagePrompt":"conceptual visual prompt"}]}`;
}

/**
 * Robustly extract a JSON object from a model response that might include
 * stray markdown, code fences, or whitespace.
 */
function extractJSON(raw) {
  let text = raw.trim().replace(/```json|```/g, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in Groq response');
  }
  text = text
    .slice(start, end + 1)
    .replace(/\r\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\u2028/g, ' ')
    .replace(/\u2029/g, ' ');
  // We allow real \n inside postCaption — Groq uses \\n in JSON, which is valid.
  // Collapse only doubled spaces, not newlines, to keep caption formatting.
  text = text.replace(/[ \t]{2,}/g, ' ').trim();
  return JSON.parse(text);
}

/**
 * Validate the generated content has the shape downstream code expects.
 */
function validate(content) {
  if (!content || typeof content !== 'object') throw new Error('Content is not an object');
  if (!Array.isArray(content.slides) || content.slides.length < 3) {
    throw new Error(`Expected 3+ slides, got ${content.slides?.length ?? 0}`);
  }
  for (const s of content.slides) {
    for (const key of ['id', 'headline', 'subheadline', 'content']) {
      if (!s[key] || typeof s[key] !== 'string') {
        throw new Error(`Slide ${s.id || '?'} missing required field "${key}"`);
      }
    }
    // Backfill optional fields so the renderer never crashes.
    s.layout ||= s.id.includes('hook') ? 'hook' : s.id.includes('cta') ? 'cta' : 'list';
    s.imagePrompt ||= `minimalist editorial illustration of ${s.headline.toLowerCase()}, abstract blue and white tech aesthetic, soft gradients, no text`;
    s.label ||= s.id;
  }
  if (!content.topic) content.topic = 'Tech & AI Update';
  if (!content.folderSlug) {
    content.folderSlug = content.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tech-ai-news';
  }
  if (!content.postCaption) {
    content.postCaption = `${content.topic}\n\nThis week's must-know shifts in AI, tech, coding, and design.\n\nFollow for more.\n\n#AI #Tech #Innovation`;
  }
}

/**
 * Main public function. Returns the validated content object AND writes it
 * to ./output/slide-content.json.
 */
export async function generateContent() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('Missing GROQ_API_KEY in environment.');
  }

  const headlines = await fetchTrendingHeadlines();

  console.log('Asking Groq (Llama 3.3 70B) to write the carousel...');
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content:
          'You are a senior LinkedIn content strategist who writes professional, McKinsey-style carousels about AI, tech, coding, and design. ' +
          'You ALWAYS respond with a single valid JSON object. ' +
          'No markdown, no code fences, no commentary, no trailing text. ' +
          'Inside string values, never use literal newlines — write \\n if you need a line break.',
      },
      { role: 'user', content: buildPrompt(headlines) },
    ],
    temperature: 0.7,
    max_tokens: 2400,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '';
  let content;
  try {
    content = extractJSON(raw);
  } catch (e) {
    console.error('Raw Groq response:\n', raw.slice(0, 800));
    throw new Error(`Could not parse Groq response as JSON: ${e.message}`);
  }

  validate(content);

  mkdirSync('./output', { recursive: true });
  writeFileSync('./output/slide-content.json', JSON.stringify(content, null, 2));

  console.log(`✓ Topic: "${content.topic}"`);
  console.log(`✓ Slides: ${content.slides.length}`);
  console.log('✓ Saved → output/slide-content.json\n');
  console.log('Slide headlines:');
  content.slides.forEach((s, i) => {
    console.log(`  ${i + 1}. [${s.layout}] ${s.headline} — ${s.subheadline}`);
  });

  return content;
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────
const isCLI = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCLI) {
  generateContent().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
