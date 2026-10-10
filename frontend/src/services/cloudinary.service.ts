import { database } from '../lib/supabase';

export const usesCloudinary = import.meta.env.VITE_MEDIA_PROVIDER === 'cloudinary';

export async function cloudinaryRequest(body: FormData | { action: 'delete'; id: string }) {
  const db = database();
  const { data: session, error: sessionError } = await db.auth.getSession();
  if (sessionError || !session.session) throw new Error('Sign in before managing images.');
  const { data, error } = await db.functions.invoke(
    import.meta.env.VITE_CLOUDINARY_FUNCTION_NAME || 'cloudinary-media',
    { body, headers: { Authorization: `Bearer ${session.session.access_token}` } },
  );
  if (error) {
    if (error.context instanceof Response) {
      const failure = await error.context.json().catch(() => null);
      if (typeof failure?.error === 'string') throw new Error(failure.error);
      if (error.context.status === 401)
        throw new Error('Supabase rejected your session. Sign in again before uploading images.');
      if (error.context.status === 404)
        throw new Error(
          'The Cloudinary media function has not been deployed to this Supabase project.',
        );
      if (typeof failure?.message === 'string') throw new Error(failure.message);
    }
    throw new Error(
      'The image upload service could not be reached. Check your connection and the allowed storefront origin.',
    );
  }
  return data;
}

export function isCloudinaryImage(path: string) {
  try {
    const url = new URL(path);
    return (
      url.hostname === 'res.cloudinary.com' &&
      /\/image\/upload\/(?:v\d+\/)?evolve\/(?:products|categories|collections|homepage|general)\/[0-9a-f-]{36}\.[a-z0-9]+$/i.test(
        url.pathname,
      )
    );
  } catch {
    return false;
  }
}
