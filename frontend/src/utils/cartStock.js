export function cartStockStatus(item, variant) {
  if (!variant || !variant.active) return { kind: 'out', remaining: 0 };
  if (!variant.track_quantity) return { kind: 'available', remaining: null };

  const remaining = Math.max(0, Number(variant.stock) || 0);
  if (remaining === 0) return { kind: 'out', remaining };
  if (item.qty > remaining) return { kind: 'exceeded', remaining };
  if (remaining <= (Number(variant.low_stock_threshold) || 0)) return { kind: 'low', remaining };
  return { kind: 'available', remaining };
}
