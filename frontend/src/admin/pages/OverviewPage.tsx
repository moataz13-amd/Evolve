import { Select } from '../../components/Select';
import '../overview.css';
import { useQuery } from '@tanstack/react-query';
import { database } from '../../lib/supabase';
import { PageHeader } from '../components/UI';
import { LoadingSkeleton, ErrorState, EmptyState, StatusBadge } from '../components/UI';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
export default function OverviewPage() {
  const [days, setDays] = useState(30);
  const { admin } = useAuth();
  const query = useQuery({
    queryKey: ['admin', 'overview', days],
    queryFn: async () => {
      const { data, error } = await database().rpc('admin_overview', { p_days: days });
      if (error) throw error;
      return data;
    },
  });
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError)
    return <ErrorState message={query.error.message} retry={() => void query.refetch()} />;
  const data = query.data;
  return (
    <div className="admin-overview">
      <PageHeader title="Overview" subtitle="A clear view of your EVOLVE store." />
      <div className="admin-stat-grid">
        {Object.entries(data.stats)
          .filter(
            ([label]) =>
              admin?.role !== 'editor' || !['revenue', 'orders', 'customers'].includes(label),
          )
          .map(([label, value]) => (
            <div className="admin-stat" key={label}>
              <span>{label.replaceAll('_', ' ')}</span>
              <strong>
                {label === 'revenue'
                  ? Number(value).toLocaleString(undefined, {
                      style: 'currency',
                      currency: data.currency,
                    })
                  : String(value)}
              </strong>
              <small>
                {label === 'revenue' ? 'Paid, non-cancelled orders' : 'Live database totals'}
              </small>
            </div>
          ))}
      </div>
      {admin?.role !== 'editor' && (
        <div className="admin-card">
          <div className="admin-card-heading">
            <h2>Revenue</h2>
            <Select
              aria-label="Revenue date range"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            >
              {[7, 30, 90, 365].map((value) => (
                <option key={value} value={value}>
                  {value === 365 ? 'This year' : value + ' days'}
                </option>
              ))}
            </Select>
          </div>
          <p>
            {Number(data.previous_revenue)
              ? `${(((Number(data.stats.revenue) - Number(data.previous_revenue)) / Number(data.previous_revenue)) * 100).toFixed(1)}% compared with the previous equal period`
              : 'No paid revenue in the previous period.'}
          </p>
          <div className="admin-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={data.sales} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#dedcd6" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  minTickGap={28}
                  interval="preserveStartEnd"
                  tickFormatter={(day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`}
                />
                <YAxis
                  width={48}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value: number) =>
                    new Intl.NumberFormat('en', { notation: 'compact' }).format(value)
                  }
                />
                <Tooltip />
                <Line dataKey="revenue" stroke="#d93636" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div className="admin-overview-grid">
        <div className="admin-card">
          <h2>Recent orders</h2>
          {data.recent_orders.length ? (
            data.recent_orders.map((order: any) => (
              <Link className="admin-alert-row" key={order.id} to={'/admin/orders/' + order.id}>
                <span>
                  #{order.order_number} · {order.name}
                </span>
                <StatusBadge value={order.status} />
                <strong>{order.total}</strong>
              </Link>
            ))
          ) : (
            <EmptyState title="No orders yet." />
          )}
        </div>
        <div className="admin-card">
          <h2>Inventory alerts</h2>
          {data.low_stock.length ? (
            data.low_stock.map((variant: any) => (
              <Link
                className="admin-alert-row"
                key={variant.id}
                to={'/admin/inventory/' + variant.id}
              >
                <span>{variant.sku}</span>
                <StatusBadge value={variant.stock === 0 ? 'out of stock' : 'low stock'} />
                <strong>{variant.stock}</strong>
              </Link>
            ))
          ) : (
            <EmptyState title="Stock levels look good." />
          )}
        </div>
        <div className="admin-card">
          <h2>Top products</h2>
          {data.top_products.map((product: any) => (
            <div className="admin-alert-row" key={product.product_name}>
              <span>{product.product_name}</span>
              <strong>{product.quantity} sold</strong>
            </div>
          ))}
          {!data.top_products.length && <p>No sales in this period.</p>}
        </div>
        <div className="admin-card">
          <h2>Recent activity</h2>
          {data.activity.map((log: any) => (
            <div className="admin-alert-row" key={log.id}>
              <span>
                {log.entity_type.replaceAll('_', ' ')} · {log.action}
              </span>
              <small>{new Date(log.created_at).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
