import assert from 'node:assert/strict';
import test from 'node:test';
import { products } from '../src/data/products.js';
import {
  addCartItem,
  createDemoOrder,
  getCartCount,
  getCartTotal,
  removeCartItem,
  updateCartQuantity,
} from '../src/utils/cart.js';
import { filterProducts, sortProducts } from '../src/utils/products.js';
import { isCart, isOrderHistory, readStoredValue, writeStoredValue } from '../src/utils/storage.js';

const product = products[0];

test('navigation filters show only the requested product type or featured tag', () => {
  assert.deepEqual(
    filterProducts(products, { type: 'Hoodies' }).map((item) => item.id),
    ['heavyweight-hoodie'],
  );
  assert.equal(filterProducts(products, { tag: 'BESTSELLER' }).length, 2);
  assert.equal(filterProducts(products, { tag: 'NEW' }).length, 2);
  assert.equal(filterProducts(products, { tag: 'SALE' }).length, 0);
  assert.equal(filterProducts(products, { type: 'Compressions' }).length, 0);
});

test('repeated additions merge only the same product, size, and color', () => {
  let cart = addCartItem([], product, 'M', 'Black');
  cart = addCartItem(cart, product, 'M', 'Black');
  cart = addCartItem(cart, product, 'L', 'Black');
  cart = addCartItem(cart, product, 'M', 'Stone');

  assert.equal(cart.length, 3);
  assert.equal(cart[0].qty, 2);
  assert.equal(getCartCount(cart), 4);
  assert.equal(getCartTotal(cart), product.price * 4);
});

test('quantity changes and removals preserve other variants and the original cart', () => {
  const original = addCartItem(addCartItem([], product, 'M', 'Black'), product, 'L', 'Black');
  const updated = updateCartQuantity(original, original[0].key, 3);
  assert.equal(original[0].qty, 1);
  assert.equal(updated[0].qty, 3);
  assert.equal(updated[1].qty, 1);
  assert.equal(updateCartQuantity(updated, updated[0].key, 0)[0].qty, 1);
  assert.deepEqual(removeCartItem(updated, updated[0].key), [updated[1]]);
});

test('demo orders calculate their own total and keep a snapshot of the items', () => {
  const cart = addCartItem([], product, 'M', 'Black');
  const order = createDemoOrder(cart);
  cart[0].qty = 10;
  assert.equal(order.items[0].qty, 1);
  assert.equal(order.total, product.price);
  assert.ok(order.id);
  assert.ok(isOrderHistory([order]));
});

test('product filters combine category, size, color, price, and localized search', () => {
  const matches = filterProducts(products, {
    category: 'Gym wear',
    size: 'M',
    color: 'Black',
    maxPrice: 40,
    query: 'تيشيرت',
  });
  assert.deepEqual(
    matches.map((item) => item.id),
    ['essential-tee'],
  );
  assert.equal(filterProducts(products, { query: 'not-a-product' }).length, 0);
  assert.equal(filterProducts(products, { query: '  PERFORMANCE  ' })[0].id, 'essential-tee');
});

test('sorting preserves catalog order and handles price and new arrivals', () => {
  const originalOrder = products.map((item) => item.id);
  const ascending = sortProducts(products, 'low');
  const descending = sortProducts(products, 'high');
  assert.equal(ascending[0].price, 32);
  assert.equal(descending[0].price, 85);
  assert.equal(sortProducts(products, 'new')[0].tag, 'NEW');
  assert.deepEqual(
    products.map((item) => item.id),
    originalOrder,
  );
});

test('storage falls back safely for malformed JSON, invalid shapes, and blocked access', () => {
  const storage = { getItem: () => '{invalid JSON' };
  assert.deepEqual(readStoredValue(storage, 'cart', [], isCart), []);
  storage.getItem = () => JSON.stringify([{ qty: -1 }]);
  assert.deepEqual(readStoredValue(storage, 'cart', [], isCart), []);
  storage.getItem = () => {
    throw new Error('Blocked');
  };
  assert.deepEqual(readStoredValue(storage, 'cart', [], isCart), []);
  assert.doesNotThrow(() =>
    writeStoredValue(
      {
        setItem: () => {
          throw new Error('Full');
        },
      },
      'cart',
      [],
    ),
  );
});

test('valid persisted carts survive a serialization round trip', () => {
  const cart = addCartItem([], product, 'XL', 'Stone');
  let storedValue = null;
  const storage = {
    setItem: (_key, value) => {
      storedValue = value;
    },
    getItem: () => storedValue,
  };
  writeStoredValue(storage, 'cart', cart);
  assert.deepEqual(readStoredValue(storage, 'cart', [], isCart), cart);
});
