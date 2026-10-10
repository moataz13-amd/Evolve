import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addVariantCombinations,
  catalogSlug,
  createVariant,
  productColorOptions,
  suggestedColorName,
  nextVariant,
} from '../src/utils/catalogEditor.js';

test('individual additions select an unused size and color rather than duplicating the default', () => {
  const rows = [createVariant()];
  for (let index = 0; index < 7; index++) rows.push(nextVariant(rows));
  assert.equal(new Set(rows.map((row) => `${row.size}:${row.color_name}`)).size, rows.length);
  assert.equal(new Set(rows.map((row) => row.sku)).size, rows.length);
});

test('automatic color names preserve existing shades and distinguish new shades of a named color', () => {
  const palette = productColorOptions([]);
  assert.equal(suggestedColorName('#D93636', palette), 'Red');
  assert.equal(suggestedColorName('#808000', palette), 'Olive');
  assert.equal(suggestedColorName('#000000', palette), 'Black 2');
  assert.equal(
    suggestedColorName('#000000', [...palette, { name: 'Black 2', hex: '#101010' }]),
    'Black 3',
  );
  assert.equal(
    suggestedColorName('#abcdef', [{ name: 'Custom shade', hex: '#abcdef' }]),
    'Custom shade',
  );
  assert.equal(suggestedColorName('invalid', palette), '');
});

test('saved custom colors stay available with their shades when adding further sizes', () => {
  const olive = createVariant('M', { name: 'Olive', hex: '#708238' }, 4);
  const black = createVariant('M', { name: 'black', hex: '#111111' }, 6);
  const palette = productColorOptions([olive, black, { ...olive, size: 'L' }]);
  assert.equal(palette.filter((color) => color.name.toLowerCase() === 'olive').length, 1);
  assert.equal(palette.find((color) => color.name.toLowerCase() === 'black').hex, '#111111');
  const expanded = addVariantCombinations(
    [olive],
    ['M', 'XL'],
    palette.filter((color) => color.name === 'Olive'),
    9,
  );
  assert.equal(expanded.length, 2);
  assert.equal(expanded[0], olive);
  assert.equal(expanded[1].color_hex, '#708238');
  assert.equal(expanded[1].stock, 9);
});

test('bulk sizes and colors add missing combinations without replacing stock, IDs or custom SKUs', () => {
  const original = { ...createVariant('M', { name: 'Black', hex: '#20231f' }, 7), sku: 'MY-SKU' };
  const colors = [
    { name: 'black', hex: '#20231f' },
    { name: 'White', hex: '#ffffff' },
  ];
  const rows = addVariantCombinations([original], ['M', 'L'], colors, 12);
  assert.equal(rows.length, 4);
  assert.equal(rows[0], original);
  assert.equal(rows[0].stock, 7);
  assert.equal(rows[0].sku, 'MY-SKU');
  assert.ok(rows.slice(1).every((row) => row.stock === 12));
  assert.equal(new Set(rows.map((row) => row.sku)).size, rows.length);
  assert.equal(addVariantCombinations(rows, ['M', 'L'], colors, 50).length, 4);
  assert.equal(original.stock, 7);
});

test('automatic slugs support Arabic-only names and distinguish identical product names', () => {
  const one = catalogSlug('بنطلون رياضي', 'aabbccdd-1234-4000-8000-000000000001');
  const two = catalogSlug('بنطلون رياضي', 'bbccddaa-1234-4000-8000-000000000001');
  assert.match(one, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.notEqual(one, two);
  assert.match(catalogSlug('Essential Tee', 'aabbccdd'), /^essential-tee-/);
});
