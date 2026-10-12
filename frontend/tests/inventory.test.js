import assert from 'node:assert/strict';
import test from 'node:test';
import { groupInventoryVariants, summarizeInventory } from '../src/utils/inventory.ts';

const variant = (id, color_name, size, stock, extra = {}) => ({
  id,
  product_id: 'product-1',
  sku: `SKU-${id}`,
  color_name,
  color_hex: '#20231f',
  size,
  stock,
  low_stock_threshold: 5,
  track_quantity: true,
  active: true,
  ...extra,
});

test('inventory totals count active tracked sizes without mixing in inactive or untracked stock', () => {
  const variants = [
    variant('a', 'Black', 'M', 12),
    variant('b', 'Black', 'L', 3),
    variant('c', 'Red', 'S', 0),
    variant('d', 'Red', 'M', 50, { active: false }),
    variant('e', 'Blue', 'XL', 0, { track_quantity: false }),
  ];
  assert.deepEqual(summarizeInventory(variants), {
    variants: 4,
    tracked: 3,
    untracked: 1,
    stock: 15,
    low: 1,
    out: 1,
  });
});

test('inventory groups active variants by color and orders sizes naturally', () => {
  const groups = groupInventoryVariants([
    variant('a', 'Red', 'XL', 3),
    variant('b', 'Black', 'L', 4),
    variant('c', 'Black', 'S', 8),
    variant('d', 'Red', 'M', 2),
    variant('e', 'Blue', 'XS', 2, { active: false }),
  ]);
  assert.deepEqual(
    groups.map((group) => group.color),
    ['Black', 'Red'],
  );
  assert.deepEqual(
    groups[0].variants.map((row) => row.size),
    ['S', 'L'],
  );
  assert.deepEqual(
    groups[1].variants.map((row) => row.size),
    ['M', 'XL'],
  );
});
