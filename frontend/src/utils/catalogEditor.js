import { createUUID } from './uuid.js';

export const clothingSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const clothingColors = [
  { name: 'Black', hex: '#20231f' },
  { name: 'Charcoal', hex: '#50514d' },
  { name: 'White', hex: '#f7f7f2' },
  { name: 'Navy', hex: '#202d45' },
  { name: 'Red', hex: '#d93636' },
];

const namedShades = [
  ['Black', '#000000'],
  ['Charcoal', '#36454f'],
  ['Gray', '#808080'],
  ['Silver', '#c0c0c0'],
  ['White', '#ffffff'],
  ['Ivory', '#fffff0'],
  ['Beige', '#d9c5a2'],
  ['Brown', '#8b4513'],
  ['Burgundy', '#800020'],
  ['Red', '#ff0000'],
  ['Coral', '#ff7f50'],
  ['Orange', '#ff8c00'],
  ['Gold', '#daa520'],
  ['Yellow', '#ffff00'],
  ['Olive', '#808000'],
  ['Green', '#008000'],
  ['Lime', '#80ff00'],
  ['Mint', '#98e0b0'],
  ['Teal', '#008080'],
  ['Cyan', '#00ffff'],
  ['Sky Blue', '#87ceeb'],
  ['Blue', '#2176ae'],
  ['Royal Blue', '#4169e1'],
  ['Navy', '#000080'],
  ['Purple', '#800080'],
  ['Lavender', '#b8a3dc'],
  ['Pink', '#ffc0cb'],
  ['Magenta', '#ff00ff'],
];

// Local, approximate shade names; exact existing shades keep their saved names.
export function suggestedColorName(hex, palette = []) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '';
  const matching = palette.find((color) => color.hex.toLowerCase() === hex.toLowerCase());
  if (matching) return matching.name;
  const rgb = (value) => [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16));
  const input = rgb(hex);
  const distance = (value) =>
    rgb(value).reduce((total, channel, index) => total + (channel - input[index]) ** 2, 0);
  const closest = namedShades.reduce((best, shade) =>
    distance(shade[1]) < distance(best[1]) ? shade : best,
  );
  const existingNames = new Set(palette.map((color) => color.name.trim().toLowerCase()));
  let name = closest[0];
  let suffix = 2;
  while (existingNames.has(name.toLowerCase())) name = `${closest[0]} ${suffix++}`;
  return name;
}

export function productColorOptions(variants) {
  const palette = new Map(clothingColors.map((color) => [color.name.toLowerCase(), color]));
  for (const variant of variants) {
    const name = variant.color_name.trim();
    if (name) palette.set(name.toLowerCase(), { name, hex: variant.color_hex });
  }
  return [...palette.values()];
}

export function catalogSlug(name, token) {
  const base = String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
    .replace(/-$/, '');
  return `${base || 'item'}-${token.replaceAll('-', '').slice(0, 8)}`;
}

export function createVariant(size = 'M', color = clothingColors[0], stock = 0) {
  const id = createUUID();
  return {
    id,
    sku: `EV-${id.replaceAll('-', '').toUpperCase()}`,
    size,
    color_name: color.name,
    color_hex: color.hex,
    stock,
    low_stock_threshold: 5,
    track_quantity: true,
    price_override: '',
    active: true,
  };
}

export function addVariantCombinations(existing, sizes, colors, stock) {
  const result = [...existing];
  for (const size of sizes) {
    for (const color of colors) {
      const present = result.some(
        (row) =>
          row.size === size &&
          row.color_name.trim().toLowerCase() === color.name.trim().toLowerCase(),
      );
      if (!present) result.push(createVariant(size, color, stock));
    }
  }
  return result;
}

export function nextVariant(existing) {
  const sizes = ['M', ...clothingSizes.filter((size) => size !== 'M')];
  for (const size of sizes) {
    for (const color of productColorOptions(existing)) {
      if (
        !existing.some(
          (row) =>
            row.size === size && row.color_name.trim().toLowerCase() === color.name.toLowerCase(),
        )
      )
        return createVariant(size, color);
    }
  }
  return null;
}
