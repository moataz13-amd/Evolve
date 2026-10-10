import test from 'node:test';
import assert from 'node:assert/strict';
import {
  homepageEdits,
  demoHomepageEdit,
  homepagePreviewSize,
} from '../src/utils/homepageEdits.js';

test('homepage edits cover menu tags and keep categories and manual collections separate', () => {
  const edits = homepageEdits({
    categories: [
      { id: 'cat', name: 'Training', slug: 'training', active: true },
      { id: 'off', name: 'Hidden', slug: 'hidden', active: false },
    ],
    collections: [
      {
        id: 'manual',
        name: 'Training edit',
        slug: 'training',
        product_rule: 'manual',
        active: true,
      },
      { id: 'new', name: 'New Arrivals', slug: 'new-arrivals', product_rule: 'NEW', active: true },
    ],
  });
  assert.deepEqual(
    edits.filter((edit) => edit.key.startsWith('tag:')).map((edit) => edit.criteria.p_tag),
    ['BESTSELLER', 'NEW', 'SALE', 'RESTOCK', 'COMING_SOON', 'ACCESSORIES', 'BUY_GET'],
  );
  assert.equal(edits.find((edit) => edit.key === 'category:cat').to, '/categories/training');
  assert.equal(edits.find((edit) => edit.key === 'collection:manual').to, '/collections/training');
  assert.ok(
    !edits.some((edit) => edit.key === 'category:off' || edit.key === 'collection:new'),
    'hide inactive categories and avoid duplicate automatic sections',
  );
  assert.equal(new Set(edits.map((edit) => edit.key)).size, edits.length);
});

test('a product can appear in both homepage new arrivals and best sellers without changing its card badge', () => {
  const product = {
    id: 'one',
    name: 'Tee',
    category: 'Gym wear',
    price: 1200,
    sizes: ['M'],
    colors: ['Black'],
    newArrival: true,
    bestSeller: true,
    tag: 'BESTSELLER',
  };
  const edits = homepageEdits(null, true);
  for (const tag of ['NEW', 'BESTSELLER'])
    assert.deepEqual(
      demoHomepageEdit(
        [product],
        edits.find((edit) => edit.criteria.p_tag === tag),
      ),
      [product],
    );
  assert.deepEqual(
    demoHomepageEdit(
      [product],
      edits.find((edit) => edit.criteria.p_tag === 'SALE'),
    ),
    [],
  );
});

test('homepage previews remain bounded and preserve the destination category', () => {
  const edit = homepageEdits(null, true).find((value) => value.categoryName === 'Gym wear');
  const products = Array.from({ length: 16 }, (_, index) => ({
    id: String(index),
    name: 'Tee',
    category: index === 0 ? 'Sweatpants' : 'Gym wear',
    price: 1200,
    sizes: ['M'],
    colors: ['Black'],
  }));
  const shown = demoHomepageEdit(products, edit);
  assert.equal(shown.length, homepagePreviewSize);
  assert.ok(shown.every((product) => product.category === 'Gym wear'));
});
