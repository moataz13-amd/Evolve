const MAX_FILE_SIZE = 10 * 1024 * 1024;
const FOLDERS = ['products', 'categories', 'collections', 'homepage', 'general'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function signCloudinary(parameters, secret) {
  const value = Object.keys(parameters)
    .sort()
    .map((key) => `${key}=${parameters[key]}`)
    .join('&');
  const bytes = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value + secret));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function ownedPublicId(path, cloudName) {
  try {
    const url = new URL(path);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return null;
    const prefix = `/${cloudName}/image/upload/`;
    if (!url.pathname.startsWith(prefix)) return null;
    const id = url.pathname
      .slice(prefix.length)
      .replace(/^v\d+\//, '')
      .replace(/\.[a-z0-9]+$/i, '');
    const parts = id.split('/');
    return parts.length === 3 &&
      parts[0] === 'evolve' &&
      FOLDERS.includes(parts[1]) &&
      UUID.test(parts[2])
      ? id
      : null;
  } catch {
    return null;
  }
}

async function limitedFormData(request) {
  const limit = MAX_FILE_SIZE + 64 * 1024;
  if (Number(request.headers.get('content-length') || 0) > limit)
    throw new HttpError(413, 'Images must be smaller than 10 MB.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Choose an image to upload.');
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, 'Images must be smaller than 10 MB.');
    }
    chunks.push(value);
  }
  try {
    return await new Request(request.url, {
      method: 'POST',
      headers: { 'content-type': request.headers.get('content-type') || '' },
      body: new Blob(chunks),
    }).formData();
  } catch {
    throw new HttpError(400, 'Use a multipart image upload.');
  }
}

