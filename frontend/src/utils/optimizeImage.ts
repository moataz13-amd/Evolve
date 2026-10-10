// Native browser decoding keeps uploads small without adding an imaging dependency.
export async function optimizeImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    if (
      ['image/webp', 'image/avif'].includes(file.type) &&
      bitmap.width <= 2000 &&
      bitmap.height <= 2000 &&
      file.size <= 1024 * 1024
    )
      return file;
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to optimize this image.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.86),
    );
    if (!blob || blob.type !== 'image/webp') return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: blob.type });
  } finally {
    bitmap.close();
  }
}
