import assert from 'node:assert/strict';
import test from 'node:test';
import { cartStockStatus } from '../src/utils/cartStock.js';

const item = { qty: 2 };
const tracked = { active: true, track_quantity: true, stock: 5, low_stock_threshold: 3 };

test('cart stock status distinguishes available, low, exceeded, and sold-out variants', () => {
  assert.deepEqual(cartStockStatus(item, tracked), { kind: 'available', remaining: 5 });
  assert.deepEqual(cartStockStatus(item, { ...tracked, stock: 3 }), { kind: 'low', remaining: 3 });
  assert.deepEqual(cartStockStatus(item, { ...tracked, stock: 1 }), {
    kind: 'exceeded',
    remaining: 1,
  });
  assert.deepEqual(cartStockStatus(item, { ...tracked, stock: 0 }), { kind: 'out', remaining: 0 });
  assert.deepEqual(cartStockStatus(item, { ...tracked, active: false }), {
    kind: 'out',
    remaining: 0,
  });
  assert.deepEqual(cartStockStatus(item, undefined), { kind: 'out', remaining: 0 });
});

test('cart stock status leaves untracked variants without a quantity limit', () => {
  assert.deepEqual(cartStockStatus(item, { ...tracked, stock: 0, track_quantity: false }), {
    kind: 'available',
    remaining: null,
  });
});
