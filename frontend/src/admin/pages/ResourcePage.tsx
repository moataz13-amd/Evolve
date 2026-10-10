import { Select } from '../../components/Select';
import { quantityOfferLabel } from '../../utils/offers';
import { offerCalculations } from '../components/OfferTypeSelect';
import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteRecord, listRecords, saveRecord } from '../../services/admin.service';
import { resources, commerceResources, resourceNames } from '../components/resources';
import { useAuth } from '../../context/AuthContext';
import {
  PageHeader,
  LoadingSkeleton,
  EmptyState,
  ErrorState,
  StatusBadge,
  Pagination,
} from '../components/UI';
import { Modal, ConfirmDialog } from '../components/Modal';
import { RecordForm } from '../components/RecordForm';
import type { Row } from '../../types/admin';
import { exportSubscribers } from '../../services/newsletter.service';
export default function ResourcePage({ resourceKey }: { resourceKey: string }) {
  const navigate = useNavigate();
  const resource = resources[resourceKey] || commerceResources[resourceKey];
  const { admin } = useAuth();
  const manager = admin?.role !== 'editor';
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [editing, setEditing] = useState<Row | undefined>();
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [notice, setNotice] = useState('');
  const client = useQueryClient();
  useEffect(() => {
    setSearch(params.get('q') || '');
  }, [params]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (search !== (params.get('q') || '')) {
        const next = new URLSearchParams(params);
        search ? next.set('q', search) : next.delete('q');
        next.set('page', '1');
        setParams(next, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, params, setParams]);
  const query = useQuery({
    queryKey: ['admin', resource.table, params.toString()],
    queryFn: () => listRecords(resource, params),
  });
  function refresh() {
    void client.invalidateQueries();
  }
  const save = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      saveRecord(resource.table, values, editing?.id),
    onSuccess: (row) => {
      refresh();
      setEditorOpen(false);
      setNotice('Changes saved.');
      if (resourceKey === 'offers' && !editing) navigate('/admin/offers/' + row.id);
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteRecord(resource.table, deleting!.id),
    onSuccess: () => {
      refresh();
      setDeleting(null);
      setNotice('Record deleted.');
    },
  });
  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setParams(next);
  }
  const csv = useMutation({ mutationFn: exportSubscribers, onSuccess: downloadCsv });
  if ((resource.managerOnly && !manager) || (resource.superOnly && admin?.role !== 'super_admin'))
    return <EmptyState title="Access restricted" copy="Your role cannot manage this area." />;
  function downloadCsv(rows: Record<string, unknown>[]) {
    const escape = (value: unknown) =>
      '"' +
      String(value ?? '')
        .replace(/^(?=\s*[=+@-])/, "'")
        .replaceAll('"', '""') +
      '"';
    const text = [
      resource.columns.join(','),
      ...rows.map((row) => resource.columns.map((key) => escape(row[key])).join(',')),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = resource.table + '.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeader title={resource.title} subtitle={resource.subtitle}>
        {resourceKey === 'offers' && (
          <Link className="admin-button" to="/admin/offer-types">
            Manage offer types
          </Link>
        )}
        {resourceKey === 'offer-types' && (
          <Link className="admin-button" to="/admin/offers">
            All offers
          </Link>
        )}
        {resourceKey === 'offers' ? (
          <Link className="admin-button admin-primary" to="/admin/offers/new">
            Add offer
          </Link>
        ) : resourceKey === 'products' ? (
          <Link className="admin-button admin-primary" to="/admin/products/new">
            Add product
          </Link>
        ) : (
          !resource.readOnly &&
          resourceKey !== 'settings' && (
            <button
              className="admin-button admin-primary"
              onClick={() => {
                setEditing(undefined);
                save.reset();
                setEditorOpen(true);
              }}
            >
              Add {resourceNames[resourceKey] || 'record'}
            </button>
          )
        )}
        {resourceKey === 'newsletter' && (
          <button className="admin-button" disabled={csv.isPending} onClick={() => csv.mutate()}>
            {csv.isPending ? 'Exporting…' : 'Export subscribers CSV'}
          </button>
        )}
      </PageHeader>
      {csv.isError && (
        <p role="alert" className="admin-error">
          {csv.error.message}
        </p>
      )}
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      <div className="admin-filter-bar">
        <input
          aria-label={`Search ${resource.title}`}
          placeholder={`Search ${resource.title.toLowerCase()}…`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {resource.fields
          .filter((field) => field.type === 'select' && !field.relation)
          .map((field) => (
            <Select
              key={field.key}
              aria-label={field.label}
              value={params.get(field.key) || ''}
              onChange={(event) => updateParam(field.key, event.target.value)}
            >
              <option value="">All {field.label.toLowerCase()}</option>
              {field.options?.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          ))}
        <Select
          aria-label="Sort records"
          value={params.get('sort') || resource.order || 'created_at'}
          onChange={(event) => updateParam('sort', event.target.value)}
        >
          <option value="created_at">Newest</option>
          {resource.columns
            .filter((key) => key !== 'created_at')
            .map((key) => (
              <option key={key} value={key}>
                {key.replaceAll('_', ' ')}
              </option>
            ))}
        </Select>
      </div>
      {query.isPending ? (
        <LoadingSkeleton />
      ) : query.isError ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : !query.data.rows.length ? (
        <EmptyState
          title={`No ${resource.title.toLowerCase()} found.`}
          copy="Add a record or change your filters."
        />
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                {resource.columns.map((key) => (
                  <th key={key}>{key.replaceAll('_', ' ')}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.data.rows.map((row) => (
                <tr key={row.id}>
                  {resource.columns.map((key) => (
                    <td key={key}>
                      {['active', 'featured', 'published', 'status', 'payment_status'].includes(
                        key,
                      ) ||
                      key === 'stock_status' ||
                      key === 'fulfillment_status' ? (
                        <StatusBadge value={row[key]} />
                      ) : resourceKey === 'offers' && key === 'name' ? (
                        <Link to={'/admin/offers/' + row.id}>{row.name}</Link>
                      ) : resourceKey === 'offers' && key === 'discount_type' ? (
                        row.offer_types?.name ||
                        (row.discount_type === 'buy_get'
                          ? quantityOfferLabel(row)
                          : row.discount_type === 'percentage'
                            ? 'Percentage'
                            : 'Fixed amount')
                      ) : resourceKey === 'offer-types' && key === 'calculation' ? (
                        offerCalculations[row.calculation as keyof typeof offerCalculations]
                      ) : resourceKey === 'offers' &&
                        key === 'discount_value' &&
                        row.discount_type === 'buy_get' ? (
                        `${row.buy_quantity} + ${row.get_quantity} free`
                      ) : key.endsWith('_at') ? (
                        row[key] ? (
                          new Date(row[key]).toLocaleDateString()
                        ) : (
                          '—'
                        )
                      ) : (
                        String(row[key] ?? '—')
                      )}
                    </td>
                  ))}
                  <td>
                    <div className="admin-actions">
                      {resourceKey === 'content/homepage' && (
                        <Link
                          className="admin-text-action"
                          to={'/admin/content/homepage/' + row.id}
                        >
                          Edit content
                        </Link>
                      )}
                      {resourceKey === 'offers' && (
                        <Link className="admin-text-action" to={'/admin/offers/' + row.id}>
                          Choose products
                        </Link>
                      )}
                      {['products', 'orders', 'customers'].includes(resourceKey) ? (
                        <Link className="admin-text-action" to={`/admin/${resourceKey}/${row.id}`}>
                          View / edit
                        </Link>
                      ) : resourceKey === 'inventory' ? (
                        <Link className="admin-text-action" to={`/admin/inventory/${row.id}`}>
                          Adjust stock
                        </Link>
                      ) : (
                        <>
                          <button
                            className="admin-text-action"
                            onClick={() => {
                              setEditing(row);
                              save.reset();
                              setEditorOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          {manager && resourceKey !== 'settings' && (
                            <button
                              className="admin-text-action admin-danger"
                              onClick={() => {
                                remove.reset();
                                setDeleting(row);
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {query.data && (
        <Pagination
          page={query.data.page}
          count={query.data.count}
          onChange={(page) => updateParam('page', String(page))}
        />
      )}
      {isEditorOpen && (
        <Modal
          title={`${editing ? 'Edit' : 'Add'} ${resourceNames[resourceKey] || 'record'}`}
          onClose={() => setEditorOpen(false)}
        >
          {save.isError && (
            <p className="admin-error" role="alert">
              {save.error.message}
            </p>
          )}
          <RecordForm
            resource={resource}
            record={editing}
            pending={save.isPending}
            onSave={(values) => save.mutate(values)}
          />
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name || deleting.title || deleting.code || 'this record'}?`}
          pending={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate()}
        />
      )}
      {remove.isError && (
        <p className="admin-error" role="alert">
          {remove.error.message}
        </p>
      )}
    </>
  );
}
