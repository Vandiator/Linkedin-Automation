import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { uploadMedia } from './upload.js';

// ─── Hugging Face config (reads HF_API_KEY from .env) ────────────────────
const HF_API_KEY = process.env.HF_API_KEY;
const HF_MODEL = 'black-forest-labs/FLUX.1-schnell'; // Free, fast, high quality

// ─── YOUR SETTINGS ────────────────────────────────────────────────────────
const TOPIC = 'Latest Tech & AI Updates You Need To Know';
const FOLDER_SLUG = 'tech-ai-news';

// ─── STYLE RULES ──────────────────────────────────────────────────────────
const STYLE_RULES = `
Visual style — follow exactly:
- Background: clean white or very light grey. No dark backgrounds.
- Accent color: strong professional blue (LinkedIn blue #0A66C2) for highlight blocks, borders, icons, divider lines.
- Typography: clean modern sans-serif headlines in deep navy, bold. Subtext in medium grey.
- Key headline words inside a solid blue rectangular highlight block with white text.
- Layout: minimal, structured, lots of breathing room. McKinsey slide meets LinkedIn post.
- Icons: flat 2D line-art style in blue and navy. No 3D. No characters. No mascots.
- Stats: inside clean rounded cards with thin blue border and blue left accent bar.
- Dividers: thin single blue horizontal rules.
- No gradients. No glow effects. No dark lighting.
- 1:1 square format. Clean margins on all sides.
- Mood: authoritative, professional, trustworthy.
- Bottom of slide: thin blue bar with small white text "Tech & AI Weekly" centered.
`;

// ─── SLIDES ───────────────────────────────────────────────────────────────
const slides = [
  {
    id: 'slide-1-hook',
    label: 'Hook',
    prompt: `Professional LinkedIn carousel slide, clean white background. 
Top: small blue pill tag "TECH & AI UPDATE". Large bold navy headline "THE TECH SHIFTS". 
Second line inside solid blue highlight block white text "HAPPENING RIGHT NOW". 
Thin blue divider line below headline.
Center: 2x3 grid of six white cards with blue borders showing: rocket icon "AI Agents", chip icon "GPT-5 Era", code icon "AI Coding", paintbrush icon "AI Design", globe icon "Open Source AI", arrow icon "What's Next".
Bottom right small text "Swipe to explore". Bottom blue bar white text "Tech & AI Weekly".
${STYLE_RULES}`,
  },
  {
    id: 'slide-2-ai-agents',
    label: 'AI Agents',
    prompt: `Professional LinkedIn carousel slide, clean white background.
Top left blue pill "01 / 05". Bold navy "AI AGENTS ARE". Blue highlight block white text "REPLACING WORKFLOWS". Thin blue divider.
Center: three horizontal white stat cards with blue borders and blue left accent bars:
First card robot icon bold navy "68%" grey text "of repetitive tasks automated by AI agents in 2025".
Second card chain icon bold navy "$4.4T" grey text "estimated productivity gain from AI agents by 2030".
Third card lightning icon bold navy "10x" grey text "faster task completion vs manual workflows".
Small navy text below "Tools leading this: AutoGPT, Claude, LangChain, CrewAI".
Bottom blue bar white text "Tech & AI Weekly".
${STYLE_RULES}`,
  },
  {
    id: 'slide-3-gpt5-era',
    label: 'GPT-5 Era',
    prompt: `Professional LinkedIn carousel slide, clean white background.
Top left blue pill "02 / 05". Bold navy "NEW AI MODELS ARE". Blue highlight block white text "CHANGING EVERYTHING". Thin blue divider.
Center: four stacked white cards with blue left accent bars:
First: navy bold "Multimodal reasoning" grey "Models now see, hear, and read simultaneously".
Second: navy bold "Real-time web access" grey "AI answers are no longer stuck in the past".
Third: navy bold "Longer context windows" grey "Entire codebases and books fit in one prompt".
Fourth: navy bold "On-device AI" grey "Powerful models running locally on your laptop".
Bottom blue bar white text "Tech & AI Weekly".
${STYLE_RULES}`,
  },
  {
    id: 'slide-4-ai-coding',
    label: 'AI Coding',
    prompt: `Professional LinkedIn carousel slide, clean white background.
Top left blue pill "03 / 05". Bold navy "AI IS WRITING". Blue highlight block white text "YOUR CODE NOW". Thin blue divider.
Center: 2x2 grid of four white tool cards with blue borders and blue top accent bars:
Card 1 code icon navy "GitHub Copilot" grey "Autocomplete for entire functions".
Card 2 terminal icon navy "Claude Code" grey "Agentic coding in your terminal".
Card 3 cursor icon navy "Cursor AI" grey "AI-native code editor".
Card 4 bolt icon navy "Devin" grey "World's first AI software engineer".
Small navy sentence below "Junior devs who use these tools are outperforming seniors who don't."
Bottom blue bar white text "Tech & AI Weekly".
${STYLE_RULES}`,
  },
  {
    id: 'slide-5-ai-design',
    label: 'AI Design',
    prompt: `Professional LinkedIn carousel slide, clean white background.
Top left blue pill "04 / 05". Bold navy "DESIGN JUST GOT". Blue highlight block white text "DISRUPTED BY AI". Thin blue divider.
Center: horizontal timeline four steps connected by thin blue line with blue dot nodes:
Step 1 navy "Prompt" grey "Describe what you want".
Step 2 navy "Generate" grey "AI creates multiple variations".
Step 3 navy "Refine" grey "Edit with natural language".
Step 4 navy "Export" grey "Production-ready in minutes".
White card below with blue left bar: navy "Tools: Midjourney V7, Figma AI, Adobe Firefly, Canva AI" grey "Design teams are 3x faster or being replaced entirely."
Bottom blue bar white text "Tech & AI Weekly".
${STYLE_RULES}`,
  },
  {
    id: 'slide-6-cta',
    label: 'CTA',
    prompt: `Professional LinkedIn carousel slide, clean white background.
Top left blue pill "05 / 05". Bold navy "STAY AHEAD OF". Blue highlight block white text "EVERY AI SHIFT". Thin blue divider.
Center white rounded card with blue border and blue top accent bar:
Navy bold title "What's coming next:" followed by four bullet rows:
Blue dot navy "Humanoid robots" grey "Mass production begins in 2025".
Blue dot navy "AI Browsers" grey "Agents that browse the web for you".
Blue dot navy "Spatial Computing" grey "Apple Vision Pro ecosystem exploding".
Blue dot navy "Open Source AGI" grey "Meta and Mistral closing the gap fast".
Below card centered navy text "Follow for weekly updates on what's changing in tech and AI."
Blue rounded button shape white bold text "Follow for more".
Bottom blue bar white text "Tech & AI Weekly".
${STYLE_RULES}`,
  },
];

