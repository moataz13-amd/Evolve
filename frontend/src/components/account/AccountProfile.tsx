import { Link } from 'react-router-dom';
import { Package, UserRound } from 'lucide-react';
import { SectionTitle } from '../SectionTitle';
import { formatMoney } from '../../utils/format';

type Order = {
  id: string;
  order_number: number;
  total: number;
  status: string;
  created_at: string;
};
type ProfileProps = {
  isArabic: boolean;
  name: string;
  email: string;
  phone?: string;
  orders: Order[];
  loading: boolean;
  failed: boolean;
  canManage: boolean;
  signingOut: boolean;
  signoutError: string;
  onRetry: () => void;
  onSignOut: () => void;
};
const orderLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  confirmed: 'تم التأكيد',
  processing: 'قيد التجهيز',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
  refunded: 'تم الاسترداد',
};
export function AccountProfile({
  isArabic,
  name,
  email,
  phone,
  orders,
  loading,
  failed,
  canManage,
  signingOut,
  signoutError,
  onRetry,
  onSignOut,
}: ProfileProps) {
  const text = (arabic: string, english: string) => (isArabic ? arabic : english);
  const initial = Array.from(name.trim())[0]?.toUpperCase();
  const sortedOrders = [...orders].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  return (
    <section className="section shopper-profile" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="profile-topline">
        <span className="eyebrow">EVOLVE / YOUR ACCOUNT</span>
        <Link className="text-link" to="/shop">
          {text('العودة للتسوق', 'Back to shopping')}
        </Link>
      </div>
      <div className="profile-banner">
        <span className="eyebrow">
          {text('كل يوم. خطوة أقوى.', 'EVERY DAY. ONE STEP STRONGER.')}
        </span>
        <SectionTitle as="h1">{text('مساحتك. بطريقتك.', 'Your space. Your pace.')}</SectionTitle>
        <p>
          {text(
            'بياناتك وطلباتك، في مكان واحد. كمل طريقك مع EVOLVE.',
            'Your details and your orders, all in one place. Keep moving with EVOLVE.',
          )}
        </p>
        <span className="profile-banner-index" aria-hidden="true">
          EVOLVE / 01
        </span>
      </div>
      <div className="profile-grid">
        <aside className="profile-identity" aria-label={text('بيانات الحساب', 'Account details')}>
          <div className="profile-avatar" aria-hidden="true">
            {initial || <UserRound size={26} />}
          </div>
          <span className="eyebrow">{text('أهلًا بيك في EVOLVE', 'WELCOME TO EVOLVE')}</span>
          <h2>{name || text('حسابك', 'Your account')}</h2>
          <dl className="profile-details">
            <div>
              <dt>{text('البريد الإلكتروني', 'Email address')}</dt>
              <dd dir="ltr">{email}</dd>
            </div>
            {phone && (
              <div>
                <dt>{text('رقم الهاتف', 'Phone number')}</dt>
                <dd dir="ltr">{phone}</dd>
              </div>
            )}
          </dl>
          <nav className="profile-links" aria-label={text('روابط الحساب', 'Account links')}>
            <Link to="/wishlist">{text('المفضلة', 'Saved essentials')}</Link>
            <Link to="/contact">{text('تواصل معنا', 'Contact us')}</Link>
          </nav>
          {canManage && (
            <Link className="button account-admin-button compact-button" to="/admin">
              {text('لوحة التحكم', 'Admin dashboard')}
            </Link>
          )}
          <button
            type="button"
            className="profile-signout"
            disabled={signingOut}
            onClick={onSignOut}
          >
            {signingOut
              ? text('جاري تسجيل الخروج…', 'Signing out…')
              : text('تسجيل الخروج', 'Sign out')}
          </button>
          {signoutError && (
            <p className="profile-error" role="alert">
              {signoutError}
            </p>
          )}
        </aside>
        <div className="profile-orders">
          <div className="profile-orders-heading">
            <div>
              <span className="eyebrow">YOUR NEXT CHAPTER</span>
              <h2>
                {text('طلباتك', 'Your orders')}
                <span
                  className="profile-order-count"
                  aria-label={text('عدد الطلبات', 'Order count')}
                >
                  {loading || failed ? '—' : orders.length}
                </span>
              </h2>
              <p>
                {text(
                  'تابع حالة طلباتك وارجع لتفاصيلها بسهولة.',
                  'Follow your orders and find every detail, whenever you need it.',
                )}
              </p>
            </div>
            <Link className="button button-primary compact-button" to="/shop">
              {text('تسوق المجموعة', 'Shop the collection')}
            </Link>
          </div>
          {failed ? (
            <div className="profile-state" role="alert">
              <h3>
                {text(
                  'مش قادرين نحمل بيانات الحساب دلوقتي.',
                  'We couldn’t load your account details.',
                )}
              </h3>
              <p>
                {text(
                  'جرب مرة تانية لاستعادة بياناتك وطلباتك.',
                  'Try again to retrieve your details and orders.',
                )}
              </p>
              <button
                className="button account-admin-button compact-button"
                type="button"
                onClick={onRetry}
              >
                {text('حاول مرة تانية', 'Try again')}
              </button>
            </div>
          ) : loading ? (
            <div
              className="profile-orders-loading"
              role="status"
              aria-label={text('جاري تحميل الطلبات', 'Loading orders')}
            >
              {[1, 2, 3].map((row) => (
                <div className="profile-order-skeleton" key={row} />
              ))}
            </div>
          ) : sortedOrders.length ? (
            <div className="profile-order-list">
              {sortedOrders.map((order) => (
                <Link className="profile-order-row" key={order.id} to={'/order/' + order.id}>
                  <div className="profile-order-number">
                    <span className="eyebrow">{text('الطلب', 'ORDER')}</span>
                    <strong dir="ltr">#{order.order_number}</strong>
                    <time dateTime={order.created_at}>
                      {new Date(order.created_at).toLocaleDateString(isArabic ? 'ar-EG' : 'en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </time>
                  </div>
                  <span
                    className={`profile-order-status${order.status === 'delivered' ? ' is-delivered' : order.status === 'cancelled' ? ' is-cancelled' : ''}`}
                  >
                    {isArabic
                      ? orderLabels[order.status] || order.status
                      : order.status.replaceAll('_', ' ')}
                  </span>
                  <div className="profile-order-total">
                    <strong dir="ltr">{formatMoney(order.total)}</strong>
                    <span>{text('عرض التفاصيل', 'View details')}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="profile-state profile-empty">
              <span className="profile-empty-icon" aria-hidden="true">
                <Package size={32} strokeWidth={1.4} />
              </span>
              <span className="eyebrow">START YOUR ROTATION</span>
              <h3>{text('أول طلب ليك يبدأ هنا.', 'Your first order starts here.')}</h3>
              <p>
                {text(
                  'لسه مفيش طلبات. اكتشف قطعك المفضلة، وهتلاقي تفاصيل طلبك هنا بعد إتمامه.',
                  'No orders yet. Find your next essential, and your order details will appear here after checkout.',
                )}
              </p>
              <Link className="text-link" to="/shop">
                {text('اكتشف المنتجات', 'Explore essentials')}
              </Link>
            </div>
          )}
          <div className="profile-help">
            <div>
              <strong>{text('محتاج مساعدة؟', 'Need a hand?')}</strong>
              <p>
                {text(
                  'لأي سؤال عن حسابك أو طلبك، تواصل معانا.',
                  'Have a question about your account or an order? Get in touch.',
                )}
              </p>
            </div>
            <Link className="text-link" to="/contact">
              {text('تواصل معنا', 'Contact us')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
