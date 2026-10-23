import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSafeStorefrontPath,
  safeSocialUrl,
  safeStorefrontPath,
} from '../src/utils/storefrontLinks.js';

test('CMS buttons accept local store paths and reject external or obfuscated redirects', () => {
  for (const path of ['/', '/shop', '/categories/gym-wear', '/shop?offer=123'])
    assert.equal(isSafeStorefrontPath(path), true);
  for (const path of [
    '//evil.test',
    '/\\evil.test',
    '/%2fevil.test',
    '/%5cevil.test',
    '/shop\nother',
    'https://evil.test',
  ]) {
    assert.equal(isSafeStorefrontPath(path), false);
    assert.equal(safeStorefrontPath(path, '/about'), '/about');
  }
});

test('social links stay on the selected HTTPS platform', () => {
  assert.equal(
    safeSocialUrl('https://www.instagram.com/evolve/', 'instagram'),
    'https://www.instagram.com/evolve/',
  );
  assert.equal(
    safeSocialUrl('https://facebook.com/evolve', 'facebook'),
    'https://facebook.com/evolve',
  );
  for (const url of [
    'https://instagram.com.evil.test/evolve',
    'https://instagram.com@evil.test/evolve',
    'http://instagram.com/evolve',
    'javascript:alert(1)',
  ])
    assert.equal(safeSocialUrl(url, 'instagram'), null);
});
