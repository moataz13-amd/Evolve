import { database } from '../lib/supabase';
import { throwIfError } from './admin.service';
export async function exportSubscribers() {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ;) {
    const result = await database()
      .from('newsletter_subscribers')
      .select('id,email,status,created_at', { count: 'exact' })
      .order('created_at')
      .order('id')
      .range(offset, offset + 999);
    const page = throwIfError(result) || [];
    rows.push(...page);
    offset += page.length;
    if (!page.length || offset >= (result.count ?? offset)) return rows;
  }
}
