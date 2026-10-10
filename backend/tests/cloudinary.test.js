import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createMediaHandler,
  ownedPublicId,
  signCloudinary,
} from '../supabase/functions/_shared/cloudinary-media.mjs';

const id = '10000000-0000-4000-8000-000000000001';
const env = {
  SUPABASE_URL: 'https://store.test',
  SUPABASE_ANON_KEY: 'public-key',
  CLOUDINARY_CLOUD_NAME: 'evolve-test',
  CLOUDINARY_API_KEY: 'api-key',
  CLOUDINARY_API_SECRET: 'server-secret',
};
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
function fixture({
  role = 'admin',
  active = true,
  insertFailure = false,
  deleteFailure = false,
} = {}) {
  const calls = [];
  const run = createMediaHandler(env, async (url, init = {}) => {
    calls.push({ url, ...init });
    if (url.includes('/auth/v1/user')) return response({ id });
    if (url.includes('/admin_profiles')) return response([{ id, active, role }]);
    if (url.endsWith('/image/upload')) {
      const publicId = init.body.get('public_id');
      return response({
        public_id: publicId,
        secure_url: `https://res.cloudinary.com/evolve-test/image/upload/v123/${publicId}.webp`,
      });
    }
    if (url.endsWith('/image/destroy')) return response({ result: 'ok' });
    if (url.endsWith('/media'))
      return response(
        insertFailure ? {} : [{ id, ...JSON.parse(init.body) }],
        insertFailure ? 403 : 201,
      );
    if (url.includes('/media?') && init.method === 'DELETE')
      return response(deleteFailure ? {} : [{ id }], deleteFailure ? 409 : 200);
    if (url.includes('/media?'))
      return response([
        {
          id,
          path: `https://res.cloudinary.com/evolve-test/image/upload/v123/evolve/products/${id}.webp`,
        },
      ]);
    throw new Error(`Unexpected request ${url}`);
  });
  return { run, calls };
}
function upload({
  folder = 'products',
  type = 'image/webp',
  auth = true,
  origin = 'http://localhost:5173',
} = {}) {
  const body = new FormData();
  body.set('folder', folder);
  body.set('file', new Blob(['sample'], { type }), 'training.webp');
  return new Request('https://store.test/functions/v1/cloudinary-media', {
    method: 'POST',
    body,
    headers: { Origin: origin, ...(auth ? { Authorization: 'Bearer user-token' } : {}) },
  });
}
const deletion = () =>
  new Request('https://store.test/functions/v1/cloudinary-media', {
    method: 'POST',
    headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id }),
  });

test('Cloudinary signatures sort every signed parameter and keep the secret server-side', async () => {
  const params = { timestamp: 123, public_id: 'evolve/products/example', overwrite: false };
  assert.equal(
    await signCloudinary(params, env.CLOUDINARY_API_SECRET),
    createHash('sha1')
      .update('overwrite=false&public_id=evolve/products/example&timestamp=123server-secret')
      .digest('hex'),
  );
});
test('uploads reject missing sessions, disabled admins and untrusted origins before contacting Cloudinary', async () => {
  for (const [options, request, status] of [
    [{}, upload({ auth: false }), 401],
    [{ active: false }, upload(), 403],
    [{ role: 'customer' }, upload(), 403],
    [{}, upload({ origin: 'https://untrusted.test' }), 403],
  ]) {
    const { run, calls } = fixture(options);
    assert.equal((await run(request)).status, status);
    assert.equal(calls.filter((call) => call.url.includes('api.cloudinary.com')).length, 0);
  }
});
test('an editor can upload an image and register its URL using the caller JWT and RLS', async () => {
  const { run, calls } = fixture({ role: 'editor' });
  const result = await run(upload());
  assert.equal(result.status, 201);
  const media = await result.json();
  assert.equal(media.folder, 'products');
  assert.match(
    media.path,
    /^https:\/\/res.cloudinary.com\/evolve-test\/image\/upload\/v123\/evolve\/products\//,
  );
  assert.ok(!JSON.stringify(media).includes('server-secret'));
  const dbCall = calls.find((call) => call.url.endsWith('/media'));
  assert.equal(dbCall.headers.Authorization, 'Bearer user-token');
  assert.equal(dbCall.headers.apikey, 'public-key');
});
test('invalid folders and unsupported file formats are rejected before uploading', async () => {
  for (const request of [upload({ folder: '../private' }), upload({ type: 'image/svg+xml' })]) {
    const { run, calls } = fixture();
    assert.equal((await run(request)).status, 400);
    assert.equal(calls.filter((call) => call.url.includes('api.cloudinary.com')).length, 0);
  }
});
test('a failed metadata insert cleans up the newly uploaded image', async () => {
  const { run, calls } = fixture({ insertFailure: true });
  assert.equal((await run(upload())).status, 502);
  const uploaded = calls.find((call) => call.url.endsWith('/image/upload'));
  const removed = calls.find((call) => call.url.endsWith('/image/destroy'));
  assert.equal(removed.body.get('public_id'), uploaded.body.get('public_id'));
});
test('editors and referenced images cannot trigger remote deletion', async () => {
  for (const options of [{ role: 'editor' }, { deleteFailure: true }]) {
    const { run, calls } = fixture(options);
    assert.ok([403, 409].includes((await run(deletion())).status));
    assert.equal(calls.filter((call) => call.url.endsWith('/image/destroy')).length, 0);
  }
});
test('unused image deletion removes only the asset read from its authorized media record', async () => {
  const { run, calls } = fixture();
  assert.equal((await run(deletion())).status, 200);
  assert.equal(
    calls.find((call) => call.url.endsWith('/image/destroy')).body.get('public_id'),
    `evolve/products/${id}`,
  );
});
test('asset ownership excludes external URLs, other clouds and arbitrary public IDs', () => {
  assert.equal(
    ownedPublicId(
      `https://res.cloudinary.com/evolve-test/image/upload/v1/evolve/products/${id}.webp`,
      'evolve-test',
    ),
    `evolve/products/${id}`,
  );
  for (const path of [
    `https://evil.test/evolve-test/image/upload/evolve/products/${id}.webp`,
    `https://res.cloudinary.com/other/image/upload/evolve/products/${id}.webp`,
    'https://res.cloudinary.com/evolve-test/image/upload/another-image.png',
  ])
    assert.equal(ownedPublicId(path, 'evolve-test'), null);
});
