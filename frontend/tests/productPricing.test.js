import test from 'node:test';
import assert from 'node:assert/strict';
import { variantSchema } from '../src/admin/components/productSchema.ts';
import { addCartItem, getCartTotal } from '../src/utils/cart.js';

const variant = {
  id: '00000000-0000-4000-8000-000000000001',
  sku: 'TEST-M',
  size: 'M',
  color_name: 'Black',
  color_hex: '#20231f',
  stock: 5,
  low_stock_threshold: 2,
  track_quantity: true,
  active: true,
};
test('blank and null variant prices inherit the product price instead of becoming free', () => {
  for (const price_override of [null, undefined, '', '  ']) {
    const saved = variantSchema.parse({ ...variant, price_override });
    assert.equal(saved.price_override, null);
    assert.equal(saved.price_override ?? 1200, 1200);
  }
  assert.equal(variantSchema.parse({ ...variant, price_override: 0 }).price_override, 0);
  assert.equal(
    variantSchema.parse({ ...variant, price_override: '1250.50' }).price_override,
    1250.5,
  );
  assert.equal(variantSchema.safeParse({ ...variant, price_override: -1 }).success, false);
});
test('adding the same variant refreshes an old cart price without losing its quantity', () => {
  const product = { id: 'hoodie', name: 'Hoodie', price: 0 };
  const existing = addCartItem([], product, 'M', 'Black');
  const updated = addCartItem(existing, { ...product, price: 1200 }, 'M', 'Black');
  assert.equal(updated[0].qty, 2);
  assert.equal(getCartTotal(updated), 2400);
  assert.equal(existing[0].price, 0);
});
