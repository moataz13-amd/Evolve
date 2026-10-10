import { database } from '../lib/supabase';
import { throwIfError } from './admin.service';
export async function orderDetails(id: string) {
  return throwIfError(
    await database()
      .from('orders')
      .select('*,order_items(*),order_status_history(*),order_notes(*)')
      .eq('id', id)
      .single(),
  );
}
export async function updateOrder(id: string, status: string, payment: string, note: string) {
  return throwIfError(
    await database().rpc('update_order_status', {
      p_order: id,
      p_status: status,
      p_payment: payment,
      p_note: note,
    }),
  );
}
export async function createOrder(cart: any[], details: any, requestKey: string, promo: string) {
  return throwIfError(
    await database().rpc('create_order', {
      p_items: cart.map((item) => ({ variant_id: item.variantId, quantity: item.qty })),
      p_details: details,
      p_request_key: requestKey,
      p_promo: promo || null,
    }),
  );
}
