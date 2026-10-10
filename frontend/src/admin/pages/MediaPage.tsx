import { Select } from '../../components/Select';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { database, mediaUrl } from '../../lib/supabase';
import { uploadImage, removeMedia } from '../../services/media.service';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../components/Modal';
import { PageHeader, LoadingSkeleton, ErrorState, EmptyState } from '../components/UI';
import type { Row } from '../../types/admin';
export default function MediaPage() {
  const client = useQueryClient();
  const { admin } = useAuth();
  const [folder, setFolder] = useState('general');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [notice, setNotice] = useState('');
  const query = useQuery({
    queryKey: ['admin', 'media', search, folder, page],
    queryFn: async () => {
      let request = database()
        .from('media')
        .select('*', { count: 'exact' })
        .eq('folder', folder)
        .order('created_at', { ascending: false })
        .range(page * 20, page * 20 + 19);
      if (search) request = request.ilike('name', '%' + search.replace(/[%_]/g, '') + '%');
      const { data, error, count } = await request;
      if (error) throw error;
      return { rows: data as Row[], count: count || 0 };
    },
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadImage(file, folder),
    onSuccess: () => {
      void client.invalidateQueries();
      setNotice('Image uploaded.');
    },
  });
  const remove = useMutation({
    mutationFn: () => removeMedia(deleting!.id, deleting!.path),
    onSuccess: () => {
      void client.invalidateQueries();
      setDeleting(null);
      setNotice('Unused media deleted.');
    },
  });
  return (
    <>
      <PageHeader title="Media" subtitle="Brand assets, organized for the work." />
      <div className="admin-filter-bar">
        <input
          aria-label="Search media"
          value={search}
          placeholder="Search filenames…"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <Select
          aria-label="Media folder"
          value={folder}
          onChange={(e) => {
            setFolder(e.target.value);
            setPage(0);
          }}
        >
          {['products', 'categories', 'collections', 'homepage', 'general'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        <label className="admin-upload">
          {upload.isPending ? 'Uploading…' : 'Upload image'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={upload.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      {(upload.isError || remove.isError) && (
        <p className="admin-error" role="alert">
          {upload.error?.message || remove.error?.message}
        </p>
      )}
      {query.isPending ? (
        <LoadingSkeleton />
      ) : query.isError ? (
        <ErrorState message={query.error.message} />
      ) : query.data.rows.length ? (
        <div className="admin-media-grid">
          {query.data.rows.map((row) => (
            <div key={row.id} className="admin-card">
              <img
                src={mediaUrl(row.path)}
                alt={row.name}
                width={300}
                height={220}
                loading="lazy"
              />
              <strong>{row.name}</strong>
              <small>{Math.round(row.size / 1024)} KB</small>
              <div className="admin-actions">
                <button
                  className="admin-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(mediaUrl(row.path));
                      setNotice('URL copied.');
                    } catch {
                      setNotice('Clipboard unavailable. Open the image to copy its URL.');
                    }
                  }}
                >
                  Copy URL
                </button>
                {admin?.role !== 'editor' && (
                  <button
                    className="admin-text-action admin-danger"
                    onClick={() => setDeleting(row)}
                  >
                    Delete unused
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No images in this folder." />
      )}
      <div className="admin-pagination">
        <button className="admin-button" disabled={!page} onClick={() => setPage((v) => v - 1)}>
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          className="admin-button"
          disabled={!query.data || (page + 1) * 20 >= query.data.count}
          onClick={() => setPage((v) => v + 1)}
        >
          Next
        </button>
      </div>
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          pending={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate()}
        />
      )}
    </>
  );
}
