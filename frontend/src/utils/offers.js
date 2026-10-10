export function offerPrice(basePrice, offers, now = Date.now()) {
  const base = Number(basePrice);
  const cents = BigInt(Math.round(base * 100));
  const eligible = offers.filter(
    (offer) =>
      offer.discount_type !== 'buy_get' &&
      offer.active &&
      (!offer.starts_at || new Date(offer.starts_at).getTime() <= now) &&
      (!offer.ends_at || new Date(offer.ends_at).getTime() > now),
  );
  const priced = eligible
    .map((offer) => ({
      offer,
      price: Math.max(
        0,
        Number(
          offer.discount_type === 'percentage'
            ? (cents * (10000n - BigInt(Math.round(Number(offer.discount_value) * 100))) + 5000n) /
                10000n
            : cents - BigInt(Math.round(Number(offer.discount_value) * 100)),
        ) / 100,
      ),
    }))
    .sort((a, b) => a.price - b.price || String(a.offer.id).localeCompare(String(b.offer.id)));
  return priced[0]?.price < base ? priced[0] : { price: base, offer: null };
}

export function quantityOfferLabel(offer, isArabic = false) {
  return isArabic
    ? `اشتري ${offer.buy_quantity} وخد ${offer.get_quantity} هدية`
    : `Buy ${offer.buy_quantity}, get ${offer.get_quantity} free`;
}

export function liveQuantityOffers(offers, now = Date.now()) {
  return offers.filter(
    (offer) =>
      offer.discount_type === 'buy_get' &&
      offer.active &&
      (!offer.starts_at || Date.parse(offer.starts_at) <= now) &&
      (!offer.ends_at || Date.parse(offer.ends_at) > now),
  );
}
