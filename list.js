import { cloudinary } from './client.js';
import { fileURLToPath } from 'node:url';

export async function listMedia({ type = 'image', prefix = 'generated/', max = 100, tag } = {}) {
  if (tag) {
    const result = await cloudinary.api.resources_by_tag(tag, {
      resource_type: type,
      max_results: max,
      direction: 'desc',
    });
    return result.resources;
  }
  const result = await cloudinary.api.resources({
    type: 'upload',
    resource_type: type,
    prefix,
    max_results: max,
    direction: 'desc',
  });
  return result.resources;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();
if (isMain) {
  const args = process.argv.slice(2);
  const opts = { type: 'image' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--video') opts.type = 'video';
    else if (args[i] === '--tag') opts.tag = args[++i];
    else if (args[i] === '--prefix') opts.prefix = args[++i];
    else if (args[i] === '--max') opts.max = Number(args[++i]);
  }
  listMedia(opts)
    .then(rs => {
      if (!rs.length) { console.log('(no media found)'); return; }
      for (const r of rs) {
        console.log(`${r.created_at}  ${r.resource_type}/${r.format}  ${r.public_id}`);
        console.log(`  ${r.secure_url}`);
      }
    })
    .catch(e => { console.error('List failed:', e.message); process.exit(1); });
}
