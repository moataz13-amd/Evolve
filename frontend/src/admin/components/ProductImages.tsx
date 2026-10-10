import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createUUID } from '../../utils/uuid';
import { uploadImage } from '../../services/media.service';
import { mediaUrl } from '../../lib/supabase';
import { MediaPicker } from './MediaPicker';
import type { Row } from '../../types/admin';
export function ProductImages({
  images,
  onChange,
  onAppend,
  onBusyChange,
}: {
  images: Row[];
  onChange: (rows: Row[]) => void;
  onAppend: (rows: Row[]) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const client = useQueryClient();
  const uploadingRef = useRef(false);
  const [progress, setProgress] = useState('');
  const [failures, setFailures] = useState<string[]>([]);
  const [library, setLibrary] = useState(false);
  const [libraryUploading, setLibraryUploading] = useState(false);
  async function upload(files: File[]) {
    if (!files.length || uploadingRef.current) return;
    uploadingRef.current = true;
    onBusyChange(true);
    setFailures([]);
    const errors: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setProgress(`Uploading ${index + 1} of ${files.length}…`);
        try {
          const media = await uploadImage(file, 'products');
          onAppend([
            {
              id: createUUID(),
              media_id: media.id,
              path: media.path,
              alt: file.name.replace(/\.[^.]+$/, ''),
              color_name: '',
            },
          ]);
        } catch (error) {
          errors.push(
            `${file.name}: ${error instanceof Error ? error.message : 'Upload failed. Try again.'}`,
          );
        }
      }
      void client.invalidateQueries({ queryKey: ['options', 'media'] });
    } finally {
      setFailures(errors);
      setProgress('');
      uploadingRef.current = false;
      onBusyChange(false);
    }
  }
  function patch(index: number, key: string, value: unknown) {
    onChange(images.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }
  function move(index: number, offset: number) {
    const next = [...images];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  }
  return (
    <section className="admin-form-section">
      <h2>2. Product photos</h2>
      <p>Upload several photos together. The first photo is your cover.</p>
      <label
        className="admin-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(Array.from(e.dataTransfer.files));
        }}
      >
        <strong>{progress || 'Drop photos here or choose files'}</strong>
        <span>JPG, PNG, WebP or AVIF · Up to 10 MB per photo</span>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={!!progress || libraryUploading}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            void upload(files);
          }}
        />
      </label>
      {progress && <p role="status">{progress}</p>}
      {!!failures.length && (
        <div className="admin-error-panel" role="alert">
          {failures.map((error) => (
            <p key={error}>{error}</p>
          ))}
          <p>Successful uploads were kept. Retry only the failed photos.</p>
        </div>
      )}
      <div className="admin-product-images">
        {images.map((image, index) => (
          <div className="admin-image-row" key={image.id}>
            <strong>{index === 0 ? 'Cover photo' : `Photo ${index + 1}`}</strong>
            {image.external_url || image.path || image.media?.path ? (
              <img
                src={image.external_url || mediaUrl(image.path || image.media?.path)}
                alt={image.alt || 'Product photo'}
                width={300}
                height={360}
              />
            ) : (
              <MediaPicker
                value={image.media_id}
                folder="products"
                onChange={(id) => patch(index, 'media_id', id)}
              />
            )}
            <div className="admin-actions">
              {index > 0 && (
                <button
                  type="button"
                  className="admin-button"
                  onClick={() => onChange([image, ...images.filter((_, i) => i !== index)])}
                >
                  Make cover
                </button>
              )}
              <button
                type="button"
                className="admin-text-action admin-danger"
                onClick={() => onChange(images.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
            <details className="admin-advanced">
              <summary>Photo options</summary>
              <div className="admin-advanced-body">
                <label>
                  Image description
                  <input
                    value={image.alt || ''}
                    onChange={(e) => patch(index, 'alt', e.target.value)}
                  />
                </label>
                <label>
                  Associated color (optional)
                  <input
                    value={image.color_name || ''}
                    onChange={(e) => patch(index, 'color_name', e.target.value)}
                  />
                </label>
                <div className="admin-actions">
                  <button
                    type="button"
                    className="admin-button"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    className="admin-button"
                    disabled={index === images.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    Move down
                  </button>
                </div>
              </div>
            </details>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="admin-text-action"
        disabled={!!progress || libraryUploading}
        onClick={() => setLibrary(!library)}
      >
        {library ? 'Close image library' : 'Choose an existing image'}
      </button>
      {library && (
        <MediaPicker
          value={null}
          folder="products"
          disabled={!!progress}
          onBusyChange={(busy) => {
            uploadingRef.current = busy;
            setLibraryUploading(busy);
            onBusyChange(busy);
          }}
          onChange={(id) => {
            if (id) {
              onAppend([{ id: createUUID(), media_id: id, alt: '', color_name: '' }]);
              setLibrary(false);
            }
          }}
        />
      )}
    </section>
  );
}
