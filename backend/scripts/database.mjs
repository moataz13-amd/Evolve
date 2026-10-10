import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const action = process.argv[2];
if (!['link', 'push'].includes(action)) {
  throw new Error('Use database.mjs link or database.mjs push.');
}

const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
if (!projectRef || !/^[a-z0-9]{20}$/.test(projectRef)) {
  console.error('Add your Supabase project reference to backend/.env before connecting.');
  process.exit(1);
}

if (action === 'push') {
  let linkedProject;
  try {
    linkedProject = readFileSync(
      new URL('../supabase/.temp/project-ref', import.meta.url),
      'utf8',
    ).trim();
  } catch {
    console.error('Run npm run db:link before applying migrations.');
    process.exit(1);
  }
  if (linkedProject !== projectRef) {
    console.error('The linked project differs from backend/.env. Run npm run db:link again.');
    process.exit(1);
  }
}

// Run the installed CLI directly, without shell interpolation or printing credentials.
const require = createRequire(import.meta.url);
const manifestPath = require.resolve('supabase/package.json');
const manifest = require(manifestPath);
const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.supabase;
const executable = resolve(dirname(manifestPath), bin);
const args = action === 'link' ? ['link', '--project-ref', projectRef] : ['db', 'push'];
const isNodeScript = /\.[cm]?js$/.test(executable);
const result = spawnSync(
  isNodeScript ? process.execPath : executable,
  isNodeScript ? [executable, ...args] : args,
  {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  },
);
if (result.error) {
  console.error(`Supabase CLI could not start: ${result.error.message}`);
}
process.exit(result.status ?? 1);
