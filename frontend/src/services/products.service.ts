import { createUUID } from '../utils/uuid';
import { database, mediaUrl } from '../lib/supabase';
import { throwIfError } from './admin.service';
import type { ProductRecord } from '../types/catalog';
import { offerPrice, liveQuantityOffers, quantityOfferLabel } from '../utils/offers';
export const productSelect =
  '*,categories(name,slug),og_image:media(path),product_variants(*),product_images(*,media(path)),product_collections(collection_id),offer_products(offers(*))';
export async function getProduct(id: string) {
  return throwIfError(
    await database()
      .from('products')
      .select(productSelect + ',product_costs(cost)')
      .eq('id', id)
      .single(),
  ) as unknown as ProductRecord;
}
export async function storefrontProduct(id: string) {
  const column = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) ? 'id' : 'slug';
  const row = throwIfError(
    await database()
      .from('products')
      .select(productSelect)
      .eq(column, id)
      .eq('active', true)
      .eq('archived', false)
      .maybeSingle(),
  );
  return row ? toStoreProduct(row) : null;
}
export async function saveProduct(values: any) {
  return throwIfError(
    await database().rpc('save_product', {
      p_id: values.id || null,
      p_product: values.product,
      p_variants: values.variants,
      p_images: values.images,
      p_collections: values.collections,
      p_cost: values.cost ?? null,
    }),
  );
}
export async function duplicateProduct(id: string) {
  const source = await getProduct(id);
  const uuid = createUUID();
  return saveProduct({
    product: {
      ...source,
      name: source.name + ' (copy)',
      slug: source.slug + '-copy-' + uuid.slice(0, 8),
      active: false,
    },
    variants: source.product_variants.map((variant: any) => ({
      ...variant,
      id: createUUID(),
      sku: variant.sku + '-' + uuid.slice(0, 6),
      stock: 0,
    })),
    images: source.product_images,
    collections: source.product_collections.map((link: any) => link.collection_id),
    cost: source.product_costs?.cost ?? null,
  });
}
export function toStoreProduct(row: any) {
  const offers = (row.offer_products || []).map((link: any) => link.offers).filter(Boolean);
  const pricing = offerPrice(row.price, offers);
  const quantityOffers = liveQuantityOffers(offers);
  const visibleOffer = pricing.offer || quantityOffers.find((offer: any) => offer.show_badge);
  const variants = row.product_variants
    .filter((v: any) => v.active)
    .map((variant: any) => {
      const base = Number(variant.price_override ?? row.price);
      const current = offerPrice(base, offers);
      return {
        ...variant,
        price_override: current.price,
        compare_at_price: current.offer ? base : row.compare_at_price,
      };
    });
  const images = [...row.product_images]
    .sort((a: any, b: any) => a.display_order - b.display_order)
    .map((i: any) => ({
      url: i.external_url || mediaUrl(i.media?.path),
      color: i.color_name,
      alt: i.alt,
    }));
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    ar: row.name_ar || row.name,
    description: row.description,
    descriptionAr: row.description_ar,
    price: pricing.price,
    compareAtPrice: pricing.offer ? Number(row.price) : row.compare_at_price,
    quantityOffers,
    discountOffer: pricing.offer,
    offerBadge: visibleOffer?.show_badge
      ? {
          label:
            visibleOffer.badge_label ||
            (visibleOffer.discount_type === 'buy_get' ? quantityOfferLabel(visibleOffer) : 'Offer'),
          arabicLabel:
            visibleOffer.badge_label_ar ||
            visibleOffer.badge_label ||
            (visibleOffer.discount_type === 'buy_get'
              ? quantityOfferLabel(visibleOffer, true)
              : 'عرض'),
          variant: visibleOffer.badge_variant || 'sale',
        }
      : null,
    category: row.categories?.name || 'Essentials',
    categorySlug: row.categories?.slug,
    type: row.product_type,
    tag: row.best_seller
      ? 'BESTSELLER'
      : row.new_arrival
        ? 'NEW'
        : !pricing.offer && row.compare_at_price > row.price
          ? 'SALE'
          : row.tags?.find((tag: string) => ['RESTOCK', 'COMING_SOON'].includes(tag)) || '',
    image: images[0]?.url || '',
    images,
    colors: [...new Set(variants.map((v: any) => v.color_name))],
    colorValues: Object.fromEntries(variants.map((v: any) => [v.color_name, v.color_hex])),
    sizes: [
      ...new Set(
        variants.filter((v: any) => !v.track_quantity || v.stock > 0).map((v: any) => v.size),
      ),
    ],
    variants,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    ogImage: mediaUrl(row.og_image?.path),
    featured: row.featured,
    newArrival: row.new_arrival,
    bestSeller: row.best_seller,
    tags: row.tags || [],
    createdAt: row.created_at,
    badgeMode: row.badge_mode || 'auto',
    badgeLabel: row.badge_label,
    badgeLabelAr: row.badge_label_ar,
    badgeVariant: row.badge_variant,
    collections: row.product_collections.map((c: any) => c.collection_id),
  };
}
