import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { useStorefrontOffers } from '../../hooks/useStorefrontOffers';
import { activeOfferAnnouncements, offerAnnouncementText } from '../../utils/offerAnnouncements';

export function OfferAnnouncement() {
  const { isArabic } = useStore();
  const { data = [] } = useStorefrontOffers();
  const [now, setNow] = useState(Date.now);
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const offers = activeOfferAnnouncements(data, now);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (!focused) setIndex((value) => value + 1);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [focused]);
  const offer = offers.length ? offers[index % offers.length] : null;
  return (
    <div
      className="announcement offer-announcement"
      aria-label={isArabic ? 'عروض EVOLVE الحالية' : 'Current EVOLVE offers'}
    >
      <Link
        to={offer ? `/shop?${new URLSearchParams({ offer: offer.id })}` : '/shop'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <span key={offer?.id || 'brand'}>
          {offer
            ? offerAnnouncementText(offer, isArabic)
            : isArabic
              ? 'تحرّك بهدف. اكتشف منتجات EVOLVE.'
              : 'MOVE WITH PURPOSE. EXPLORE EVOLVE.'}
        </span>
      </Link>
    </div>
  );
}
