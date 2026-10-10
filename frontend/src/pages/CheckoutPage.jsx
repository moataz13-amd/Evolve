import { CheckoutDetailsForm } from '../components/checkout/CheckoutDetailsForm';
import { CheckoutReview } from '../components/checkout/CheckoutReview';
import { OrderSummary } from '../components/checkout/OrderSummary';
import { useEffect, useRef, useState } from 'react';
import { ShoppingBag, Check, FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useStore } from '../context/StoreContext';

import { PageIntro } from '../components/PageIntro';
import { useContent } from '../context/ContentContext';

const checkoutSteps = { details: 'details', review: 'review' };

export default function CheckoutPage() {
  const { isArabic, cart } = useStore();
  const { isDemo, data, loading, error, retry } = useContent();
  const [promo, setPromo] = useState('');
  const [currentStep, setCurrentStep] = useState(checkoutSteps.details);
  const [details, setDetails] = useState(null);
  const [governorate, setGovernorate] = useState('cairo');
  const stepPanelRef = useRef(null);
  useEffect(() => {
    if (details) stepPanelRef.current?.focus();
  }, [currentStep, details]);

  function handleContinue(formDetails) {
    setDetails(formDetails);
    setCurrentStep(checkoutSteps.review);
  }

  if (!cart.length)
    return (
      <section className="section utility-page checkout-empty">
        <span className="checkout-empty-icon">
          <ShoppingBag size={32} />
        </span>
        <PageIntro
          label="CHECKOUT"
          title={isArabic ? 'حقيبتك فاضية.' : 'Your bag needs an essential.'}
        />
        <p>
          {isArabic
            ? 'اختار أساسياتك المفضلة، وبعدها ارجع لإتمام طلبك التجريبي.'
            : 'Find your next essential, then come back to explore checkout.'}
        </p>
        <Link className="button button-primary compact-button" to="/shop">
          {isArabic ? 'ابدأ التسوق' : 'Start shopping'}
        </Link>
      </section>
    );
  if (!isDemo && !data?.settings)
    return (
      <section className="section empty" role={loading ? 'status' : 'alert'}>
        <h1>
          {loading
            ? isArabic
              ? 'جارٍ تجهيز إتمام الطلب…'
              : 'Preparing checkout…'
            : isArabic
              ? 'تعذّر تحميل إعدادات الطلب.'
              : 'Unable to load checkout settings.'}
        </h1>
        {!loading && (
          <>
            <p>{error}</p>
            <button className="button button-primary compact-button" onClick={retry}>
              {isArabic ? 'حاول مرة أخرى' : 'Try again'}
            </button>
          </>
        )}
      </section>
    );
  if (!isDemo && (!data.settings.allow_checkout || data.settings.maintenance_mode))
    return (
      <section className="section empty">
        <h1>{isArabic ? 'إتمام الطلب غير متاح حاليًا.' : 'Checkout is currently unavailable.'}</h1>
        <Link to="/shop">{isArabic ? 'متابعة التسوق' : 'Continue shopping'}</Link>
      </section>
    );
  return (
    <section className="section checkout-page">
      <PageIntro
        label={isDemo ? 'THE FINAL STEP / DEMO' : 'THE FINAL STEP / EVOLVE'}
        title={isArabic ? 'جاهز للخطوة الجاية؟' : 'Ready for your next move?'}
        copy={
          !isDemo
            ? isArabic
              ? 'راجع بياناتك واختياراتك قبل إرسال الطلب.'
              : 'Review your details and essentials before placing your order.'
            : isArabic
              ? 'إتمام طلب تجريبي فقط. استخدم بيانات وهمية؛ لا يوجد دفع أو شحن.'
              : 'Demo checkout only. Use sample details; there is no payment or delivery.'
        }
      />
      {isDemo && (
        <div className="checkout-demo-banner">
          <FlaskConical size={20} aria-hidden="true" />
          <span>
            {isArabic
              ? 'تجربة تسوق فقط — بدون دفع أو شحن فعلي. استخدم بيانات وهمية.'
              : 'Try the experience. No payment or delivery is processed. Use sample details.'}
          </span>
        </div>
      )}
      <ol
        className="checkout-progress"
        aria-label={isArabic ? 'خطوات إتمام الطلب' : 'Checkout progress'}
      >
        <li
          className={currentStep === checkoutSteps.details ? 'active' : 'complete'}
          aria-current={currentStep === checkoutSteps.details ? 'step' : undefined}
        >
          <span className="checkout-step-number">
            {currentStep === checkoutSteps.review ? <Check size={16} /> : '01'}
          </span>
          {isArabic ? 'البيانات' : 'Details'}
        </li>
        <li
          className={currentStep === checkoutSteps.review ? 'active' : ''}
          aria-current={currentStep === checkoutSteps.review ? 'step' : undefined}
        >
          <span className="checkout-step-number">02</span>
          {isArabic ? 'المراجعة' : 'Review'}
        </li>
        <li>
          <span className="checkout-step-number">03</span>
          {isArabic ? 'التأكيد' : 'Confirmation'}
        </li>
      </ol>
      <div className="checkout-layout">
        <div
          className="checkout-details-card"
          ref={stepPanelRef}
          tabIndex={-1}
          aria-label={isArabic ? 'بيانات الطلب' : 'Order details'}
        >
          {currentStep === checkoutSteps.details ? (
            <CheckoutDetailsForm
              details={details}
              onContinue={handleContinue}
              governorate={governorate}
              onGovernorateChange={setGovernorate}
            />
          ) : (
            <CheckoutReview
              details={details}
              promo={promo}
              onEdit={() => setCurrentStep(checkoutSteps.details)}
            />
          )}
        </div>
        <OrderSummary promo={promo} onPromoChange={setPromo} governorate={governorate} />
      </div>
    </section>
  );
}
