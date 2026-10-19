import assert from 'node:assert/strict';
import test from 'node:test';
import { cartStockStatus, giftQuantity, maximumPaidQuantity } from '../src/utils/cartStock.js';

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

test('buy two get one counts gifts inside the same 1200-piece stock', () => {
  const offer = { buy_quantity: 2, get_quantity: 1 };
  const inventory = { ...tracked, stock: 1200 };
  assert.equal(giftQuantity(800, offer), 400);
  assert.equal(maximumPaidQuantity(1200, offer), 800);
  assert.deepEqual(cartStockStatus({ qty: 800 }, inventory, offer), {
    kind: 'available',
    remaining: 1200,
    gift: 400,
  });
  assert.deepEqual(cartStockStatus({ qty: 1200 }, inventory, offer), {
    kind: 'exceeded',
    remaining: 1200,
    maxPaid: 800,
    maxGift: 400,
    gift: 600,
  });
});

test('gift stock calculation handles incomplete groups and other ratios', () => {
  const offer = { buy_quantity: 2, get_quantity: 1 };
  assert.equal(maximumPaidQuantity(2, offer), 1);
  assert.equal(maximumPaidQuantity(5, offer), 3);
  assert.equal(giftQuantity(3, offer), 1);
  assert.equal(maximumPaidQuantity(10, { buy_quantity: 3, get_quantity: 2 }), 6);
  assert.equal(giftQuantity(6, { buy_quantity: 3, get_quantity: 2 }), 4);
});
