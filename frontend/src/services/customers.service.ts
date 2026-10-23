import { database } from '../lib/supabase';
import { throwIfError } from './result';
export async function customerDetails(id: string) {
  return throwIfError(
    await database()
      .from('customers')
      .select(
        '*,customer_addresses(*),orders(id,order_number,total,status,payment_status,currency,created_at)',
      )
      .eq('id', id)
      .single(),
  );
}
