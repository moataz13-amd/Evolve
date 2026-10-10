import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesProductTag, matchesCollection } from '../src/utils/catalogPlacement.js';
import { filterProducts, sortProducts } from '../src/utils/products.js';
import { productBadges } from '../src/utils/productBadge.js';

const item = {
  id: 'one',
  name: 'Tee',
  price: 1200,
  compareAtPrice: 1500,
  category: 'Gym wear',
  categorySlug: 'gym-wear',
  colors: ['Black'],
  sizes: ['M'],
  tag: 'BESTSELLER',
  tags: ['restock', 'coming-soon'],
  newArrival: true,
  bestSeller: true,
  featured: true,
  collections: ['core'],
};

test('a product can belong to new arrivals, best sellers, restocks and sale independently of its badge', () => {
  for (const tag of ['NEW', 'BESTSELLER', 'RESTOCK', 'COMING_SOON', 'SALE'])
    assert.equal(matchesProductTag(item, tag), true, tag);
  assert.equal(filterProducts([item], { category: 'gym-wear', tag: 'NEW' }).length, 1);
  assert.equal(
    matchesProductTag({ ...item, compareAtPrice: null, tags: ['SALE'] }, 'SALE'),
    false,
    'a label alone is not a discount',
  );
  assert.equal(productBadges(item)[0].variant, 'coming-soon');
});

test('manual and automatic collection membership use separate rules', () => {
  assert.equal(matchesCollection(item, { id: 'core', product_rule: 'manual' }), true);
  assert.equal(matchesCollection(item, { id: 'other', product_rule: 'manual' }), false);
  assert.equal(matchesCollection(item, { id: 'new', product_rule: 'NEW' }), true);
  assert.equal(
    matchesProductTag(
      { ...item, quantityOffers: [{ buy_quantity: 2, get_quantity: 1 }] },
      'BUY_2_GET_1',
    ),
    true,
  );
  assert.equal(
    matchesProductTag(
      { ...item, quantityOffers: [{ buy_quantity: 3, get_quantity: 1 }] },
      'BUY_2_GET_1',
    ),
    false,
  );
});

test('newest and featured sorts use actual creation dates and merchandising flags', () => {
  const newer = {
    ...item,
    id: 'two',
    createdAt: '2026-10-09',
    featured: false,
    newArrival: false,
    tag: '',
  };
  const older = { ...item, createdAt: '2026-10-01' };
  assert.equal(sortProducts([older, newer], 'new')[0].id, 'two');
  assert.equal(sortProducts([newer, older], 'featured')[0].id, 'one');
});
