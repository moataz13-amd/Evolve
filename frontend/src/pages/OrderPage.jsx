import { SectionTitle } from '../components/SectionTitle';
import { Link, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatMoney } from '../utils/format';
import { useContent } from '../context/ContentContext';
import { LiveOrder } from '../components/checkout/LiveOrder';

export default function OrderPage() {
  const { id } = useParams();
  const { orders, isArabic } = useStore();
  const { isDemo } = useContent();
  if (!isDemo) return <LiveOrder id={id} />;
  const order = orders.find((order) => order.id === id);
  if (!order)
    return (
      <section className="section empty">
        <SectionTitle as="h1">
          {isArabic ? 'الطلب غير موجود على هذا الجهاز.' : 'Order not found in this browser.'}
        </SectionTitle>
        <Link to="/account">{isArabic ? 'ارجع لحسابك' : 'Back to your profile'}</Link>
      </section>
    );
  return (
    <section className="section confirmation">
      <div className="confirmation-icon">
        <Check size={30} />
      </div>
      <span className="eyebrow">DEMO COMPLETE / #{order.id}</span>
      <SectionTitle as="h1">{isArabic ? 'اختيارات قوية.' : 'A strong choice.'}</SectionTitle>
      <p>
        {isArabic
          ? 'تم حفظ الطلب التجريبي على هذا الجهاز فقط. لا يوجد دفع أو تجهيز أو شحن فعلي.'
          : 'Your demo order is saved in this browser. No payment, fulfillment, or delivery will take place.'}
      </p>
      <div className="confirmation-products">
        {order.items.map((item) => (
          <div key={item.key}>
            <img src={item.image} alt={item.name} width="100" height="120" />
            <h3>{isArabic ? item.ar : item.name}</h3>
            <small>
              {item.size} / {item.color} ×{item.qty}
            </small>
          </div>
        ))}
      </div>
      <div className="confirmation-total">
        {isArabic ? 'الإجمالي التجريبي' : 'Demo total'} <strong>{formatMoney(order.total)}</strong>
      </div>
      <div className="confirmation-links">
        <Link className="button button-primary" to="/shop">
          {isArabic ? 'كمل اكتشاف' : 'Keep exploring'}
        </Link>
        <Link className="text-link" to="/account">
          {isArabic ? 'عرض طلباتي' : 'View my demo orders'}
        </Link>
      </div>
    </section>
  );
}
