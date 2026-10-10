import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customerDetails } from '../../services/customers.service';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, LoadingSkeleton, ErrorState, EmptyState, StatusBadge } from '../components/UI';
export default function CustomerPage() {
  const { id } = useParams();
  const { admin } = useAuth();
  const allowed = admin?.role !== 'editor';
  const query = useQuery({
    queryKey: ['admin', 'customer', id],
    queryFn: () => customerDetails(id!),
    enabled: allowed,
  });
  if (!allowed) return <EmptyState title="Access restricted" />;
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError) return <ErrorState message={query.error.message} />;
  const customer = query.data;
  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={'Customer since ' + new Date(customer.created_at).toLocaleDateString()}
      />
      <div className="admin-overview-grid">
        <div className="admin-card">
          <h2>Contact</h2>
          <p>
            {customer.email}
            <br />
            {customer.phone}
          </p>
          <h2>Addresses</h2>
          {customer.customer_addresses.map((address: any) => (
            <p key={address.id}>
              {address.address}
              <br />
              {address.city}, {address.country}
            </p>
          ))}
        </div>
        <div className="admin-card">
          <h2>Customer history</h2>
          <p>{customer.orders.length} orders</p>
          <strong className="admin-stock-count">
            {customer.orders
              .filter(
                (o: any) =>
                  o.payment_status === 'paid' && !['cancelled', 'refunded'].includes(o.status),
              )
              .reduce((total: number, o: any) => total + Number(o.total), 0)
              .toFixed(2)}
          </strong>
          <p>Total paid (excluding cancelled/refunded)</p>
        </div>
      </div>
      <div className="admin-card">
        <h2>Orders</h2>
        {customer.orders.map((order: any) => (
          <Link className="admin-alert-row" key={order.id} to={'/admin/orders/' + order.id}>
            <span>#{order.order_number}</span>
            <StatusBadge value={order.status} />
            <strong>{order.total}</strong>
          </Link>
        ))}
      </div>
    </>
  );
}
