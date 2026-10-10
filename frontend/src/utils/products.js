import { matchesProductTag } from './catalogPlacement.js';

const sortComparators = {
  low: (first, second) => first.price - second.price,
  high: (first, second) => second.price - first.price,
  new: (first, second) =>
    Date.parse(second.createdAt || 0) - Date.parse(first.createdAt || 0) ||
    Number(matchesProductTag(second, 'NEW')) - Number(matchesProductTag(first, 'NEW')),
  featured: (first, second) => Number(!!second.featured) - Number(!!first.featured),
};

export function filterProducts(products, filters) {
  const {
    category = '',
    type = '',
    tag = '',
    size = '',
    color = '',
    maxPrice = Infinity,
    query = '',
  } = filters;
  const searchQuery = query.trim().toLowerCase();

  return products.filter((product) => {
    const searchableText = `${product.name} ${product.ar} ${product.category}`.toLowerCase();

    return (
      (!category || product.category === category || product.categorySlug === category) &&
      (!type || product.type === type) &&
      matchesProductTag(product, tag) &&
      (!size || product.sizes.includes(size)) &&
      (!color || product.colors.includes(color)) &&
      product.price <= maxPrice &&
      (!searchQuery || searchableText.includes(searchQuery))
    );
  });
}

export function sortProducts(products, sortOrder = 'featured') {
  const comparator = sortComparators[sortOrder];
  return comparator ? [...products].sort(comparator) : [...products];
}
