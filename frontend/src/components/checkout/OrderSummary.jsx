import { OfferSavings } from './OfferSavings';
import { Link } from 'react-router-dom';

import { useStore } from '../../context/StoreContext';
import { formatMoney } from '../../utils/format';
import { useContent } from '../../context/ContentContext';
import { useOrderQuote } from '../../hooks/useOrderQuote';
import { useState } from 'react';
import { governorateName } from '../../data/governorates';
export function OrderSummary({ promo = '', onPromoChange, governorate = 'cairo' }) {
  const { isArabic, cart, cartCount, cartTotal } = useStore();
  const { isDemo } = useContent();
  const [code, setCode] = useState(promo);
  const quote = useOrderQuote(promo, governorate);
  const money = (value) =>
    isDemo
      ? formatMoney(value)
      : new Intl.NumberFormat(isArabic ? 'ar-EG' : 'en-US', {
          style: 'currency',
          currency: quote.data?.currency || 'EGP',
        }).format(Number(value));
  return (
    <aside className="order-summary" aria-label={isArabic ? 'ملخص الطلب' : 'Order summary'}>
      <span className="eyebrow">{isArabic ? 'اختياراتك / EVOLVE' : 'YOUR BAG / EVOLVE'}</span>
      <h3>
        {isArabic ? 'ملخص الطلب' : 'Order summary'} <span>({cartCount})</span>
      </h3>
      {cart.map((item) => {
        const pricing = quote.data?.items?.find((line) => line.variant_id === item.variantId);
        return (
          <div className="summary-item" key={item.key}>
            <img src={item.image} alt={item.name} width="70" height="85" />
            <div>
              <strong>{isArabic ? item.ar : item.name}</strong>
              <p>
                {item.color} / {item.size} · ×{item.qty}
              </p>
              {!!pricing?.free_quantity && (
                <small className="offer-gift">
                  {isArabic
                    ? `منها ${pricing.free_quantity} هدية`
                    : `${pricing.free_quantity} free`}
                </small>
              )}
            </div>
            <span>
              {money(
                pricing
                  ? pricing.unit_price * (pricing.quantity - pricing.free_quantity)
                  : item.price * item.qty,
              )}
            </span>
          </div>
        );
      })}
      <OfferSavings quote={quote.data} />
      <div className="summary-line">
        <span>{isArabic ? 'إجمالي المنتجات' : 'Subtotal'}</span>
        <span>{money(quote.data?.subtotal ?? cartTotal)}</span>
      </div>
      <div className="summary-line">
        <span>
          {isArabic ? 'الشحن' : 'Delivery'} · {governorateName(governorate, isArabic)}
        </span>
        <small>
          {isDemo
            ? isArabic
              ? 'غير متاح في النسخة التجريبية'
              : 'Not available in this demo'
            : quote.isFetching
              ? '…'
              : quote.isError
                ? '—'
                : money(quote.data?.shipping ?? 0)}
        </small>
      </div>
      <div className="summary-line total">
        <strong>
          {isDemo
            ? isArabic
              ? 'الإجمالي التجريبي'
              : 'Demo total'
            : isArabic
              ? 'الإجمالي'
              : 'Total'}
        </strong>
        <strong>
          {quote.isFetching ? '…' : quote.isError ? '—' : money(quote.data?.total ?? cartTotal)}
        </strong>
      </div>
      {!isDemo && (
        <>
          <form
            className="store-form"
            onSubmit={(event) => {
              event.preventDefault();
              onPromoChange?.(code.trim().toUpperCase());
            }}
          >
            <label>
              {isArabic ? 'كود الخصم' : 'Promo code'}
              <input value={code} onChange={(event) => setCode(event.target.value)} />
            </label>
            <button className="button" type="submit">
              {isArabic ? 'تطبيق' : 'Apply code'}
            </button>
          </form>
          {quote.isError && <p role="alert">{quote.error.message}</p>}
          {!!quote.data?.discount && (
            <p>
              {isArabic ? 'الخصم' : 'Discount'}: {money(quote.data.discount)}
            </p>
          )}
        </>
      )}
      {isDemo && (
        <p className="summary-note">
          {isArabic ? 'لا يُعتبر هذا طلب شراء فعلي.' : 'This does not create a real purchase.'}
        </p>
      )}
      <Link className="text-link" to="/shop">
        {isArabic ? 'استمر في التسوق' : 'Continue shopping'}
      </Link>
    </aside>
  );
}
