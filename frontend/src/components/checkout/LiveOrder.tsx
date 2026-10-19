import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { database, mediaUrl } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
export function LiveOrder({ id }: { id: string }) {
  const { session, loading } = useAuth();
  const { isArabic } = useStore();
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
  if (loading)
    return (
      <section className="section loading" role="status">
        {isArabic ? 'جارٍ تحميل الطلب…' : 'Loading your order…'}
      </section>
    );
  if (!session)
    return (
      <section className="section empty">
        <h1>
          {isArabic ? 'الطلب غير متاح على هذا الجهاز.' : 'Order unavailable in this browser.'}
        </h1>
        <Link to="/shop">{isArabic ? 'متابعة التسوق' : 'Continue shopping'}</Link>
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
  const isGuest = session.user.is_anonymous;
  return (
    <section className="section confirmation">
      <span className="eyebrow">EVOLVE / #{order.order_number}</span>
      <h1>Order received.</h1>
      <p>
        Status: {order.status}. Payment: {order.payment_status}. No card has been charged by this
        checkout.
      </p>
      {isGuest && (
        <p>
          {isArabic
            ? 'احتفظ برقم الطلب. تقدر تشوف الطلب من نفس المتصفح طول ما جلسة الضيف موجودة.'
            : 'Save your order number. This guest order remains available in this browser while the guest session is active.'}
        </p>
      )}
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
              {item.size} / {item.color_name} · {item.quantity - (item.free_quantity || 0)} paid
              {!!item.free_quantity && ` + ${item.free_quantity} free`}
            </small>
            {!!item.free_quantity && <p className="offer-gift">{item.quantity} pieces total</p>}
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
