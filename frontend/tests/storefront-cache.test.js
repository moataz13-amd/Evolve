import assert from 'node:assert/strict';
import test from 'node:test';
import { readStorefrontCache, saveStorefrontCache } from '../src/utils/storefrontCache.js';

function memoryStorage() {
  const records = new Map();
  return {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  };
}
const content = {
  settings: { currency: 'USD' },
  categories: [],
  collections: [],
  faqs: [],
  banners: [],
  sections: [{ key: 'hero', homepage_content: [], homepage_products: [] }],
};

test('public homepage content is immediately available on refresh, isolated by project and expires', () => {
  const storage = memoryStorage();
  saveStorefrontCache(storage, 'project-one', content, 1000);
  assert.deepEqual(readStorefrontCache(storage, 'project-one', 2000), content);
  assert.equal(readStorefrontCache(storage, 'project-two', 2000), undefined);
  assert.equal(readStorefrontCache(storage, 'project-one', 1000 + 24 * 60 * 60 * 1000), undefined);
  saveStorefrontCache(storage, 'project-one', { settings: {} }, 2000);
  assert.deepEqual(readStorefrontCache(storage, 'project-one', 3000), content);
});

test('malformed and unavailable browser storage never prevent homepage rendering', () => {
  assert.equal(readStorefrontCache({ getItem: () => '{invalid' }, 'project'), undefined);
  assert.equal(
    readStorefrontCache(
      {
        getItem: () => {
          throw Error('blocked');
        },
      },
      'project',
    ),
    undefined,
  );
  assert.doesNotThrow(() =>
    saveStorefrontCache(
      {
        setItem: () => {
          throw Error('full');
        },
      },
      'project',
      content,
    ),
  );
});