// ─── GENERATE ONE SLIDE via Hugging Face FLUX (FREE) ─────────────────────
async function generateSlide(slide) {
  console.log(`[${slide.id}] Generating with Hugging Face FLUX...`);

  if (!HF_API_KEY) throw new Error('Missing HF_API_KEY in .env');

  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: slide.prompt,
        parameters: {
          width: 1024,
          height: 1024,
          num_inference_steps: 4,
        },
      }),
    }
  );

  // Handle model loading (HF sometimes needs a warm-up)
  if (response.status === 503) {
    const json = await response.json();
    const waitTime = (json.estimated_time || 20) * 1000;
    console.log(`[${slide.id}] Model loading, waiting ${Math.ceil(waitTime/1000)}s...`);
    await new Promise(res => setTimeout(res, waitTime));
    return generateSlide(slide); // retry
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HF API error ${response.status}: ${err}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const localPath = `./output/${slide.id}.png`;
  writeFileSync(localPath, buffer);
  console.log(`[${slide.id}] Saved locally. Uploading to Cloudinary...`);

  const dateSlug = new Date().toISOString().slice(0, 10);
  const upload = await uploadMedia(localPath, {
    folder: `carousel/${FOLDER_SLUG}/${dateSlug}`,
    publicId: slide.id,
    tags: ['carousel', 'linkedin', FOLDER_SLUG, slide.label.toLowerCase()],
  });

  return { ...upload, label: slide.label };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync('./output', { recursive: true });

  const results = [];
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (i > 0) {
      console.log(`Waiting 10 seconds before next slide...`);
      await new Promise(res => setTimeout(res, 10000));
    }
    try {
      const r = await generateSlide(slide);
      results.push({ slide: slide.id, label: r.label, url: r.url });
      console.log(`[${slide.id}] DONE — ${r.url}`);
    } catch (e) {
      console.error(`[${slide.id}] FAILED: ${e.message}`);
      results.push({ slide: slide.id, error: e.message });
    }
  }

  console.log('\n=== Carousel Results ===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
