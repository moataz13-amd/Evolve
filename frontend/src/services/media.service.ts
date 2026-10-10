import { createUUID } from '../utils/uuid';
import { database } from '../lib/supabase';
import { throwIfError } from './admin.service';
import { optimizeImage } from '../utils/optimizeImage';
import { cloudinaryRequest, isCloudinaryImage, usesCloudinary } from './cloudinary.service';
export async function uploadImage(file: File, folder: string) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type))
    throw new Error('Use JPEG, PNG, WebP or AVIF.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Images must be smaller than 10 MB.');
  if (!file.size) throw new Error('Choose a non-empty image.');
  if (!['products', 'categories', 'collections', 'homepage', 'general'].includes(folder))
    throw new Error('Choose a supported media folder.');
  file = await optimizeImage(file);
  if (usesCloudinary) {
    const body = new FormData();
    body.set('file', file);
    body.set('folder', folder);
    return cloudinaryRequest(body);
  }
  const extension = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
  }[file.type];
  const path = `${folder}/${createUUID()}.${extension}`;
  throwIfError(
    await database()
      .storage.from('evolve-media')
      .upload(path, file, { contentType: file.type, upsert: false }),
  );
  const result = await database()
    .from('media')
    .insert({ path, name: file.name, mime_type: file.type, size: file.size, folder })
    .select()
    .single();
  if (result.error) {
    await database().storage.from('evolve-media').remove([path]);
    throw new Error(result.error.message);
  }
  return result.data;
}
export async function removeMedia(id: string, path: string) {
  if (isCloudinaryImage(path)) return cloudinaryRequest({ action: 'delete', id });
  // Foreign keys reject deletion while any catalog/CMS record still references the asset.
  throwIfError(await database().from('media').delete().eq('id', id).select('id').single());
  if (path.startsWith('https://')) return;
  const { error } = await database().storage.from('evolve-media').remove([path]);
  if (error) throw new Error(`Metadata removed, but storage cleanup failed: ${error.message}`);
}
