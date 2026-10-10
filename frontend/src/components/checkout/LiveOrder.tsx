import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { database, mediaUrl } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
export function LiveOrder({ id }: { id: string }) {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ['customer', 'order', id, session?.user.id],
    queryFn: async () => {
      const { data, error } = await database()
        .from('orders')
        .select('*,order_items(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session,
  });
  if (!session)
    return (
      <section className="section empty">
        <h1>Sign in to view your order.</h1>
        <Link to="/account">Sign in</Link>
      </section>
    );
  if (query.isPending)
    return (
      <section className="section loading" role="status">
        Loading your order…
      </section>
    );
  if (query.isError)
    return (
      <section className="section empty" role="alert">
        <h1>Order unavailable.</h1>
        <p>{query.error.message}</p>
        <Link to="/account">My account</Link>
      </section>
    );
  const order = query.data;
  return (
    <section className="section confirmation">
      <span className="eyebrow">EVOLVE / #{order.order_number}</span>
      <h1>Order received.</h1>
      <p>
        Status: {order.status}. Payment: {order.payment_status}. No card has been charged by this
        checkout.
      </p>
      <div className="confirmation-products">
        {order.order_items.map((item: any) => (
          <div key={item.id}>
            {item.image_url && (
              <img
                src={mediaUrl(item.image_url)}
                alt={item.product_name}
                width={140}
                height={150}
              />
            )}
            <h3>{item.product_name}</h3>
            <small>
              {item.size} / {item.color_name} ×{item.quantity}
            </small>
            {!!item.free_quantity && <p className="offer-gift">{item.free_quantity} free</p>}
          </div>
        ))}
      </div>
      <div className="confirmation-total">
        Total
        <strong>
          {Number(order.total).toLocaleString(undefined, {
            style: 'currency',
            currency: order.currency,
          })}
        </strong>
      </div>
      <Link className="button button-primary compact-button" to="/account">
        My orders
      </Link>
    </section>
  );
}
