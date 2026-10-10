import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Package, Star } from 'lucide-react';
import { mediaUrl } from '../../lib/supabase';
import { formatMoney } from '../../utils/format';
import type { Row } from '../../types/admin';
import { Modal } from './Modal';
import { StatusBadge } from './UI';
import '../catalog-table.css';

type Props = {
  rows: Row[];
  selected: string[];
  onSelect: (ids: string[]) => void;
  manager: boolean;
  duplicating: boolean;
  onDuplicate: (id: string) => void;
  onAction: (action: 'archive' | 'delete', ids: string[]) => void;
};
const updatedDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Africa/Cairo',
});

export function ProductCatalogTable({
  rows,
  selected,
  onSelect,
  manager,
  duplicating,
  onDuplicate,
  onAction,
}: Props) {
  const [managing, setManaging] = useState<Row | null>(null);
  const allSelected = rows.every((row) => selected.includes(row.id));
  const someSelected = rows.some((row) => selected.includes(row.id));
  const selectAll = (
    <input
      type="checkbox"
      aria-label="Select all products on this page"
      checked={allSelected}
      ref={(node) => {
        if (node) node.indeterminate = someSelected && !allSelected;
      }}
      onChange={(event) => onSelect(event.target.checked ? rows.map((row) => row.id) : [])}
    />
  );
  return (
    <>
      <div className="admin-catalog">
        <div className="catalog-toolbar">
          <span>
            <strong>{rows.length}</strong> products on this page
          </span>
          <label className="catalog-mobile-selection">{selectAll} Select all</label>
          {someSelected && (
            <span>{rows.filter((row) => selected.includes(row.id)).length} selected</span>
          )}
        </div>
        <table className="admin-table catalog-table">
          <caption className="catalog-sr-only">
            Products, prices, inventory and publishing status
          </caption>
          <colgroup>
            <col className="catalog-select-column" />
            <col />
            <col className="catalog-category-column" />
            <col className="catalog-price-column" />
            <col className="catalog-stock-column" />
            <col className="catalog-status-column" />
            <col className="catalog-featured-column" />
            <col className="catalog-actions-column" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{selectAll}</th>
              {['Product', 'Category', 'Price', 'Stock', 'Status', 'Featured', 'Actions'].map(
                (label) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={selected.includes(row.id) ? 'catalog-row-selected' : ''}>
                <td className="catalog-product-check">
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.name}`}
                    checked={selected.includes(row.id)}
                    onChange={(event) =>
                      onSelect(
                        event.target.checked
                          ? [...selected, row.id]
                          : selected.filter((id) => id !== row.id),
                      )
                    }
                  />
                </td>
                <td className="catalog-product-identity">
                  <Link className="admin-product-cell" to={`/admin/products/${row.id}`}>
                    {row.image ? (
                      <img src={mediaUrl(row.image)} width={48} height={60} alt="" loading="lazy" />
                    ) : (
                      <span className="catalog-image-placeholder">
                        <Package size={20} />
                      </span>
                    )}
                    <span className="catalog-product-copy">
                      <strong>{row.name}</strong>
                      <span className="catalog-sku" title={row.sku || undefined}>
                        SKU: {row.sku || '—'}
                      </span>
                      <small>Updated {updatedDate.format(new Date(row.updated_at))}</small>
                    </span>
                  </Link>
                </td>
                <td className="catalog-field" data-label="Category">
                  <span>{row.category || '—'}</span>
                </td>
                <td className="catalog-field catalog-price" data-label="Price">
                  <strong>{formatMoney(Number(row.price))}</strong>
                </td>
                <td className="catalog-field" data-label="Stock">
                  <span
                    className={`catalog-stock ${Number(row.stock) === 0 ? 'catalog-stock-empty' : ''}`}
                  >
                    {Number(row.stock).toLocaleString('en-US')}
                  </span>
                </td>
                <td className="catalog-field" data-label="Status">
                  <StatusBadge
                    value={row.archived ? 'archived' : row.active ? 'active' : 'draft'}
                  />
                </td>
                <td className="catalog-field" data-label="Featured">
                  {row.featured ? (
                    <span className="catalog-featured">
                      <Star size={12} aria-hidden="true" /> Featured
                    </span>
                  ) : (
                    <span className="admin-muted">—</span>
                  )}
                </td>
                <td className="catalog-product-actions">
                  <div className="catalog-row-actions">
                    <Link
                      className="catalog-edit"
                      to={`/admin/products/${row.id}`}
                      aria-label={`Edit ${row.name}`}
                    >
                      Edit
                    </Link>
                    <button
                      className="catalog-more"
                      aria-label={`More actions for ${row.name}`}
                      aria-haspopup="dialog"
                      onClick={() => setManaging(row)}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {managing && (
        <Modal title={`Manage ${managing.name}`} onClose={() => setManaging(null)}>
          <div className="catalog-manage-actions">
            <Link className="admin-button" to={`/admin/products/${managing.id}`}>
              Edit product
            </Link>
            <button
              className="admin-button"
              disabled={duplicating}
              onClick={() => {
                onDuplicate(managing.id);
                setManaging(null);
              }}
            >
              Duplicate as draft
            </button>
            {manager && (
              <>
                <button
                  className="admin-button"
                  onClick={() => {
                    onAction('archive', [managing.id]);
                    setManaging(null);
                  }}
                >
                  Archive product
                </button>
                <button
                  className="admin-button admin-danger"
                  onClick={() => {
                    onAction('delete', [managing.id]);
                    setManaging(null);
                  }}
                >
                  Delete product
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
