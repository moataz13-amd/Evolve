import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import { createUUID } from '../src/utils/uuid.js';

test('IDs remain valid and distinct when randomUUID is unavailable', () => {
  const cryptoApi = { getRandomValues: (bytes) => webcrypto.getRandomValues(bytes) };
  const ids = Array.from({ length: 256 }, () => createUUID(cryptoApi));
  for (const id of ids)
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(new Set(ids).size, ids.length);
});

test('native UUID generation is retained when available', () => {
  const id = '6baa5c40-669f-49a5-828a-4b4f7e104067';
  assert.equal(createUUID({ randomUUID: () => id }), id);
});

test('missing cryptographic support reports an error rather than issuing insecure IDs', () => {
  assert.throws(() => createUUID(null), /secure ID generation/);
});
