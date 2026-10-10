import { featuredLinks } from '../data/navigation.js';
import { filterProducts, sortProducts } from './products.js';
import { matchesCollection } from './catalogPlacement.js';

export const homepagePreviewSize = 8;

export function homepageEdits(data, isDemo = false) {
  const order = ['BESTSELLER', 'NEW', 'SALE', 'RESTOCK', 'COMING_SOON', 'ACCESSORIES'];
  const edits = order.map((tag) => {
    const link = featuredLinks.find(
      (item) => new URLSearchParams(item.to.split('?')[1]).get('tag') === tag,
    );
    return { key: `tag:${tag}`, ...link, criteria: { p_tag: tag } };
  });
  edits.push({
    key: 'tag:BUY_GET',
    label: 'Buy & Get Offers',
    arabicLabel: 'عروض اشتري وخد هدية',
    to: '/shop?tag=BUY_GET',
    criteria: { p_tag: 'BUY_GET' },
  });
  const categories = isDemo
    ? [
        { id: 'gym', name: 'Gym wear', name_ar: 'ملابس التدريب', slug: 'gym-wear' },
        { id: 'sweatpants', name: 'Sweatpants', name_ar: 'البناطيل الرياضية', slug: 'sweatpants' },
      ]
    : data?.categories || [];
  for (const category of categories) {
    if (category.active === false) continue;
    edits.push({
      key: `category:${category.id}`,
      label: category.name,
      arabicLabel: category.name_ar || category.name,
      to: `/categories/${category.slug}`,
      categoryName: category.name,
      criteria: { p_category: category.id },
    });
  }
  for (const collection of data?.collections || []) {
    if (
      collection.active === false ||
      edits.some((edit) => edit.criteria.p_tag === collection.product_rule)
    )
      continue;
    edits.push({
      key: `collection:${collection.id}`,
      label: collection.name,
      arabicLabel: collection.name_ar || collection.name,
      to: `/collections/${collection.slug}`,
      collection,
      criteria: { p_collection: collection.id },
    });
  }
  return edits;
}

export function demoHomepageEdit(products, edit) {
  const scoped = edit.collection
    ? products.filter((product) => matchesCollection(product, edit.collection))
    : products;
  return sortProducts(
    filterProducts(scoped, { tag: edit.criteria.p_tag, category: edit.categoryName }),
    edit.criteria.p_tag === 'NEW' ? 'new' : 'featured',
  ).slice(0, homepagePreviewSize);
}
