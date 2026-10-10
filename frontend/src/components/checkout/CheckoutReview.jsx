import { createUUID } from '../../utils/uuid';
import { Check } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useState, useRef } from 'react';
import { useContent } from '../../context/ContentContext';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { useOrderQuote } from '../../hooks/useOrderQuote';
import { governorateName } from '../../data/governorates';
export function CheckoutReview({ details, onEdit, promo = '' }) {
  const { isArabic, placeOrder } = useStore();
  const { isDemo } = useContent();
  const { session } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const requestKey = useRef(null);
  if (!requestKey.current) requestKey.current = createUUID();
  const quote = useOrderQuote(promo, details.governorate || 'cairo');
  return (
    <div className="review-panel">
      <h2>{isArabic ? 'راجع اختياراتك.' : 'One last look.'}</h2>
      <div className="review-address">
        <span className="eyebrow">
          {isArabic
            ? isDemo
              ? 'بيانات التواصل التجريبية'
              : 'بيانات التواصل'
            : isDemo
              ? 'SAMPLE CONTACT DETAILS'
              : 'CONTACT DETAILS'}
        </span>
        <h3>{details.name}</h3>
        <p>
          {details.email}
          <br />
          {details.address}
          <br />
          {details.city}, {details.country}
          <br />
          {governorateName(details.governorate || 'cairo', isArabic)}
        </p>
        <button className="text-link" onClick={onEdit}>
          {isArabic ? 'تعديل' : 'Edit details'}
        </button>
      </div>
      <div className="demo-payment">
        <Check size={22} />
        <div>
          <strong>
            {isDemo
              ? isArabic
                ? 'دفع تجريبي فقط'
                : 'Demo payment only'
              : isArabic
                ? 'الدفع قيد الانتظار'
                : 'Payment pending'}
          </strong>
          <p>
            {isArabic
              ? 'لن تُطلب بيانات بطاقة ولن يتم خصم أي مبلغ.'
              : 'No card details are requested. Nothing will be charged.'}
          </p>
        </div>
      </div>
      {!isDemo && !session && (
        <Link className="text-link" to="/account">
          {isArabic ? 'سجّل الدخول لإتمام الطلب' : 'Sign in to place your order'}
        </Link>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        className="button button-primary"
        disabled={
          pending || (!isDemo && (!session || !quote.data || quote.isError || quote.isFetching))
        }
        onClick={async () => {
          setPending(true);
          setError('');
          try {
            await placeOrder(details, requestKey.current, promo);
          } catch (failure) {
            setError(failure.message);
          } finally {
            setPending(false);
          }
        }}
      >
        {pending
          ? isArabic
            ? 'جاري الإرسال…'
            : 'Placing order…'
          : isDemo
            ? isArabic
              ? 'تأكيد الطلب التجريبي'
              : 'Confirm demo order'
            : isArabic
              ? 'إرسال الطلب'
              : 'Place order'}
      </button>
    </div>
  );
}
