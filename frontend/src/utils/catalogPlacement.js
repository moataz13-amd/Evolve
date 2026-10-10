// Merchandising flags are independent of the single visual badge on a card.
export function normalizeCatalogTag(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

export function matchesProductTag(product, tag) {
  const key = normalizeCatalogTag(tag);
  const tags = (product.tags || [product.tag]).map(normalizeCatalogTag);
  if (!key) return true;
  if (key === 'NEW')
    return product.newArrival !== undefined ? !!product.newArrival : tags.includes(key);
  if (key === 'BESTSELLER')
    return product.bestSeller !== undefined ? !!product.bestSeller : tags.includes(key);
  if (key === 'SALE') return Number(product.compareAtPrice) > Number(product.price);
  if (key === 'RESTOCK') return tags.includes(key) && (product.sizes || []).length > 0;
  if (key === 'BUY_GET' || key === 'BUY_2_GET_1')
    return (product.quantityOffers || []).some(
      (offer) =>
        key === 'BUY_GET' || (Number(offer.buy_quantity) === 2 && Number(offer.get_quantity) === 1),
    );
  if (key === 'ACCESSORIES')
    return (
      tags.includes(key) ||
      [product.type, product.category, product.categorySlug].some(
        (value) => normalizeCatalogTag(value) === key,
      )
    );
  return tags.includes(key);
}

export function matchesCollection(product, collection) {
  return collection.product_rule && collection.product_rule !== 'manual'
    ? matchesProductTag(product, collection.product_rule)
    : (product.collections || []).includes(collection.id);
}
