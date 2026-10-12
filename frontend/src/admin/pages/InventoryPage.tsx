import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import {
  adjustInventory,
  inventoryImage,
  inventoryMovements,
  inventoryProduct,
} from '../../services/inventory.service';
import {
  groupInventoryVariants,
  summarizeInventory,
  type InventoryVariant,
} from '../../utils/inventory';
import { useAuth } from '../../context/AuthContext';
import { EmptyState, ErrorState, LoadingSkeleton, PageHeader, StatusBadge } from '../components/UI';
import './inventory.css';

function variantStatus(variant: InventoryVariant) {
  if (!variant.track_quantity) return 'untracked';
  if (variant.stock === 0) return 'out of stock';
  if (variant.stock <= variant.low_stock_threshold) return 'low stock';
  return 'in stock';
}

export default function InventoryPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { admin } = useAuth();
  const client = useQueryClient();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const query = useQuery({
    queryKey: ['admin', 'inventory', 'product', id],
    queryFn: () => inventoryProduct(id!),
    enabled: !!id,
  });
  const product = query.data?.product;
  const selectedId = params.get('variant') || query.data?.selectedVariantId;
  const selected = product?.product_variants.find((variant) => variant.id === selectedId);
  const movements = useQuery({
    queryKey: ['admin', 'inventory', 'movements', selected?.id],
    queryFn: () => inventoryMovements(selected!.id),
    enabled: !!selected,
  });
  const mutation = useMutation({
    mutationFn: () => adjustInventory(selected!.id, Number(delta), reason.trim()),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin'] });
      setDelta('');
      setReason('');
    },
  });

  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError) return <ErrorState message={query.error.message} />;
  if (!product) return <EmptyState title="Product not found" />;

  const summary = summarizeInventory(product.product_variants);
  const groups = groupInventoryVariants(product.product_variants);
  const image = inventoryImage(product);
  const inactive = product.product_variants.length - summary.variants;

  function selectVariant(variantId: string) {
    mutation.reset();
    setDelta('');
    setReason('');
    setParams({ variant: variantId });
  }

  return (
    <>
      <PageHeader title={product.name} subtitle="Stock by color and size">
        <Link className="admin-button" to="/admin/inventory">
          All inventory
        </Link>
        <Link className="admin-button" to={`/admin/products/${product.id}`}>
          Edit product
        </Link>
      </PageHeader>
      <div className="inventory-product-overview">
        <div className="inventory-detail-identity">
          <span className="inventory-detail-image">
            {image ? (
              <img src={image} alt="" width="88" height="104" />
            ) : (
              <Package size={30} aria-hidden="true" />
            )}
          </span>
          <div>
            <span className="admin-eyebrow">PRODUCT INVENTORY</span>
            <h2>{product.name}</h2>
            <StatusBadge
              value={product.archived ? 'archived' : product.active ? 'active' : 'draft'}
            />
          </div>
        </div>
        <div className="inventory-detail-stats">
          <div>
            <small>Available stock</small>
            <strong>{summary.tracked ? summary.stock.toLocaleString('en-US') : '—'}</strong>
          </div>
          <div>
            <small>Active sizes / colors</small>
            <strong>{summary.variants}</strong>
          </div>
          <div>
            <small>Need attention</small>
            <strong>{summary.low + summary.out}</strong>
          </div>
        </div>
      </div>
      {!groups.length ? (
        <EmptyState title="No active sizes yet" copy="Add sizes and colors in the product editor.">
          <Link className="admin-button admin-primary" to={`/admin/products/${product.id}`}>
            Edit product
          </Link>
        </EmptyState>
      ) : (
        <div className="inventory-detail-layout">
          <div className="inventory-color-groups">
            {groups.map((group) => (
              <section className="inventory-color-card" key={group.color}>
                <div className="inventory-color-heading">
                  <span className="inventory-color-name">
                    <span className="inventory-color-swatch" style={{ background: group.hex }} />
                    <strong>{group.color}</strong>
                    <small>{group.variants.length} sizes</small>
                  </span>
                  <span>
                    {group.variants
                      .filter((variant) => variant.track_quantity)
                      .reduce((total, variant) => total + variant.stock, 0)
                      .toLocaleString('en-US')}{' '}
                    units
                  </span>
                </div>
                <div className="inventory-size-list">
                  {group.variants.map((variant) => (
                    <button
                      type="button"
                      className={`inventory-size-row${selected?.id === variant.id ? ' is-selected' : ''}`}
                      key={variant.id}
                      onClick={() => selectVariant(variant.id)}
                      aria-pressed={selected?.id === variant.id}
                    >
                      <span className="inventory-size-pill">{variant.size}</span>
                      <span className="inventory-size-sku">
                        {variant.sku}
                        <small>{variantStatus(variant)}</small>
                      </span>
                      <StatusBadge value={variantStatus(variant)} />
                      <strong className="inventory-size-stock">
                        {variant.track_quantity ? variant.stock.toLocaleString('en-US') : '—'}
                      </strong>
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {inactive > 0 && (
              <p className="inventory-inactive-note">
                {inactive} inactive {inactive === 1 ? 'variant is' : 'variants are'} hidden from the
                stock list. Manage them in the product editor.
              </p>
            )}
          </div>
          <aside className="inventory-variant-panel" aria-label="Selected size stock">
            {!selected ? (
              <div className="inventory-select-prompt">
                <Package size={28} aria-hidden="true" />
                <h2>Select a size</h2>
                <p>Choose a color and size to review stock and its movement history.</p>
              </div>
            ) : (
              <>
                <span className="admin-eyebrow">SELECTED VARIANT</span>
                <h2>
                  {selected.color_name} / {selected.size}
                </h2>
                <p className="inventory-selected-sku">{selected.sku}</p>
                <div className="inventory-selected-stock">
                  <strong>
                    {selected.track_quantity ? selected.stock.toLocaleString('en-US') : '—'}
                  </strong>
                  <span>{selected.track_quantity ? 'units in stock' : 'Stock not tracked'}</span>
                </div>
                <p className="inventory-threshold">
                  Low stock alert at {selected.low_stock_threshold} units.
                </p>
                {admin?.role !== 'editor' && selected.track_quantity && (
                  <form
                    className="admin-form inventory-adjust-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (Number.isInteger(Number(delta)) && Number(delta) !== 0 && reason.trim())
                        mutation.mutate();
                    }}
                  >
                    <h3>Adjust stock</h3>
                    <label>
                      Quantity change
                      <input
                        type="number"
                        step="1"
                        required
                        value={delta}
                        onChange={(event) => setDelta(event.target.value)}
                        placeholder="+10 or -2"
                      />
                    </label>
                    <small>
                      Use a positive number to receive stock or a negative number to reduce it.
                    </small>
                    <label>
                      Reason
                      <input
                        required
                        maxLength={300}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Shipment, correction, damaged stock…"
                      />
                    </label>
                    <button
                      className="admin-button admin-primary"
                      disabled={
                        mutation.isPending ||
                        !Number.isInteger(Number(delta)) ||
                        Number(delta) === 0 ||
                        !reason.trim()
                      }
                    >
                      {mutation.isPending ? 'Saving…' : 'Apply adjustment'}
                    </button>
                    {mutation.isError && (
                      <p role="alert" className="admin-error">
                        {mutation.error.message}
                      </p>
                    )}
                    {mutation.isSuccess && (
                      <p role="status" className="admin-notice">
                        Stock adjustment recorded.
                      </p>
                    )}
                  </form>
                )}
                <div className="inventory-movements">
                  <h3>Movement history</h3>
                  {movements.isPending ? (
                    <LoadingSkeleton />
                  ) : movements.isError ? (
                    <ErrorState message={movements.error.message} />
                  ) : movements.data?.length ? (
                    movements.data.map((movement) => (
                      <div className="inventory-movement" key={movement.id}>
                        <div>
                          <strong>{movement.reason}</strong>
                          <small>{new Date(movement.created_at).toLocaleString()}</small>
                        </div>
                        <span>
                          {movement.delta > 0 ? '+' : ''}
                          {movement.delta} · {movement.stock_after} after
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="inventory-inactive-note">No movements recorded for this size.</p>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
