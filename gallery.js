import { cloudinary } from './client.js';
import express from 'express';
import multer from 'multer';
import { uploadMedia } from './upload.js';
import { mkdirSync } from 'node:fs';

mkdirSync('./tmp', { recursive: true });
const upload = multer({ dest: './tmp/' });
const app = express();
app.use(express.static('public'));

app.get('/api/media', async (req, res) => {
  try {
    const type = req.query.type === 'video' ? 'video' : 'image';
    const tag = req.query.tag;
    let resources;
    if (tag) {
      const r = await cloudinary.api.resources_by_tag(tag, {
        resource_type: type, max_results: 200, direction: 'desc',
      });
      resources = r.resources;
    } else {
      const r = await cloudinary.api.resources({
        type: 'upload', resource_type: type, prefix: 'generated/',
        max_results: 200, direction: 'desc',
      });
      resources = r.resources;
    }
    res.json(resources.map(r => ({
      url: r.secure_url,
      publicId: r.public_id,
      type: r.resource_type,
      format: r.format,
      bytes: r.bytes,
      width: r.width,
      height: r.height,
      duration: r.duration,
      createdAt: r.created_at,
      tags: r.tags ?? [],
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const tags = req.body.tags ? req.body.tags.split(',').map(s => s.trim()).filter(Boolean) : [];
    const result = await uploadMedia(req.file.path, { tags });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Gallery running: http://localhost:${port}`);
});