export function createMediaHandler(env, fetcher = fetch) {
  return async (request) => {
    const origin = request.headers.get('origin');
    const allowed = (
      env.CLOUDINARY_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'
    )
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    try {
      if (origin && !allowed.includes(origin))
        throw new HttpError(403, 'This storefront origin is not allowed.');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (request.method !== 'POST') throw new HttpError(405, 'Use POST.');
      const authorization = request.headers.get('authorization');
      if (!authorization?.startsWith('Bearer '))
        throw new HttpError(401, 'Sign in before managing images.');
      if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY)
        throw new HttpError(503, 'The media function is not configured.');
      const dbHeaders = { apikey: env.SUPABASE_ANON_KEY, Authorization: authorization };
      async function db(path, init = {}) {
        return fetcher(`${env.SUPABASE_URL.replace(/\/$/, '')}/${path}`, {
          ...init,
          headers: { ...dbHeaders, ...init.headers },
          signal: AbortSignal.timeout(30000),
        });
      }
      const userResponse = await db('auth/v1/user');
      if (!userResponse.ok) throw new HttpError(401, 'Your session has expired. Sign in again.');
      const user = await userResponse.json();
      if (!UUID.test(user.id || '')) throw new HttpError(401, 'Invalid user session.');
      const roleResponse = await db(
        `rest/v1/admin_profiles?select=id,role,active&id=eq.${user.id}`,
      );
      const admins = roleResponse.ok ? await roleResponse.json() : [];
      const admin = admins.find(
        (row) =>
          row.id === user.id && row.active && ['editor', 'admin', 'super_admin'].includes(row.role),
      );
      if (!admin) throw new HttpError(403, 'An active admin account is required.');
      if (
        !/^[a-z0-9_-]+$/i.test(env.CLOUDINARY_CLOUD_NAME || '') ||
        !env.CLOUDINARY_API_KEY ||
        !env.CLOUDINARY_API_SECRET
      )
        throw new HttpError(
          503,
          'Add the Cloudinary credentials to your backend function secrets.',
        );

      async function cloudinary(action, params, file) {
        const signed = { ...params, timestamp: Math.floor(Date.now() / 1000) };
        const body = new FormData();
        for (const [key, value] of Object.entries(signed)) body.set(key, String(value));
        body.set('api_key', env.CLOUDINARY_API_KEY);
        body.set('signature', await signCloudinary(signed, env.CLOUDINARY_API_SECRET));
        if (file) body.set('file', file);
        const response = await fetcher(
          `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/${action}`,
          { method: 'POST', body, signal: AbortSignal.timeout(60000) },
        );
        if (!response.ok)
          throw new HttpError(
            502,
            `Cloudinary ${action} failed. Check the backend credentials and try again.`,
          );
        return response.json();
      }

      if (request.headers.get('content-type')?.startsWith('application/json')) {
        if (admin.role === 'editor') throw new HttpError(403, 'Only admins can delete images.');
        const body = await request.json();
        if (body.action !== 'delete' || !UUID.test(body.id || ''))
          throw new HttpError(400, 'Choose a valid media record.');
        const lookup = await db(`rest/v1/media?select=*&id=eq.${body.id}`);
        if (!lookup.ok) throw new HttpError(502, 'Unable to look up this image.');
        const record = (await lookup.json())[0];
        if (!record) throw new HttpError(404, 'Image not found.');
        const publicId = ownedPublicId(record.path, env.CLOUDINARY_CLOUD_NAME);
        if (!publicId)
          throw new HttpError(400, 'This image is not managed by this Cloudinary account.');
        // RLS and foreign keys must authorize deletion before any remote asset is removed.
        const removed = await db(`rest/v1/media?id=eq.${body.id}`, {
          method: 'DELETE',
          headers: { Prefer: 'return=representation' },
        });
        if (!removed.ok)
          throw new HttpError(
            409,
            'This image may still be in use. Remove its product or content references first.',
          );
        if (!(await removed.json()).length)
          throw new HttpError(403, 'You cannot delete this image.');
        try {
          await cloudinary('destroy', { public_id: publicId, invalidate: true });
        } catch {
          throw new HttpError(
            502,
            'The media record was removed, but Cloudinary cleanup failed. Remove the unused asset from the Cloudinary Media Library.',
          );
        }
        return json({ deleted: true });
      }

      const body = await limitedFormData(request);
      const file = body.get('file');
      const folder = body.get('folder');
      if (!FOLDERS.includes(folder)) throw new HttpError(400, 'Choose a supported media folder.');
      if (!(file instanceof Blob) || !file.size)
        throw new HttpError(400, 'Choose a non-empty image.');
      if (file.size > MAX_FILE_SIZE) throw new HttpError(413, 'Images must be smaller than 10 MB.');
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type))
        throw new HttpError(400, 'Use JPEG, PNG, WebP or AVIF.');
      const publicId = `evolve/${folder}/${crypto.randomUUID()}`;
      const uploaded = await cloudinary('upload', { public_id: publicId, overwrite: false }, file);
      if (
        uploaded.public_id !== publicId ||
        ownedPublicId(uploaded.secure_url, env.CLOUDINARY_CLOUD_NAME) !== publicId
      )
        throw new HttpError(502, 'Cloudinary returned an unexpected image response.');
      const record = {
        path: uploaded.secure_url,
        name: String(file.name || 'Image').slice(0, 250),
        mime_type: file.type,
        size: file.size,
        folder,
      };
      let saved;
      try {
        const inserted = await db('rest/v1/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify(record),
        });
        if (!inserted.ok) throw new Error('Insert failed.');
        saved = (await inserted.json())[0];
        if (!saved?.id) throw new Error('Insert returned no media record.');
      } catch {
        try {
          await cloudinary('destroy', { public_id: publicId, invalidate: true });
        } catch {
          throw new HttpError(
            502,
            'The image could not be saved. An unused upload remains in the Cloudinary Media Library; remove it there before retrying.',
          );
        }
        throw new HttpError(
          502,
          'Unable to save the image record. The unused upload was cleaned up.',
        );
      }
      return json(saved, 201);
    } catch (error) {
      return json(
        {
          error:
            error instanceof HttpError
              ? error.message
              : 'Image management failed. Please try again.',
        },
        error instanceof HttpError ? error.status : 500,
      );
    }
  };
}
