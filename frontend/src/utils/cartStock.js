export function giftQuantity(paidQuantity, offer) {
  const buy = Number(offer?.buy_quantity);
  const get = Number(offer?.get_quantity);
  if (!Number.isInteger(buy) || buy < 1 || !Number.isInteger(get) || get < 1) return 0;
  return Math.floor(paidQuantity / buy) * get;
}

export function maximumPaidQuantity(stock, offer) {
  const buy = Number(offer?.buy_quantity);
  const get = Number(offer?.get_quantity);
  if (!Number.isInteger(buy) || buy < 1 || !Number.isInteger(get) || get < 1) return stock;
  const groups = Math.floor(stock / (buy + get));
  return groups * buy + Math.min(stock % (buy + get), buy - 1);
}

export function singleLineQuantityOffer(cart, item) {
  return item.quantityOffers?.find(
    (offer) =>
      cart.filter((line) => line.quantityOffers?.some((candidate) => candidate.id === offer.id))
        .length === 1,
  );
}

export function cartStockStatus(item, variant, offer) {
  if (!variant || !variant.active) return { kind: 'out', remaining: 0 };
  if (!variant.track_quantity) return { kind: 'available', remaining: null };

  const remaining = Math.max(0, Number(variant.stock) || 0);
  if (remaining === 0) return { kind: 'out', remaining };
  if (offer) {
    const gift = giftQuantity(item.qty, offer);
    const maxPaid = maximumPaidQuantity(remaining, offer);
    if (item.qty + gift > remaining) {
      return {
        kind: 'exceeded',
        remaining,
        maxPaid,
        maxGift: giftQuantity(maxPaid, offer),
        gift,
      };
    }
    if (remaining <= (Number(variant.low_stock_threshold) || 0))
      return { kind: 'low', remaining, gift };
    return { kind: 'available', remaining, gift };
  }
  if (item.qty > remaining) return { kind: 'exceeded', remaining };
  if (remaining <= (Number(variant.low_stock_threshold) || 0)) return { kind: 'low', remaining };
  return { kind: 'available', remaining };
}
