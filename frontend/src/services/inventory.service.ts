import { database, mediaUrl } from '../lib/supabase';
import { summarizeInventory, type InventoryStock, type InventoryVariant } from '../utils/inventory';
import { throwIfError } from './result';

export type InventoryProduct = {
  id: string;
  name: string;
  name_ar: string | null;
  active: boolean;
  archived: boolean;
  product_variants: InventoryVariant[];
  product_images: {
    external_url: string | null;
    display_order: number;
    media: { path: string } | null;
  }[];
};

export function inventoryImage(product: InventoryProduct): string {
  const image = [...product.product_images].sort((a, b) => a.display_order - b.display_order)[0];
  return image?.external_url || mediaUrl(image?.media?.path);
}

export async function listInventoryProducts(params: URLSearchParams) {
  const db = database();
  const filters = Object.fromEntries(params);
  const catalog = throwIfError(await db.rpc('admin_catalog', { p_filters: filters })) as {
    rows: Array<{
      id: string;
      name: string;
      category: string | null;
      image: string | null;
      active: boolean;
      archived: boolean;
    }>;
    count: number;
  };
  const ids = catalog.rows.map((row) => row.id);
  if (!ids.length) return { rows: [], count: catalog.count };
  const variants = throwIfError(
    await db
      .from('product_variants')
      .select('product_id,active,track_quantity,stock,low_stock_threshold')
      .in('product_id', ids),
  ) as InventoryStock[];
  const variantsByProduct = new Map<string, InventoryStock[]>();
  for (const variant of variants) {
    const rows = variantsByProduct.get(variant.product_id) || [];
    rows.push(variant);
    variantsByProduct.set(variant.product_id, rows);
  }
  return {
    count: catalog.count,
    rows: catalog.rows.map((row) => ({
      ...row,
      summary: summarizeInventory(variantsByProduct.get(row.id) || []),
    })),
  };
}

export async function inventoryProduct(id: string) {
  const db = database();
  const select =
    'id,name,name_ar,active,archived,product_variants(*),product_images(external_url,display_order,media(path))';
  let product = throwIfError(
    await db.from('products').select(select).eq('id', id).maybeSingle(),
  ) as InventoryProduct | null;
  let selectedVariantId: string | null = null;
  if (!product) {
    const variant = throwIfError(
      await db.from('product_variants').select('product_id').eq('id', id).maybeSingle(),
    );
    if (!variant) throw new Error('Product not found.');
    selectedVariantId = id;
    product = throwIfError(
      await db.from('products').select(select).eq('id', variant.product_id).single(),
    ) as InventoryProduct;
  }
  return { product, selectedVariantId };
}

export async function inventoryMovements(variantId: string) {
  return throwIfError(
    await database()
      .from('inventory_movements')
      .select('id,reason,delta,stock_after,created_at')
      .eq('variant_id', variantId)
      .order('created_at', { ascending: false })
      .limit(50),
  );
}

export async function adjustInventory(id: string, delta: number, reason: string) {
  return throwIfError(
    await database().rpc('adjust_inventory', { p_variant: id, p_delta: delta, p_reason: reason }),
  );
}
