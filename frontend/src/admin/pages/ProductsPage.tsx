import { Select } from '../../components/Select';
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { database } from '../../lib/supabase';
import { options, throwIfError } from '../../services/admin.service';
import { duplicateProduct } from '../../services/products.service';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, LoadingSkeleton, EmptyState, ErrorState, Pagination } from '../components/UI';
import { ConfirmDialog } from '../components/Modal';
import { ProductCatalogTable } from '../components/ProductCatalogTable';
type Action = { name: 'archive' | 'delete' | 'activate' | 'deactivate'; ids: string[] };
export default function ProductsPage() {
  const { admin } = useAuth();
  const manager = admin?.role !== 'editor';
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<Action | null>(null);
  const [notice, setNotice] = useState('');
  const categories = useQuery({
    queryKey: ['options', 'categories'],
    queryFn: () => options('categories'),
  });
  const collections = useQuery({
    queryKey: ['options', 'collections'],
    queryFn: () => options('collections'),
  });
  function setFilter(key: string, value: string) {
    setSelected([]);
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setParams(next, { replace: true });
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (params.get('q') || '')) {
        const next = new URLSearchParams(params);
        search ? next.set('q', search) : next.delete('q');
        next.set('page', '1');
        setSelected([]);
        setParams(next, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, params, setParams]);
  const query = useQuery({
    queryKey: ['admin', 'catalog', params.toString()],
    queryFn: async () =>
      throwIfError(
        await database().rpc('admin_catalog', { p_filters: Object.fromEntries(params) }),
      ),
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (!action) return;
      const db = database().from('products');
      const request =
        action.name === 'delete'
          ? db.delete()
          : db.update(
              action.name === 'archive'
                ? { archived: true, active: false }
                : { active: action.name === 'activate' },
            );
      const changed = throwIfError(await request.in('id', action.ids).select('id')) || [];
      if (changed.length !== action.ids.length)
        throw new Error(
          'One or more products could not be changed. Refresh and check your permissions.',
        );
    },
    onSuccess: () => {
      void client.invalidateQueries();
      setSelected([]);
      setAction(null);
      setNotice('Products updated.');
    },
  });
  const duplicate = useMutation({
    mutationFn: duplicateProduct,
    onSuccess: () => {
      void client.invalidateQueries();
      setNotice('Draft duplicate created with zero stock.');
    },
  });
  const rows: any[] = query.data?.rows || [];
  const page = Math.max(1, Number(params.get('page')) || 1);
  function requestAction(name: Action['name'], ids = selected) {
    mutation.reset();
    setAction({ name, ids });
  }
  return (
    <>
      <PageHeader title="Products" subtitle="Manage your EVOLVE catalog.">
        <Link to="/admin/products/new" className="admin-button admin-primary">
          Add product
        </Link>
      </PageHeader>
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      <div className="admin-filter-bar">
        <input
          aria-label="Search products or SKU"
          placeholder="Product name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(['category_id', 'collection_id'] as const).map((key) => (
          <Select
            key={key}
            aria-label={key === 'category_id' ? 'Category' : 'Collection'}
            value={params.get(key) || ''}
            onChange={(e) => setFilter(key, e.target.value)}
          >
            <option value="">All {key === 'category_id' ? 'categories' : 'collections'}</option>
            {(key === 'category_id' ? categories : collections).data?.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
        ))}
        {Object.entries({
          status: ['active', 'draft', 'archived'],
          stock: ['in', 'low', 'out'],
          gender: ['Men', 'Women', 'Unisex'],
          flag: ['featured', 'best_seller', 'new_arrival'],
        }).map(([key, values]) => (
          <Select
            key={key}
            aria-label={key}
            value={params.get(key) || ''}
            onChange={(e) => setFilter(key, e.target.value)}
          >
            <option value="">All {key}</option>
            {values.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        ))}
        <Select
          aria-label="Sort products"
          value={params.get('sort') || 'newest'}
          onChange={(e) => setFilter('sort', e.target.value)}
        >
          {['newest', 'oldest', 'name', 'price_low', 'price_high', 'stock'].map((sort) => (
            <option key={sort} value={sort}>
              {sort.replaceAll('_', ' ')}
            </option>
          ))}
        </Select>
      </div>
      {!!selected.length && (
        <div className="admin-filter-bar">
          <strong>{selected.length} selected</strong>
          <button className="admin-button" onClick={() => requestAction('activate')}>
            Activate
          </button>
          <button className="admin-button" onClick={() => requestAction('deactivate')}>
            Set draft
          </button>
          {manager && (
            <>
              <button className="admin-button" onClick={() => requestAction('archive')}>
                Archive
              </button>
              <button className="admin-button admin-danger" onClick={() => requestAction('delete')}>
                Delete
              </button>
            </>
          )}
        </div>
      )}
      {query.isPending ? (
        <LoadingSkeleton />
      ) : query.isError ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : !rows.length ? (
        <EmptyState title="No products found." copy="Add a product or change the filters." />
      ) : (
        <ProductCatalogTable
          rows={rows}
          selected={selected}
          onSelect={setSelected}
          manager={manager}
          duplicating={duplicate.isPending}
          onDuplicate={(id) => duplicate.mutate(id)}
          onAction={requestAction}
        />
      )}
      {query.data && (
        <Pagination
          page={page}
          count={query.data.count}
          onChange={(page) => setFilter('page', String(page))}
        />
      )}
      {(mutation.isError || duplicate.isError) && (
        <p className="admin-error" role="alert">
          {mutation.error?.message || duplicate.error?.message}
        </p>
      )}
      {action && (
        <ConfirmDialog
          title={`${action.name} ${action.ids.length} product(s)?`}
          copy={
            action.name === 'delete'
              ? 'Products with orders or stock movement history cannot be deleted. Archive them to preserve records.'
              : 'This changes storefront visibility.'
          }
          pending={mutation.isPending}
          onClose={() => setAction(null)}
          onConfirm={() => mutation.mutate()}
        />
      )}
    </>
  );
}
