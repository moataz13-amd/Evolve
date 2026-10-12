export type InventoryVariant = {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  color_name: string;
  color_hex: string;
  stock: number;
  low_stock_threshold: number;
  track_quantity: boolean;
  active: boolean;
};

export type InventorySummary = {
  variants: number;
  tracked: number;
  untracked: number;
  stock: number;
  low: number;
  out: number;
};

export type InventoryStock = Pick<
  InventoryVariant,
  'product_id' | 'active' | 'track_quantity' | 'stock' | 'low_stock_threshold'
>;

export function summarizeInventory(variants: InventoryStock[]): InventorySummary {
  const active = variants.filter((variant) => variant.active);
  const tracked = active.filter((variant) => variant.track_quantity);
  return {
    variants: active.length,
    tracked: tracked.length,
    untracked: active.length - tracked.length,
    stock: tracked.reduce((total, variant) => total + variant.stock, 0),
    low: tracked.filter(
      (variant) => variant.stock > 0 && variant.stock <= variant.low_stock_threshold,
    ).length,
    out: tracked.filter((variant) => variant.stock === 0).length,
  };
}

const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export function groupInventoryVariants(variants: InventoryVariant[]) {
  const groups = new Map<string, InventoryVariant[]>();
  for (const variant of variants.filter((row) => row.active)) {
    const group = groups.get(variant.color_name) || [];
    group.push(variant);
    groups.set(variant.color_name, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([color, rows]) => ({
      color,
      hex: rows[0].color_hex,
      variants: rows.sort((a, b) => sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size)),
    }));
}
