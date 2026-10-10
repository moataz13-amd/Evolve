export function readStoredValue(storage, key, fallback, validate = () => true) {
  try {
    const serializedValue = storage.getItem(key);
    if (serializedValue === null) return fallback;

    const value = JSON.parse(serializedValue);
    return validate(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredValue(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // The store remains usable in memory when browser storage is unavailable.
  }
}

export const storageKeys = {
  language: 'mavin-language',
  wishlist: 'mavin-wishlist',
  profile: 'mavin-profile',
  orders: 'mavin-orders',
  cart: 'mavin-cart',
};

export function isCart(value) {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item.key === 'string' &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.image === 'string' &&
        typeof item.price === 'number' &&
        Number.isFinite(item.price) &&
        item.price >= 0 &&
        Number.isInteger(item.qty) &&
        item.qty > 0,
    )
  );
}

export function isWishlist(value) {
  return Array.isArray(value) && value.every((id) => typeof id === 'string');
}

export function isProfile(value) {
  return (
    value === null ||
    (typeof value === 'object' && typeof value.name === 'string' && typeof value.email === 'string')
  );
}

export function isOrderHistory(value) {
  return (
    Array.isArray(value) &&
    value.every(
      (order) =>
        order &&
        typeof order.id === 'string' &&
        typeof order.total === 'number' &&
        isCart(order.items),
    )
  );
}
