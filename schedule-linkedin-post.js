// schedule-linkedin-post.js
// ─────────────────────────────────────────────────────────────────────────────
// Step 3 of the weekly pipeline.
//
// Reads:
//   - output/slide-content.json  → topic, postCaption, slides
//   - output/slide-results.json  → thumbnailUrl, folderSlug, per-slide local PNG paths
// Stitches the slide PNGs into a single PDF, uploads the PDF to Cloudinary as
// a `raw` resource, verifies it's publicly fetchable, then schedules a
// LinkedIn document post via the Buffer GraphQL API.
//
// Posting time is auto-computed: next Monday 09:00 Asia/Kolkata (IST). If the
// target is already in the past or too close to "now", we pad to now + 5 min
// so Buffer publishes promptly.
//
// Exposes schedulePost(input?) so auto-post.js can call it. CLI mode too.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { PDFDocument } from 'pdf-lib';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cloudinary } from './client.js';

const BUFFER_GRAPHQL = 'https://api.buffer.com/graphql';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute the next Monday 09:00 Asia/Kolkata (UTC+05:30) as an ISO 8601 string.
 * - If we're already past Monday 09:00 IST this week, schedule for next Monday.
 * - If the target is < 2 minutes from now (e.g. running at 09:00 IST Monday
 *   from GitHub Actions), pad to now + 5 minutes so Buffer publishes promptly.
 */
export function getNextMonday9amIST() {
  const IST_OFFSET_MIN = 5 * 60 + 30; // +05:30
  const nowMs = Date.now();

  // Read current IST wall-clock by shifting UTC and using getUTC* on that.
  const istNow = new Date(nowMs + IST_OFFSET_MIN * 60_000);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();
  const day = istNow.getUTCDay(); // 0 Sun .. 6 Sat

  // Always schedule for the *current* Monday if today is Monday — the padding
  // below handles the case where 09:00 IST has already passed (e.g. GH
  // Actions ran with a 30-min cron delay). On any other day, jump to the
  // upcoming Monday.
  let daysAhead;
  if (day === 1) {
    daysAhead = 0;
  } else {
    daysAhead = ((1 - day) + 7) % 7;
    if (daysAhead === 0) daysAhead = 7;
  }

  // Build the IST wall-clock instant for Monday 09:00, then convert back to UTC.
  const targetIstMs = Date.UTC(y, m, d + daysAhead, 9, 0, 0);
  const targetUtcMs = targetIstMs - IST_OFFSET_MIN * 60_000;

  if (targetUtcMs - nowMs < 2 * 60_000) {
    return new Date(nowMs + 5 * 60_000).toISOString();
  }
  return new Date(targetUtcMs).toISOString();
}

