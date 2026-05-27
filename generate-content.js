import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function generateContent() {
  console.log('Asking Groq to research latest AI/Tech news...');

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `You are a LinkedIn content expert specializing in AI and tech news.
Your job is to create engaging carousel slide content based on the latest AI and tech developments.
CRITICAL: You must respond with ONLY a valid JSON object.
CRITICAL: Never use actual newlines inside JSON string values — use a space instead.
CRITICAL: No markdown, no backticks, no explanation. Just raw JSON.`,
      },
      {
        role: 'user',
        content: `Based on the latest AI and tech news in ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}, create content for a 6-slide LinkedIn carousel.

IMPORTANT RULES:
- All string values must be on a single line — no line breaks inside strings
- Use actual recent AI/tech news, launches, breakthroughs happening right now
- Make content specific with real company names, real stats, real tool names

Respond with ONLY this exact JSON (no markdown, no backticks, single-line strings only):
{"topic":"main topic","folderSlug":"topic-slug","postCaption":"full linkedin post caption with emojis and hashtags 150-200 words","slides":[{"id":"slide-1-hook","label":"Hook","headline":"MAIN HEADLINE","subheadline":"highlighted subheadline","content":"what to show: icons cards stats visuals all on one line","visualDescription":"main visual description"},{"id":"slide-2","label":"Topic 1","headline":"SLIDE 2 HEADLINE","subheadline":"highlighted text","content":"specific stats facts tool names all on one line","visualDescription":"visual description"},{"id":"slide-3","label":"Topic 2","headline":"SLIDE 3 HEADLINE","subheadline":"highlighted text","content":"specific stats facts tool names all on one line","visualDescription":"visual description"},{"id":"slide-4","label":"Topic 3","headline":"SLIDE 4 HEADLINE","subheadline":"highlighted text","content":"specific stats facts tool names all on one line","visualDescription":"visual description"},{"id":"slide-5","label":"Topic 4","headline":"SLIDE 5 HEADLINE","subheadline":"highlighted text","content":"specific stats facts tool names all on one line","visualDescription":"visual description"},{"id":"slide-6-cta","label":"CTA","headline":"STAY AHEAD OF","subheadline":"EVERY AI SHIFT","content":"4 upcoming trends in AI and tech all on one line separated by commas","visualDescription":"follow for more cta visual"}]}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  let raw = completion.choices[0].message.content.trim();

  // ── Robust cleaning ──────────────────────────────────────────────────────

  // Remove markdown code fences
  raw = raw.replace(/```json|```/g, '').trim();

  // Find the first { and last } to extract just the JSON object
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in response');
  raw = raw.slice(start, end + 1);

  // Remove actual newlines and extra spaces inside the JSON
  // This handles multiline string values safely
  raw = raw
    .replace(/\r\n/g, ' ')  // Windows line endings
    .replace(/\r/g, ' ')    // Old Mac line endings
    .replace(/\n/g, ' ')    // Unix line endings
    .replace(/\t/g, ' ')    // Tabs
    .replace(/\s{2,}/g, ' ') // Multiple spaces to one
    .trim();

  let content;
  try {
    content = JSON.parse(raw);
  } catch (e) {
    console.error('Raw cleaned JSON:', raw.substring(0, 500));
    throw new Error(`JSON parse failed: ${e.message}`);
  }

  // ── Validate structure ────────────────────────────────────────────────────
  if (!content.slides || content.slides.length < 6) {
    throw new Error('Content missing slides or less than 6 slides');
  }

  // ── Save output ───────────────────────────────────────────────────────────
  mkdirSync('./output', { recursive: true });
  writeFileSync('./output/slide-content.json', JSON.stringify(content, null, 2));

  console.log(`✓ Topic: "${content.topic}"`);
  console.log(`✓ Slides generated: ${content.slides.length}`);
  console.log(`✓ Saved to output/slide-content.json`);
  console.log('\nSlide headlines:');
  content.slides.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.headline} — ${s.subheadline}`);
  });

  return content;
}

generateContent().catch(e => { console.error(e); process.exit(1); });
