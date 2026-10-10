import { createMediaHandler } from '../_shared/cloudinary-media.mjs';

// Supabase provides its URL and anon key automatically. User JWTs preserve RLS.
const names = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_ALLOWED_ORIGINS',
];
const env = Object.fromEntries(names.map((name) => [name, Deno.env.get(name) || '']));
Deno.serve(createMediaHandler(env));
