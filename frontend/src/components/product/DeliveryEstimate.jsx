import { useEffect, useState } from 'react';
import { PackageCheck, Truck, CalendarDays } from 'lucide-react';
import { useContent } from '../../context/ContentContext';
import { useStore } from '../../context/StoreContext';
import { formatDeliveryDate, getDeliveryEstimate } from '../../utils/deliveryEstimate';
import './delivery-estimate.css';

export function DeliveryEstimate({ available }) {
  const { data } = useContent();
  const { isArabic } = useStore();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const settings = data?.settings;
  const estimate = available ? getDeliveryEstimate(settings, now) : null;
  return (
    <DeliveryEstimateCard
      estimate={estimate}
      available={available}
      isArabic={isArabic}
      skipWeekends={settings?.delivery_skip_weekends}
    />
  );
}

export function DeliveryEstimateCard({ estimate, available, isArabic, skipWeekends = false }) {
  const date = (value) => formatDeliveryDate(value, isArabic);
  const range = (min, max) =>
    min.getTime() === max.getTime() ? date(min) : `${date(min)} – ${date(max)}`;
  return (
    <section
      className="delivery-estimate"
      dir={isArabic ? 'rtl' : 'ltr'}
      aria-labelledby="delivery-estimate-title"
    >
      <div className="delivery-estimate-heading">
        <span className="delivery-estimate-mark">
          <Truck size={20} aria-hidden="true" />
        </span>
        <div>
          <span className="delivery-estimate-eyebrow">
            EVOLVE / {isArabic ? 'الشحن والتوصيل' : 'DISPATCH & DELIVERY'}
          </span>
          <h2 id="delivery-estimate-title">
            {isArabic ? 'لو طلبت النهارده' : 'If you order today'}
          </h2>
        </div>
      </div>
      {estimate ? (
        <>
          <ol className="delivery-estimate-timeline">
            {[
              {
                icon: CalendarDays,
                title: isArabic ? 'تأكيد الطلب' : 'Place your order',
                value: date(estimate.ordered),
              },
              {
                icon: PackageCheck,
                title: isArabic ? 'الشحن المتوقع' : 'Estimated dispatch',
                value: range(estimate.dispatchMin, estimate.dispatchMax),
              },
              {
                icon: Truck,
                title: isArabic ? 'الوصول المتوقع' : 'Estimated arrival',
                value: range(estimate.arrivalMin, estimate.arrivalMax),
              },
            ].map(({ icon: Icon, title, value }) => (
              <li key={title}>
                <span className="delivery-estimate-step">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <div>
                  <span>{title}</span>
                  <strong dir="auto">{value}</strong>
                </div>
              </li>
            ))}
          </ol>
          <p className="delivery-estimate-note">
            {isArabic
              ? 'مواعيد تقديرية تبدأ من تأكيد الطلب، وقد تختلف حسب العنوان وشركة الشحن والعطلات الرسمية.'
              : 'Estimates start from order confirmation and may vary by address, courier and public holidays.'}{' '}
            {skipWeekends &&
              (isArabic ? 'الجمعة والسبت غير محسوبين.' : 'Fridays and Saturdays are excluded.')}
          </p>
        </>
      ) : (
        <p className="delivery-estimate-unavailable">
          {!available
            ? isArabic
              ? 'الاختيار ده غير متوفر حاليًا. مواعيد التوصيل هتظهر لما يكون متاح للطلب.'
              : 'This selection is currently unavailable. Delivery estimates apply when it is available to order.'
            : isArabic
              ? 'تواصل معنا لمعرفة موعد الشحن والتوصيل المتوقع لعنوانك.'
              : 'Contact us for estimated dispatch and delivery dates for your address.'}
        </p>
      )}
    </section>
  );
}
