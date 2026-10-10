import { database } from '../lib/supabase';
import { throwIfError } from './admin.service';
import { productSelect, toStoreProduct } from './products.service';
export async function storefrontOffers() {
  const now = new Date().toISOString();
  return (
    throwIfError(
      await database()
        .from('offers')
        .select(
          'id,name,active,discount_type,discount_value,buy_quantity,get_quantity,starts_at,ends_at,offer_products(products(id,active,archived,tags))',
        )
        .eq('active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .order('created_at', { ascending: false }),
    ) || []
  );
}
export async function storefrontContent() {
  const db = database();
  const [categories, collections, sections, faqs, settings, banners] = await Promise.all([
    db.from('categories').select('*,media(path)').eq('active', true).order('display_order'),
    db.from('collections').select('*,media(path)').eq('active', true).order('display_order'),
    db
      .from('homepage_sections')
      .select('*,homepage_content(*,media(path)),homepage_products(product_id,display_order)')
      .eq('active', true)
      .eq('published', true)
      .order('display_order'),
    db.from('faqs').select('*').eq('active', true).order('display_order'),
    db.from('site_settings').select('*').single(),
    db.from('banners').select('*,media(path)').eq('active', true).order('display_order'),
  ]);
  return {
    categories: throwIfError(categories),
    collections: throwIfError(collections),
    sections: throwIfError(sections),
    faqs: throwIfError(faqs),
    settings: throwIfError(settings),
    banners: throwIfError(banners),
  };
}
export async function catalogPage(page: number) {
  return (
    throwIfError(
      await database()
        .from('products')
        .select(productSelect)
        .eq('active', true)
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .range(page * 24, page * 24 + 23),
    ) || []
  ).map(toStoreProduct);
}
export async function searchCatalog(filters: Record<string, unknown>, page: number) {
  const result = throwIfError(await database().rpc('search_catalog', { ...filters, p_page: page }));
  if (!result.ids.length)
    return { products: [], count: Number(result.count), facets: result.facets };
  const rows =
    throwIfError(await database().from('products').select(productSelect).in('id', result.ids)) ||
    [];
  return {
    products: result.ids
      .map((id: string) => rows.find((row) => row.id === id))
      .filter(Boolean)
      .map(toStoreProduct),
    count: Number(result.count),
    facets: result.facets,
  };
}
export async function homepageCatalogEdits(
  edits: { key: string; criteria: Record<string, unknown> }[],
  previewSize = 4,
) {
  // Resolve every section against the complete catalog, then fetch shared cards once.
  const db = database();
  const pages = await Promise.all(
    edits.map(async (edit) => {
      const result = throwIfError(
        await db.rpc('search_catalog', {
          ...edit.criteria,
          p_page: 0,
          p_sort: edit.criteria.p_tag === 'NEW' ? 'new' : 'featured',
        }),
      );
      return { key: edit.key, ids: result.ids.slice(0, previewSize) as string[] };
    }),
  );
  const ids = [...new Set(pages.flatMap((page) => page.ids))];
  if (!ids.length) return pages.map((page) => ({ key: page.key, products: [] }));
  const rows =
    throwIfError(
      await db
        .from('products')
        .select(productSelect)
        .in('id', ids)
        .eq('active', true)
        .eq('archived', false),
    ) || [];
  const products = new Map(rows.map((row) => [row.id, toStoreProduct(row)]));
  return pages.map((page) => ({
    key: page.key,
    products: page.ids.map((id) => products.get(id)).filter(Boolean),
  }));
}
export async function curatedProducts(ids: string[], collectionId?: string) {
  // An explicitly configured homepage collection must keep its own product scope.
  if (collectionId)
    return (await searchCatalog({ p_collection: collectionId, p_sort: 'featured' }, 0)).products;
  const featured =
    throwIfError(
      await database()
        .from('products')
        .select(productSelect)
        .eq('active', true)
        .eq('archived', false)
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(24),
    ) || [];
  if (!ids.length && featured.length) return featured.map(toStoreProduct);
  if (!ids.length)
    return (
      await searchCatalog({ p_collection: collectionId || null, p_sort: 'featured' }, 0)
    ).products.slice(0, 4);
  const rows =
    throwIfError(
      await database()
        .from('products')
        .select(productSelect)
        .in('id', ids)
        .eq('active', true)
        .eq('archived', false),
    ) || [];
  const selected = ids.map((id) => rows.find((row) => row.id === id)).filter(Boolean);
  return [...featured, ...selected.filter((row) => !featured.some((item) => item.id === row.id))]
    .slice(0, 24)
    .map(toStoreProduct);
}
