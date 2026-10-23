import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { database } from '../../lib/supabase';
import { saveRecord, deleteRecord } from '../../services/admin.service';
import { throwIfError } from '../../services/result';
import { resources } from '../components/resources';
import { RecordForm } from '../components/RecordForm';
import { Modal, ConfirmDialog } from '../components/Modal';
import { PageHeader, LoadingSkeleton, ErrorState } from '../components/UI';
import { useAuth } from '../../context/AuthContext';
import type { Row } from '../../types/admin';
function ManualProducts({ sectionId, initial }: { sectionId: string; initial: any[] }) {
  const client = useQueryClient();
  const [chosen, setChosen] = useState<string[]>(
    [...initial].sort((a, b) => a.display_order - b.display_order).map((p) => p.product_id),
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin', 'cms-product-options', search, page],
    queryFn: async () =>
      throwIfError(await database().rpc('admin_catalog', { p_filters: { q: search, page } })),
  });
  const save = useMutation({
    mutationFn: async () =>
      throwIfError(
        await database().rpc('set_homepage_products', { p_section: sectionId, p_products: chosen }),
      ),
    onSuccess: () => void client.invalidateQueries(),
  });
  return (
    <section className="admin-card">
      <h2>Manual products</h2>
      <p>
        Select up to 24 products. The selection overrides the automatic collection in the section
        content. Clear it to use that collection.
      </p>
      <label>
        Find a product
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </label>
      <div className="admin-checkbox-grid">
        {query.data?.rows.map((row: Row) => (
          <label className="admin-check-label" key={row.id}>
            <input
              type="checkbox"
              checked={chosen.includes(row.id)}
              disabled={!chosen.includes(row.id) && chosen.length >= 24}
              onChange={(e) =>
                setChosen(
                  e.target.checked ? [...chosen, row.id] : chosen.filter((id) => id !== row.id),
                )
              }
            />
            {row.name}
            {!row.active ? ' · draft' : ''}
          </label>
        ))}
      </div>
      {query.isError && <p role="alert">{query.error.message}</p>}
      <div className="admin-actions">
        <button className="admin-button" disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>Page {page}</span>
        <button
          className="admin-button"
          disabled={page * 20 >= (query.data?.count || 0)}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
      <p>{chosen.length} selected</p>
      <div className="admin-actions">
        <button className="admin-button" onClick={() => setChosen([])}>
          Clear selection
        </button>
        <button
          className="admin-button admin-primary"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          Save selection
        </button>
      </div>
      {save.isError && (
        <p role="alert" className="admin-error">
          {save.error.message}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="admin-notice">
          Product selection saved.
        </p>
      )}
    </section>
  );
}
export default function SectionEditorPage() {
  const { id } = useParams();
  const { admin } = useAuth();
  const client = useQueryClient();
  const [editing, setEditing] = useState<Row | undefined>();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const query = useQuery({
    queryKey: ['admin', 'section', id],
    queryFn: async () =>
      throwIfError(
        await database()
          .from('homepage_sections')
          .select('*,homepage_content(*),homepage_products(*,products(name))')
          .eq('id', id!)
          .single(),
      ),
  });
  const save = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      saveRecord('homepage_content', { ...values, section_id: id }, editing?.id),
    onSuccess: () => {
      void client.invalidateQueries();
      setOpen(false);
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteRecord('homepage_content', deleting!.id),
    onSuccess: () => {
      void client.invalidateQueries();
      setDeleting(null);
    },
  });
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError) return <ErrorState message={query.error.message} />;
  const section = query.data;
  if (section.key === 'hero') return <Navigate to="/admin/content/hero" replace />;
  const contentResource = {
    ...resources['content/story'],
    fields: resources['content/story'].fields.filter(
      (field) =>
        field.key !== 'section_id' && (section.key !== 'categories' || field.key !== 'image_id'),
    ),
  };
  return (
    <>
      <PageHeader title={section.title} subtitle={`Homepage / ${section.key}`}>
        <Link to="/" target="_blank" className="admin-button">
          Preview storefront
        </Link>
        <button
          className="admin-button admin-primary"
          onClick={() => {
            setEditing(undefined);
            save.reset();
            setOpen(true);
          }}
        >
          Add content
        </button>
      </PageHeader>
      <p className="admin-notice">
        {section.key === 'categories'
          ? 'All active categories appear automatically, ordered by their category display order. Change each image in Categories. Content rows can customize labels, and the first row supplies the section heading.'
          : 'Lower display order appears first. For brand values, each content row is a card. The first row supplies the section heading, image and automatic collection.'}
      </p>
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Heading</th>
              <th>Order</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...section.homepage_content]
              .sort((a: any, b: any) => a.display_order - b.display_order)
              .map((row: Row) => (
                <tr key={row.id}>
                  <td>{row.heading}</td>
                  <td>{row.display_order}</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className="admin-text-action"
                        onClick={() => {
                          setEditing(row);
                          save.reset();
                          setOpen(true);
                        }}
                      >
                        Edit content
                      </button>
                      {admin?.role !== 'editor' && (
                        <button
                          className="admin-text-action admin-danger"
                          onClick={() => setDeleting(row)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {section.key === 'products' && (
        <ManualProducts
          key={section.id}
          sectionId={section.id}
          initial={section.homepage_products}
        />
      )}
      {open && (
        <Modal title={editing ? 'Edit content' : 'Add content'} onClose={() => setOpen(false)}>
          {save.isError && (
            <p role="alert" className="admin-error">
              {save.error.message}
            </p>
          )}
          <RecordForm
            resource={contentResource}
            record={editing}
            pending={save.isPending}
            onSave={(values) => save.mutate(values)}
          />
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this content row?"
          pending={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate()}
        />
      )}
      {remove.isError && (
        <p role="alert" className="admin-error">
          {remove.error.message}
        </p>
      )}
    </>
  );
}
