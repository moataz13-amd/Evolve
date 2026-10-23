import { database } from '../lib/supabase';
import type { Resource, Row } from '../types/admin';
import { throwIfError } from './result';
export const PAGE_SIZE = 20;
export async function listRecords(resource: Resource, params: URLSearchParams) {
  const page = Math.max(1, Number(params.get('page')) || 1);
  let query = database()
    .from(resource.table)
    .select(resource.table === 'offers' ? '*,offer_types(name,name_ar)' : '*', { count: 'exact' });
  const search = (params.get('q') || '')
    .trim()
    .replace(/[%_,().\\]/g, '')
    .slice(0, 100);
  if (resource.table === 'admin_orders' && /^#?\d+$/.test(search))
    query = query.eq('order_number', search.replace('#', ''));
  else if (search && resource.search.length)
    query = query.or(resource.search.map((key) => `${key}.ilike.%${search}%`).join(','));
  for (const field of resource.fields) {
    const value = params.get(field.key);
    if (value && (field.type === 'select' || field.type === 'checkbox'))
      query = query.eq(field.key, field.type === 'checkbox' ? value === 'true' : value);
  }
  const allowedSorts = [...resource.columns, 'created_at', 'display_order'];
  const sort = allowedSorts.includes(params.get('sort') || '')
    ? params.get('sort')!
    : resource.order || 'created_at';
  const result = await query
    .order(sort, { ascending: params.get('direction') === 'asc' || sort === 'display_order' })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    .overrideTypes<Row[], { merge: false }>();
  if (result.error) throw new Error(result.error.message);
  return { rows: result.data as Row[], count: result.count || 0, page };
}
export async function saveRecord(table: string, values: Record<string, unknown>, id?: string) {
  const query = id
    ? database().from(table).update(values).eq('id', id)
    : database().from(table).insert(values);
  return throwIfError(await query.select().single()) as Row;
}
export async function deleteRecord(table: string, id: string) {
  return throwIfError(await database().from(table).delete().eq('id', id).select('id').single());
}
export async function options(table: string) {
  return throwIfError(
    await database()
      .from(table)
      .select('*')
      .order(table === 'media' ? 'created_at' : table === 'homepage_sections' ? 'title' : 'name')
      .limit(200),
  ) as Row[];
}
