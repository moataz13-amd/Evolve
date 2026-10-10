import { Select } from '../../components/Select';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { database } from '../../lib/supabase';
import { orderDetails, updateOrder } from '../../services/orders.service';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, LoadingSkeleton, ErrorState, StatusBadge, EmptyState } from '../components/UI';
import { ConfirmDialog } from '../components/Modal';
import { governorateName } from '../../data/governorates';
function OrderContent({ order }: { order: any }) {
  const client = useQueryClient();
  const { admin } = useAuth();
  const [status, setStatus] = useState(order.status);
  const [payment, setPayment] = useState(order.payment_status);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const change = useMutation({
    mutationFn: () => updateOrder(order.id, status, payment, note),
    onSuccess: () => {
      void client.invalidateQueries();
      setConfirm(false);
      setNote('');
    },
  });
  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await database()
        .from('order_notes')
        .insert({ order_id: order.id, admin_id: admin!.id, note });
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries();
      setNote('');
    },
  });
  return (
    <>
      <PageHeader
        title={`Order #${order.order_number}`}
        subtitle={new Date(order.created_at).toLocaleString()}
      />
      <div className="admin-overview-grid">
        <div className="admin-card">
          <h2>Customer & delivery</h2>
          <strong>{order.name}</strong>
          <p>
            {order.email}
            <br />
            {order.phone}
            <br />
            {order.address}
            <br />
            {order.city}, {order.country}
            {order.governorate && (
              <>
                <br />
                {governorateName(order.governorate, true)}
              </>
            )}
          </p>
          <StatusBadge value={order.status} />
        </div>
        <div className="admin-card">
          <h2>Order total</h2>
          {['subtotal', 'offer_discount', 'shipping', 'discount', 'total'].map((key) => (
            <div className="admin-alert-row" key={key}>
              <span>{key}</span>
              <strong>
                {Number(order[key]).toLocaleString(undefined, {
                  style: 'currency',
                  currency: order.currency,
                })}
              </strong>
            </div>
          ))}
          <p>
            Payment: <StatusBadge value={order.payment_status} />
          </p>
          <p>
            Fulfillment: <StatusBadge value={order.fulfillment_status} />
          </p>
        </div>
      </div>
      <div className="admin-card">
        <h2>Items</h2>
        {order.order_items.map((item: any) => (
          <div className="admin-alert-row" key={item.id}>
            <span>
              <strong>{item.product_name}</strong>
              <small>
                {item.sku} · {item.size} / {item.color_name}
              </small>
            </span>
            <span>
              × {item.quantity}
              {!!item.free_quantity && <small>{item.free_quantity} free</small>}
            </span>
            <strong>{Number(item.unit_price) * (item.quantity - (item.free_quantity || 0))}</strong>
          </div>
        ))}
      </div>
      <div className="admin-overview-grid">
        <div className="admin-card">
          <h2>Manage status</h2>
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              setConfirm(true);
            }}
          >
            <label>
              Order status
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                {[
                  'pending',
                  'confirmed',
                  'processing',
                  'shipped',
                  'delivered',
                  'cancelled',
                  'refunded',
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </Select>
            </label>
            <label>
              Payment status
              <Select value={payment} onChange={(e) => setPayment(e.target.value)}>
                {['pending', 'paid', 'failed', 'refunded', 'partially_refunded'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </Select>
            </label>
            <p>
              Payment status records an externally verified payment. This dashboard does not charge
              cards or issue refunds.
            </p>
            <label>
              Internal note
              <textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="admin-actions">
              <button className="admin-button admin-primary" disabled={change.isPending}>
                Update status
              </button>
              <button
                type="button"
                className="admin-button"
                disabled={!note.trim() || addNote.isPending}
                onClick={() => addNote.mutate()}
              >
                Save note
              </button>
            </div>
          </form>
          {(change.isError || addNote.isError) && (
            <p role="alert" className="admin-error">
              {change.error?.message || addNote.error?.message}
            </p>
          )}
          {(change.isSuccess || addNote.isSuccess) && (
            <p role="status" className="admin-notice">
              Order updated.
            </p>
          )}
        </div>
        <div className="admin-card">
          <h2>Timeline</h2>
          {[...order.order_status_history]
            .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
            .map((entry: any) => (
              <div key={entry.id} className="admin-timeline-row">
                <StatusBadge value={entry.status} />
                <p>{entry.note}</p>
                <small>{new Date(entry.created_at).toLocaleString()}</small>
              </div>
            ))}
          <h2>Internal notes</h2>
          {order.order_notes.map((entry: any) => (
            <div className="admin-timeline-row" key={entry.id}>
              <p>{entry.note}</p>
              <small>{new Date(entry.created_at).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Set order #${order.order_number} to ${status}?`}
          pending={change.isPending}
          onClose={() => setConfirm(false)}
          onConfirm={() => change.mutate()}
        />
      )}
    </>
  );
}
export default function OrderDetailPage() {
  const { id } = useParams();
  const { admin } = useAuth();
  const allowed = admin?.role !== 'editor';
  const query = useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: () => orderDetails(id!),
    enabled: allowed,
  });
  if (!allowed) return <EmptyState title="Access restricted" />;
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError) return <ErrorState message={query.error.message} />;
  return <OrderContent key={query.data.id} order={query.data} />;
}