async function gql(query, variables = {}) {
  if (!process.env.BUFFER_API_TOKEN) throw new Error('Missing BUFFER_API_TOKEN in environment.');
  const res = await fetch(BUFFER_GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.BUFFER_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

/** Best-effort fallback: glob slide PNGs in ./output (skip hero-*). */
function discoverSlidePaths() {
  const dir = './output';
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.png') && f.startsWith('slide-') && !f.startsWith('hero-'))
    .sort()
    .map((f) => `${dir}/${f}`);
}

/**
 * Resolve the inputs schedulePost() needs from the on-disk JSON files written
 * by the previous pipeline steps. Allows callers to override any field.
 */
function resolveInputs(overrides = {}) {
  const out = { ...overrides };

  if (!out.postCaption || !out.topic || !out.slides) {
    if (!existsSync('./output/slide-content.json')) {
      throw new Error('Missing ./output/slide-content.json. Run generate-content.js first.');
    }
    const content = JSON.parse(readFileSync('./output/slide-content.json', 'utf-8'));
    out.postCaption ||= content.postCaption;
    out.topic ||= content.topic;
    out.folderSlug ||= content.folderSlug;
  }

  if (!out.thumbnailUrl || !out.localSlidePaths) {
    if (existsSync('./output/slide-results.json')) {
      const results = JSON.parse(readFileSync('./output/slide-results.json', 'utf-8'));
      out.thumbnailUrl ||= results.thumbnailUrl;
      out.folderSlug ||= results.folderSlug;
      out.localSlidePaths ||= results.slides?.map((s) => s.localPath);
    }
  }

  if (!out.localSlidePaths || out.localSlidePaths.length === 0) {
    out.localSlidePaths = discoverSlidePaths();
  }

  if (!out.localSlidePaths.length) {
    throw new Error('No slide PNGs found. Did render-slides.js run successfully?');
  }
  if (!out.thumbnailUrl) {
    throw new Error('No thumbnailUrl available. Did render-slides.js write slide-results.json?');
  }
  if (!out.postCaption) {
    throw new Error('No postCaption available. Check output/slide-content.json.');
  }

  out.folderSlug ||= 'tech-ai-news';
  out.dueAt ||= getNextMonday9amIST();
  out.docTitle ||= out.topic || 'Tech & AI Weekly';
  out.pdfPublicId ||= `carousel-${out.folderSlug}`;

  return out;
}

// ─── PDF + Cloudinary ────────────────────────────────────────────────────────

async function buildPdf(localSlidePaths, pdfPublicId) {
  console.log(`Stitching ${localSlidePaths.length} slides into PDF...`);
  const pdf = await PDFDocument.create();
  for (const path of localSlidePaths) {
    if (!existsSync(path)) throw new Error(`Slide file missing: ${path}`);
    const bytes = readFileSync(path);
    // All slides are PNG. pdf-lib chooses the embed by file signature; we use
    // embedPng directly because render-slides.js always produces PNG.
    const img = await pdf.embedPng(bytes);
    const page = pdf.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  const out = await pdf.save();
  mkdirSync('./output', { recursive: true });
  const outPath = `./output/${pdfPublicId}.pdf`;
  writeFileSync(outPath, out);
  console.log(`PDF written: ${(out.length / 1024).toFixed(0)} KB · ${localSlidePaths.length} pages → ${outPath}`);
  return outPath;
}

async function uploadPdfAsRaw(localPath, folderSlug, pdfPublicId) {
  console.log('\nUploading PDF to Cloudinary (raw)...');
  const result = await cloudinary.uploader.upload(localPath, {
    resource_type: 'raw',
    folder: `carousel/${folderSlug}`,
    public_id: `${pdfPublicId}.pdf`,
    use_filename: false,
    overwrite: true,
    tags: ['carousel', 'linkedin', 'pdf', folderSlug],
  });
  console.log(`PDF URL: ${result.secure_url}`);
  return result.secure_url;
}

async function verifyAccessible(url) {
  const res = await fetch(url, { method: 'HEAD' });
  if (!res.ok) {
    throw new Error(
      `PDF not publicly accessible (HTTP ${res.status}). ` +
      `Enable "Allow delivery of PDF and ZIP files" at ` +
      `https://console.cloudinary.com/settings/security`
    );
  }
  console.log(`Verified ${res.status} ${res.headers.get('content-type') || ''}`);
}

async function schedule(channelId, pdfUrl, postCaption, dueAt, docTitle, thumbnailUrl) {
  console.log('\nScheduling via Buffer GraphQL...');
  const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        __typename
        ... on PostActionSuccess { post { id status dueAt } }
        ... on NotFoundError { message }
        ... on UnauthorizedError { message }
        ... on UnexpectedError { message }
        ... on RestProxyError { message link code }
        ... on LimitReachedError { message }
        ... on InvalidInputError { message }
      }
    }
  `;
  // Buffer migrated assets to an ordered array of typed items (May 2026).
  // Each entry specifies exactly one of: image | video | document | link.
  const input = {
    channelId,
    text: postCaption,
    schedulingType: 'automatic',
    mode: 'customScheduled',
    dueAt,
    assets: [
      {
        document: {
          url: pdfUrl,
          title: docTitle,
          thumbnailUrl,
        },
      },
    ],
  };
  return gql(mutation, { input });
}

// ─── Public function ─────────────────────────────────────────────────────────

/**
 * Build the carousel PDF, upload it, and schedule a Buffer post.
 * @param {object} [overrides]
 *   { postCaption?, topic?, folderSlug?, thumbnailUrl?, localSlidePaths?, dueAt?, docTitle?, pdfPublicId?, channelId? }
 * @returns {Promise<{ postId: string, status: string, dueAt: string, pdfUrl: string }>}
 */
export async function schedulePost(overrides = {}) {
  const channelId = overrides.channelId || process.env.LINKEDIN_CHANNEL_ID;
  if (!channelId) throw new Error('Missing LINKEDIN_CHANNEL_ID in environment.');

  const inputs = resolveInputs(overrides);
  console.log(`Topic       : ${inputs.topic || '(none)'}`);
  console.log(`Slides      : ${inputs.localSlidePaths.length}`);
  console.log(`Thumbnail   : ${inputs.thumbnailUrl}`);
  console.log(`Due at      : ${inputs.dueAt}`);
  console.log(`Channel     : ${channelId}`);

  const pdfPath = await buildPdf(inputs.localSlidePaths, inputs.pdfPublicId);
  const pdfUrl = await uploadPdfAsRaw(pdfPath, inputs.folderSlug, inputs.pdfPublicId);
  await verifyAccessible(pdfUrl);

  const result = await schedule(
    channelId,
    pdfUrl,
    inputs.postCaption,
    inputs.dueAt,
    inputs.docTitle,
    inputs.thumbnailUrl,
  );

  console.log('\n=== Buffer response ===');
  console.log(JSON.stringify(result, null, 2));

  if (result.errors) {
    throw new Error(`Buffer GraphQL errors: ${JSON.stringify(result.errors)}`);
  }
  const post = result.data?.createPost;
  if (!post) throw new Error('Buffer returned no createPost payload');
  if (post.__typename !== 'PostActionSuccess') {
    throw new Error(`Buffer ${post.__typename}: ${post.message || 'unknown error'}`);
  }

  console.log(`\n✓ Scheduled! Post ID ${post.post.id}`);
  console.log(`  Status: ${post.post.status}`);
  console.log(`  Due at: ${post.post.dueAt}`);

  return {
    postId: post.post.id,
    status: post.post.status,
    dueAt: post.post.dueAt,
    pdfUrl,
  };
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────
const isCLI = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCLI) {
  schedulePost().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
