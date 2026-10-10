import { Select } from '../../components/Select';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { options } from '../../services/admin.service';
import { uploadImage } from '../../services/media.service';
import { mediaUrl } from '../../lib/supabase';
export function MediaPicker({
  value,
  onChange,
  folder = 'general',
  onBusyChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  folder?: string;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const query = useQuery({ queryKey: ['options', 'media'], queryFn: () => options('media') });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const selected = query.data?.find((item) => item.id === value);
  return (
    <div className="admin-media-picker">
      {selected && (
        <img src={mediaUrl(selected.path)} alt={selected.name} width={140} height={100} />
      )}
      <label className="admin-upload">
        {uploading ? 'Uploading…' : 'Upload image'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={disabled || uploading}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setUploading(true);
            onBusyChange?.(true);
            setError('');
            try {
              const media = await uploadImage(file, folder);
              await query.refetch();
              onChange(media.id);
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : 'Upload failed.');
            } finally {
              setUploading(false);
              onBusyChange?.(false);
              event.target.value = '';
            }
          }}
        />
      </label>
      <details className="admin-advanced">
        <summary>Choose from image library</summary>
        <Select
          disabled={disabled || uploading}
          aria-label="Select image from library"
          value={value || ''}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">No image</option>
          {query.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </details>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {query.isError && <p role="alert">Unable to load media library.</p>}
    </div>
  );
}
