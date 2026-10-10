import { matchesProductTag } from './catalogPlacement.js';

const badges = {
  BESTSELLER: { label: 'Best Seller', arabicLabel: 'الأكثر مبيعًا', variant: 'bestseller' },
  NEW: { label: 'New Arrival', arabicLabel: 'وصل حديثًا', variant: 'new' },
  SALE: { label: 'Sale', arabicLabel: 'خصم', variant: 'sale' },
  RESTOCK: { label: 'Restocked', arabicLabel: 'متوفر مجددًا', variant: 'restock' },
  COMING_SOON: { label: 'Coming Soon', arabicLabel: 'قريبًا', variant: 'coming-soon' },
  SOLD_OUT: { label: 'Sold Out', arabicLabel: 'غير متوفر', variant: 'sold-out' },
};

export function productBadge(product) {
  return productBadges(product)[0] || null;
}

export function productBadges(product) {
  if (product.badgeMode === 'hidden') return [];
  if (matchesProductTag(product, 'COMING_SOON') && product.badgeMode !== 'custom')
    return [badges.COMING_SOON];
  if (!product.sizes.length) return [badges.SOLD_OUT];
  if (product.badgeMode === 'custom' && product.badgeLabel)
    return [
      {
        label: product.badgeLabel,
        arabicLabel: product.badgeLabelAr || product.badgeLabel,
        variant: product.badgeVariant || 'new',
      },
    ];
  const result = [];
  const previousPrice = Number(product.compareAtPrice);
  const price = Number(product.price);
  if (previousPrice > price && price >= 0 && product.discountOffer?.show_badge !== false) {
    const percent = Number((((previousPrice - price) / previousPrice) * 100).toFixed(1));
    result.push({
      label:
        product.discountOffer?.badge_label && product.discountOffer.badge_label !== 'Offer'
          ? product.discountOffer.badge_label
          : percent > 0
            ? `${percent}% OFF`
            : 'Sale',
      arabicLabel:
        product.discountOffer?.badge_label_ar && product.discountOffer.badge_label_ar !== 'عرض'
          ? product.discountOffer.badge_label_ar
          : percent > 0
            ? `خصم ${percent}%`
            : 'خصم',
      variant: 'sale',
    });
  }
  for (const offer of product.quantityOffers || []) {
    if (!offer.show_badge) continue;
    result.push({
      label:
        offer.badge_label && offer.badge_label !== 'Offer'
          ? offer.badge_label
          : `BUY ${offer.buy_quantity} GET ${offer.get_quantity} FREE`,
      arabicLabel:
        offer.badge_label_ar && offer.badge_label_ar !== 'عرض'
          ? offer.badge_label_ar
          : `اشتري ${offer.buy_quantity} وخد ${offer.get_quantity} هدية`,
      variant: 'quantity-offer',
    });
  }
  if (result.length)
    return result.filter(
      (badge, index) =>
        result.findIndex((item) => item.label === badge.label && item.variant === badge.variant) ===
        index,
    );
  const fallback = product.offerBadge || badges[product.tag];
  return fallback ? [fallback] : [];
}
