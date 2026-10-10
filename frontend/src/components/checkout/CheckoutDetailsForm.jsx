import { Select } from '../Select';
import { useStore } from '../../context/StoreContext';
import { useContent } from '../../context/ContentContext';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { governorates } from '../../data/governorates';
export function CheckoutDetailsForm({
  details,
  onContinue,
  governorate = 'cairo',
  onGovernorateChange,
}) {
  const { isArabic, profile } = useStore();
  const { isDemo } = useContent();
  const { session } = useAuth();
  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onContinue(Object.fromEntries(formData.entries()));
  }
  return (
    <form className="store-form" onSubmit={handleSubmit}>
      <div className="checkout-form-heading">
        <span className="eyebrow">
          {isArabic
            ? isDemo
              ? '01 / بياناتك التجريبية'
              : '01 / بياناتك'
            : isDemo
              ? '01 / YOUR SAMPLE DETAILS'
              : '01 / YOUR DETAILS'}
        </span>
        <h2>{isArabic ? 'نبدأ بالأساسيات.' : 'Start with the essentials.'}</h2>
        <p>
          {isArabic
            ? 'راجع بياناتك قبل الانتقال لتأكيد الطلب.'
            : isDemo
              ? 'Add your sample details, then review your order.'
              : 'Add your delivery details, then review your order.'}
        </p>
      </div>
      {!isDemo && !session && (
        <Link className="text-link" to="/account">
          {isArabic ? 'سجّل الدخول لإتمام الطلب' : 'Sign in before checkout'}
        </Link>
      )}
      <div className="form-row">
        <label>
          {isArabic ? 'الاسم' : 'Name'}
          <input
            required
            name="name"
            defaultValue={
              details?.name || (isDemo ? profile?.name : session?.user.user_metadata?.name) || ''
            }
            autoComplete={isDemo ? 'off' : 'name'}
            maxLength={80}
            placeholder={
              isDemo ? (isArabic ? 'اسم تجريبي' : 'Sample name') : isArabic ? 'اسمك' : 'Your name'
            }
          />
        </label>
        <label>
          {isArabic ? 'البريد الإلكتروني' : 'Email'}
          <input
            required
            name="email"
            type="email"
            dir="ltr"
            placeholder={isDemo ? 'demo@example.com' : 'Email'}
            defaultValue={
              isDemo ? details?.email || profile?.email || '' : session?.user.email || ''
            }
            readOnly={!isDemo}
            autoComplete={isDemo ? 'off' : 'email'}
          />
        </label>
      </div>
      <label>
        {isArabic
          ? isDemo
            ? 'العنوان التجريبي'
            : 'عنوان التوصيل'
          : isDemo
            ? 'Sample address'
            : 'Delivery address'}
        <input
          required
          name="address"
          defaultValue={details?.address}
          autoComplete={isDemo ? 'off' : 'street-address'}
          maxLength={300}
          placeholder={
            isDemo
              ? isArabic
                ? 'شارع تجريبي، رقم المبنى'
                : 'Sample street, building number'
              : isArabic
                ? 'الشارع ورقم المبنى'
                : 'Street and building number'
          }
        />
      </label>
      <div className="form-row">
        <label>
          {isArabic ? 'المحافظة' : 'Governorate'}
          <Select
            name="governorate"
            required
            value={governorate}
            autoComplete="address-level1"
            onChange={(event) => onGovernorateChange?.(event.target.value)}
          >
            {governorates.map((item) => (
              <option key={item.code} value={item.code}>
                {isArabic ? item.nameAr : item.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          {isArabic ? 'المدينة' : 'City'}
          <input
            required
            name="city"
            defaultValue={details?.city}
            autoComplete="off"
            placeholder={isArabic ? 'المدينة' : 'City'}
          />
        </label>
      </div>
      <label>
        {isArabic ? 'الدولة' : 'Country'}
        <Select name="country" defaultValue="Egypt">
          <option value="Egypt">{isArabic ? 'مصر' : 'Egypt'}</option>
        </Select>
      </label>
      {!isDemo && (
        <label>
          {isArabic ? 'رقم الهاتف' : 'Phone'}
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            maxLength={50}
            defaultValue={details?.phone || ''}
          />
        </label>
      )}
      <button type="submit" className="button button-primary" disabled={!isDemo && !session}>
        {isArabic ? 'مراجعة الطلب' : isDemo ? 'Review your demo order' : 'Review your order'}
      </button>
    </form>
  );
}
