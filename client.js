import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missing = required.filter(k => !process.env[k] || process.env[k].includes('your_cloud_name_here'));
if (missing.length) {
  console.error(`Missing Cloudinary env vars: ${missing.join(', ')}. Edit .env and try again.`);
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };
