import { formatMoney } from './format.js';
import { quantityOfferLabel } from './offers.js';

export function activeOfferAnnouncements(offers, now = Date.now()) {
  return offers.filter(
    (offer) =>
      offer.active &&
      (!offer.starts_at || Date.parse(offer.starts_at) <= now) &&
      (!offer.ends_at || Date.parse(offer.ends_at) > now) &&
      offer.offer_products?.some(
        ({ products: product }) =>
          product?.active &&
          !product.archived &&
          !(product.tags || []).some(
            (tag) =>
              String(tag)
                .trim()
                .toUpperCase()
                .replace(/[\s-]+/g, '_') === 'COMING_SOON',
          ),
      ),
  );
}

export function offerAnnouncementText(offer, isArabic = false) {
  if (offer.discount_type === 'buy_get') return quantityOfferLabel(offer, isArabic);
  if (offer.discount_type === 'percentage')
    return isArabic
      ? `خصم ${Number(offer.discount_value)}% على منتجات مختارة`
      : `${Number(offer.discount_value)}% OFF SELECTED STYLES`;
  return isArabic
    ? `خصم ${formatMoney(offer.discount_value, 'EGP')} على منتجات مختارة`
    : `${formatMoney(offer.discount_value, 'EGP')} OFF SELECTED STYLES`;
}
