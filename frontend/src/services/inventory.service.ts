import { database } from '../lib/supabase';
import { throwIfError } from './admin.service';
export async function adjustInventory(id: string, delta: number, reason: string) {
  return throwIfError(
    await database().rpc('adjust_inventory', { p_variant: id, p_delta: delta, p_reason: reason }),
  );
}
export async function variantDetails(id: string) {
  const db = database();
  const [variant, movements] = await Promise.all([
    db.from('product_variants').select('*,products(name)').eq('id', id).single(),
    db
      .from('inventory_movements')
      .select('*')
      .eq('variant_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  return { variant: throwIfError(variant), movements: throwIfError(movements) };
}
