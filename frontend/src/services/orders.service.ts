import { database } from '../lib/supabase';
import { throwIfError } from './result';
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
  const db = database();
  const { data: auth, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw sessionError;
  let session = auth.session;
  if (!session) {
    const { data, error } = await db.auth.signInAnonymously();
    if (error) throw error;
    session = data.session;
  }
  if (!session) throw new Error('Unable to start guest checkout. Please try again.');
  if (session.user.is_anonymous) {
    throwIfError(
      await db.rpc('prepare_guest_checkout', {
        p_name: details.name,
        p_email: details.email,
      }),
    );
  }
  return throwIfError(
    await db.rpc('create_order', {
      p_items: cart.map((item) => ({ variant_id: item.variantId, quantity: item.qty })),
      p_details: details,
      p_request_key: requestKey,
      p_promo: promo || null,
    }),
  );
}
