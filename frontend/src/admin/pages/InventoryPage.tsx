import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { variantDetails, adjustInventory } from '../../services/inventory.service';
import { PageHeader, LoadingSkeleton, ErrorState } from '../components/UI';
import { useAuth } from '../../context/AuthContext';
export default function InventoryPage() {
  const { id } = useParams();
  const { admin } = useAuth();
  const client = useQueryClient();
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');
  const query = useQuery({
    queryKey: ['admin', 'variant', id],
    queryFn: () => variantDetails(id!),
  });
  const mutation = useMutation({
    mutationFn: () => adjustInventory(id!, delta, reason),
    onSuccess: () => {
      void client.invalidateQueries();
      setDelta(0);
      setReason('');
    },
  });
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError) return <ErrorState message={query.error.message} />;
  const { variant, movements } = query.data;
  return (
    <>
      <PageHeader title="Inventory" subtitle={`${variant.products?.name} / ${variant.sku}`} />
      <div className="admin-card">
        <h2>
          {variant.color_name} / {variant.size}
        </h2>
        <strong className="admin-stock-count">{variant.stock}</strong>
        <p>Current stock · Alert threshold {variant.low_stock_threshold}</p>
        {admin?.role !== 'editor' && (
          <form
            className="admin-form"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <label>
              Adjustment (+ to receive, − to reduce)
              <input
                type="number"
                step={1}
                required
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value))}
              />
            </label>
            <label>
              Reason
              <input
                required
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Received shipment, correction, damaged stock…"
              />
            </label>
            <button className="admin-button admin-primary" disabled={mutation.isPending || !delta}>
              Apply adjustment
            </button>
          </form>
        )}
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
      </div>
      <div className="admin-card">
        <h2>Movement history</h2>
        {movements?.length ? (
          movements.map((movement: any) => (
            <div className="admin-alert-row" key={movement.id}>
              <span>
                {movement.reason}
                <small>{new Date(movement.created_at).toLocaleString()}</small>
              </span>
              <strong>
                {movement.delta > 0 ? '+' : ''}
                {movement.delta} → {movement.stock_after}
              </strong>
            </div>
          ))
        ) : (
          <p>No stock movements yet.</p>
        )}
      </div>
    </>
  );
}
