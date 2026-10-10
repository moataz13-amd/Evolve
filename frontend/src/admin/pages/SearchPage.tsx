import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { database } from '../../lib/supabase';
import { listRecords, throwIfError } from '../../services/admin.service';
import { commerceResources } from '../components/resources';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, LoadingSkeleton, ErrorState, EmptyState } from '../components/UI';
export default function SearchPage() {
  const [params] = useSearchParams();
  const search = params.get('q') || '';
  const { admin } = useAuth();
  const query = useQuery({
    queryKey: ['admin', 'search', search, admin?.role],
    queryFn: async () => {
      const products = throwIfError(
        await database().rpc('admin_catalog', { p_filters: { q: search } }),
      );
      if (admin?.role === 'editor') return { products: products.rows, orders: [], customers: [] };
      const [orders, customers] = await Promise.all([
        listRecords(commerceResources.orders, new URLSearchParams({ q: search })),
        listRecords(commerceResources.customers, new URLSearchParams({ q: search })),
      ]);
      return { products: products.rows, orders: orders.rows, customers: customers.rows };
    },
    enabled: !!search,
  });
  return (
    <>
      <PageHeader
        title="Search"
        subtitle={
          search
            ? `Results for “${search}”`
            : 'Search products, orders or customers from the toolbar.'
        }
      />
      {!search ? (
        <EmptyState title="Enter a search term." />
      ) : query.isPending ? (
        <LoadingSkeleton />
      ) : query.isError ? (
        <ErrorState message={query.error.message} />
      ) : (
        Object.entries(query.data)
          .filter(([key]) => admin?.role !== 'editor' || key === 'products')
          .map(([key, rows]) => (
            <section className="admin-card" key={key}>
              <h2>{key}</h2>
              {(rows as any[]).length ? (
                (rows as any[]).slice(0, 6).map((row) => (
                  <Link className="admin-alert-row" key={row.id} to={`/admin/${key}/${row.id}`}>
                    <strong>
                      {row.order_number ? '#' + row.order_number + ' · ' : ''}
                      {row.name}
                    </strong>
                    <span>{row.email || row.sku || row.slug}</span>
                  </Link>
                ))
              ) : (
                <p>No matching {key}.</p>
              )}
              <Link
                className="admin-text-action"
                to={`/admin/${key}?q=${encodeURIComponent(search)}`}
              >
                See all results
              </Link>
            </section>
          ))
      )}
    </>
  );
}
