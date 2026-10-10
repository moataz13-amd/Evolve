import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadFrontendEnv() {
  const contents = readFileSync(resolve('frontend/.env'), 'utf8');
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
}

try {
  const env = loadFrontendEnv();
  const baseUrl = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) throw new Error('Supabase URL or anon key is missing.');

  const url = new URL('/rest/v1/categories?select=id&limit=1', baseUrl);
  const response = await fetch(url, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Supabase read failed with HTTP ${response.status}.`);

  console.log(`Supabase database read succeeded at ${new Date().toISOString()}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Supabase read failed.');
  process.exitCode = 1;
}
