import { cloudinary } from './client.js';
import { basename, extname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.heic']);

function detectKind(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (IMAGE_EXTS.has(ext)) return 'image';
  return 'auto';
}

function monthFolder(kind) {
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const bucket = kind === 'video' ? 'videos' : kind === 'image' ? 'images' : 'other';
  return `generated/${bucket}/${ym}`;
}

export async function uploadMedia(filePath, options = {}) {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const kind = detectKind(filePath);
  const resource_type = kind === 'auto' ? 'auto' : kind;
  const folder = options.folder ?? monthFolder(kind);
  const tags = ['generated', ...(options.tags ?? [])];

  const uploadParams = {
    folder,
    resource_type,
    tags,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    context: options.context,
  };
  if (options.publicId) {
    uploadParams.public_id = options.publicId;
    uploadParams.unique_filename = false;
  }

  const provider = options.autoTagProvider ?? process.env.CLOUDINARY_AUTOTAG_PROVIDER;
  if (provider && kind !== 'video') {
    uploadParams.categorization = provider;
    uploadParams.auto_tagging = Number(
      options.autoTagConfidence ?? process.env.CLOUDINARY_AUTOTAG_CONFIDENCE ?? 0.6
    );
  }

  let result;
  try {
    result = await cloudinary.uploader.upload(filePath, uploadParams);
  } catch (e) {
    if (provider && /addon|not.*enabled|categorization|subscription|active/i.test(e.message)) {
      throw new Error(
        `Auto-tagging failed: the "${provider}" add-on isn't enabled on your Cloudinary account. ` +
        `Enable it at https://console.cloudinary.com/console/addons, or unset CLOUDINARY_AUTOTAG_PROVIDER in .env. ` +
        `Original error: ${e.message}`
      );
    }
    throw e;
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    format: result.format,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    duration: result.duration,
    createdAt: result.created_at,
    tags: result.tags,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();
if (isMain) {
  const [, , file, ...tags] = process.argv;
  if (!file) {
    console.error('Usage: node upload.js <file> [tag1] [tag2] ...');
    process.exit(1);
  }
  uploadMedia(file, { tags: tags.length ? tags : undefined })
    .then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(e => { console.error('Upload failed:', e.message); process.exit(1); });
}
