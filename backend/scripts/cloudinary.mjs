import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const action = process.argv[2];
if (!['secrets', 'deploy', 'serve'].includes(action))
  throw new Error('Use secrets, deploy or serve.');
const secretNames = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missing = secretNames.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Fill these variables in backend/.env first: ${missing.join(', ')}`);
  process.exit(1);
}
const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
if (action !== 'serve' && !/^[a-z0-9]{20}$/.test(projectRef || '')) {
  console.error('Set SUPABASE_PROJECT_REF in backend/.env first.');
  process.exit(1);
}
const require = createRequire(import.meta.url);
const manifestPath = require.resolve('supabase/package.json');
const manifest = require(manifestPath);
const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.supabase;
const executable = resolve(dirname(manifestPath), bin);
const workspace = fileURLToPath(new URL('../', import.meta.url));
let secretsFile;
try {
  let args;
  if (action === 'deploy')
    args = ['functions', 'deploy', 'cloudinary-media', '--project-ref', projectRef];
  else {
    const folder = resolve(workspace, '.local');
    await mkdir(folder, { recursive: true });
    secretsFile = resolve(folder, `cloudinary-secrets-${randomUUID()}.env`);
    const names = [...secretNames, 'CLOUDINARY_ALLOWED_ORIGINS'];
    const contents = names
      .map(
        (name) =>
          `${name}=${JSON.stringify(process.env[name] || 'http://localhost:5173,http://127.0.0.1:5173')}`,
      )
      .join('\n');
    // Export only Cloudinary configuration, never database credentials or service-role keys.
    await writeFile(secretsFile, contents, { mode: 0o600 });
    args =
      action === 'secrets'
        ? ['secrets', 'set', '--project-ref', projectRef, '--env-file', secretsFile]
        : ['functions', 'serve', 'cloudinary-media', '--env-file', secretsFile];
  }
  const isNodeScript = /\.[cm]?js$/.test(executable);
  const result = spawnSync(
    isNodeScript ? process.execPath : executable,
    isNodeScript ? [executable, ...args] : args,
    { cwd: workspace, env: process.env, stdio: 'inherit', windowsHide: true },
  );
  if (result.error) console.error('Supabase CLI could not start. Check the installed CLI.');
  process.exitCode = result.status ?? 1;
} finally {
  if (secretsFile) await unlink(secretsFile).catch(() => {});
}
