export function getCartCount(cart) {
  return cart.reduce((count, item) => count + item.qty, 0);
}

export function getCartTotal(cart) {
  return cart.reduce((total, item) => total + item.price * item.qty, 0);
}

export function addCartItem(cart, product, size, color) {
  const key = `${product.id}-${size}-${color}`;
  const existingItem = cart.find((item) => item.key === key);

  if (existingItem) {
    return cart.map((item) =>
      item.key === key ? { ...item, ...product, key, size, color, qty: item.qty + 1 } : item,
    );
  }

  return [...cart, { ...product, key, size, color, qty: 1 }];
}

export function updateCartQuantity(cart, key, quantity) {
  if (!Number.isInteger(quantity)) return cart;

  return cart.map((item) => (item.key === key ? { ...item, qty: Math.max(1, quantity) } : item));
}

export function removeCartItem(cart, key) {
  return cart.filter((item) => item.key !== key);
}

export function createDemoOrder(cart) {
  return {
    id: Date.now().toString(36).toUpperCase(),
    items: cart.map((item) => ({ ...item })),
    total: getCartTotal(cart),
    date: new Date().toISOString(),
  };
}
