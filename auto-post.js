// auto-post.js
// ─────────────────────────────────────────────────────────────────────────────
// Single entry point that runs the full weekly pipeline:
//   1. generate-content.js  → write content + image prompts (Groq + RSS)
//   2. render-slides.js     → fetch hero images + render PNGs + upload (Pollinations + Puppeteer + Cloudinary)
//   3. schedule-linkedin-post.js → stitch PDF + schedule for Monday 09:00 IST (Buffer)
//
// This is what GitHub Actions calls. Run locally with `node auto-post.js`.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { generateContent } from './generate-content.js';
import { renderSlides } from './render-slides.js';
import { schedulePost } from './schedule-linkedin-post.js';

const REQUIRED_ENV = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'GROQ_API_KEY',
  'BUFFER_API_TOKEN',
  'LINKEDIN_CHANNEL_ID',
];

function checkEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('Missing required environment variables:');
    missing.forEach((k) => console.error(`  - ${k}`));
    console.error('\nIf running locally, copy .env.example to .env and fill in the values.');
    console.error('If running on GitHub Actions, add them under Settings → Secrets and variables → Actions.');
    process.exit(1);
  }
}

function header(title) {
  const bar = '─'.repeat(72);
  console.log(`\n${bar}\n  ${title}\n${bar}`);
}

async function main() {
  const startedAt = Date.now();
  console.log(`LinkedIn Auto-Poster — started ${new Date().toISOString()}`);

  checkEnv();

  // ── Step 1: content generation ─────────────────────────────────────────
  header('STEP 1/3 · GENERATE CONTENT (Groq + RSS)');
  const content = await generateContent();

  // ── Step 2: slide rendering + hero images + Cloudinary upload ──────────
  header('STEP 2/3 · RENDER SLIDES (Pollinations + Puppeteer + Cloudinary)');
  const renderResults = await renderSlides(content);

  // ── Step 3: PDF + Buffer scheduling ────────────────────────────────────
  header('STEP 3/3 · SCHEDULE POST (Buffer → LinkedIn)');
  const schedResult = await schedulePost({
    postCaption: content.postCaption,
    topic: content.topic,
    folderSlug: renderResults.folderSlug,
    thumbnailUrl: renderResults.thumbnailUrl,
    localSlidePaths: renderResults.slides.map((s) => s.localPath),
  });

  // ── Summary ────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  header(`✓ DONE in ${elapsed}s`);
  console.log(`  Topic        : ${content.topic}`);
  console.log(`  Slides       : ${renderResults.slides.length}`);
  console.log(`  PDF          : ${schedResult.pdfUrl}`);
  console.log(`  Buffer post  : ${schedResult.postId} (${schedResult.status})`);
  console.log(`  Scheduled at : ${schedResult.dueAt}`);
  console.log('\nThe carousel will auto-publish at the time above. Nothing more for you to do.');
}

main().catch((e) => {
  console.error('\n✗ Pipeline failed:');
  console.error(e.stack || e.message || e);
  process.exit(1);
});
