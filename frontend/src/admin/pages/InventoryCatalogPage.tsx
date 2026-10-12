import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { Select } from '../../components/Select';
import { mediaUrl } from '../../lib/supabase';
import { listInventoryProducts } from '../../services/inventory.service';
import type { InventorySummary } from '../../utils/inventory';
import { EmptyState, ErrorState, LoadingSkeleton, PageHeader, Pagination } from '../components/UI';
import './inventory.css';

function stockLabel(summary: InventorySummary) {
  if (!summary.variants) return 'No variants';
  if (!summary.tracked) return 'Not tracked';
  if (summary.out === summary.tracked && !summary.untracked) return 'Out of stock';
  if (summary.low || summary.out) return 'Needs attention';
  return 'In stock';
}

export default function InventoryCatalogPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const query = useQuery({
    queryKey: ['admin', 'inventory', params.toString()],
    queryFn: () => listInventoryProducts(params),
  });

  useEffect(() => {
    setSearch(params.get('q') || '');
  }, [params]);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (search === (params.get('q') || '')) return;
      const next = new URLSearchParams(params);
      search.trim() ? next.set('q', search.trim()) : next.delete('q');
      next.set('page', '1');
      setParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search, params, setParams]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setParams(next);
  }

  const page = Math.max(1, Number(params.get('page')) || 1);
  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Products first. Open one to see stock by color and size."
      />
      <div className="admin-filter-bar inventory-filters">
        <input
          aria-label="Search inventory products or SKU"
          placeholder="Search product or SKU…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          aria-label="Stock status"
          value={params.get('stock') || ''}
          onChange={(event) => setFilter('stock', event.target.value)}
        >
          <option value="">All stock</option>
          <option value="in">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </Select>
        <Select
          aria-label="Product status"
          value={params.get('status') || ''}
          onChange={(event) => setFilter('status', event.target.value)}
        >
          <option value="">All products</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </Select>
        <Select
          aria-label="Sort inventory"
          value={params.get('sort') || 'newest'}
          onChange={(event) => setFilter('sort', event.target.value)}
        >
          <option value="newest">Newest</option>
          <option value="name">Name</option>
          <option value="stock">Lowest stock</option>
        </Select>
      </div>
      {query.isPending ? (
        <LoadingSkeleton />
      ) : query.isError ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : !query.data.rows.length ? (
        <EmptyState title="No products found" copy="Try a different search or stock filter." />
      ) : (
        <div className="inventory-catalog">
          <div className="inventory-catalog-head">
            <strong>{query.data.count} products</strong>
            <span>Stock counts include active, tracked sizes only.</span>
          </div>
          <div className="inventory-product-list">
            {query.data.rows.map((product) => {
              const summary = product.summary;
              const image = mediaUrl(product.image);
              return (
                <Link
                  className="inventory-product-row"
                  key={product.id}
                  to={`/admin/inventory/${product.id}`}
                >
                  <span className="inventory-product-image">
                    {image ? (
                      <img src={image} alt="" width="64" height="76" loading="lazy" />
                    ) : (
                      <Package size={24} aria-hidden="true" />
                    )}
                  </span>
                  <span className="inventory-product-name">
                    <strong>{product.name}</strong>
                    <small>
                      {product.category || 'Uncategorized'} ·{' '}
                      {product.archived ? 'Archived' : product.active ? 'Active' : 'Draft'}
                    </small>
                    <small className="inventory-mobile-stock">
                      {summary.tracked
                        ? `${summary.stock.toLocaleString('en-US')} units`
                        : 'Not tracked'}
                      {' · '}
                      {summary.variants} sizes / colors
                    </small>
                  </span>
                  <span className="inventory-product-metric">
                    <small>Sizes / colors</small>
                    <strong>{summary.variants}</strong>
                  </span>
                  <span className="inventory-product-metric">
                    <small>Total stock</small>
                    <strong>{summary.tracked ? summary.stock.toLocaleString('en-US') : '—'}</strong>
                  </span>
                  <span
                    className={`inventory-stock-state${summary.low || summary.out ? ' is-alert' : ''}`}
                  >
                    {stockLabel(summary)}
                    {!!(summary.low || summary.out) && (
                      <small>
                        {summary.out ? `${summary.out} out` : ''}
                        {summary.out && summary.low ? ' · ' : ''}
                        {summary.low ? `${summary.low} low` : ''}
                      </small>
                    )}
                  </span>
                  <span className="inventory-open">View sizes</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {query.data && (
        <Pagination
          page={page}
          count={query.data.count}
          onChange={(nextPage) => setFilter('page', String(nextPage))}
        />
      )}
    </>
  );
}
