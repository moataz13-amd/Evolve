import { useContent } from '../context/ContentContext';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { searchCatalog } from '../services/content.service';
import { filterProducts, sortProducts } from '../utils/products';

export const defaultMaxPrice = 100;
export function useProductFilters(fixedCategory, fixedCollection, fixedTag) {
  const {
    products,
    data,
    isDemo,
    loading: contentLoading,
    error: contentError,
    retry: retryContent,
  } = useContent();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSize = searchParams.get('size') || '';
  const selectedColor = searchParams.get('color') || '';
  const priceParam = searchParams.get('maxPrice');
  const priceLimit =
    priceParam !== null && Number.isFinite(Number(priceParam)) && Number(priceParam) >= 0
      ? Number(priceParam)
      : null;
  const category = fixedCategory || searchParams.get('category') || '';
  const collection = fixedCollection || searchParams.get('collection') || '';
  const sortOrder = searchParams.get('sort') || 'featured';
  const searchQuery = searchParams.get('q') || '';
  const productType = searchParams.get('type') || '';
  const productTag = fixedTag || searchParams.get('tag') || '';
  const offerId = searchParams.get('offer') || '';
  const categoryRecord = data?.categories?.find(
    (c) => c.id === category || c.name === category || c.slug === category,
  );
  const collectionRecord = data?.collections?.find(
    (c) => c.id === collection || c.slug === collection,
  );
  const missingScope =
    !!data && ((!!category && !categoryRecord) || (!!collection && !collectionRecord));
  const criteria = {
    p_query: searchQuery,
    p_category: categoryRecord?.id || null,
    p_collection: collectionRecord?.id || null,
    p_type: productType,
    p_tag: offerId ? `OFFER:${offerId}` : productTag,
    p_size: selectedSize,
    p_color: selectedColor,
    p_max_price: priceLimit,
    p_sort: sortOrder,
  };
  const query = useInfiniteQuery({
    queryKey: ['storefront', 'search', criteria],
    queryFn: ({ pageParam }) => searchCatalog(criteria, pageParam),
    initialPageParam: 0,
    getNextPageParam: (page, pages) => (pages.length * 24 < page.count ? pages.length : undefined),
    enabled: !isDemo && !!data && !missingScope,
  });
  const facets = query.data?.pages[0]?.facets;
  const priceCeiling = Math.max(
    isDemo ? defaultMaxPrice : 1000,
    facets?.maxPrice || 0,
    ...products.map((p) => Math.ceil(p.price / 100) * 100),
  );
  const maxPrice = priceLimit ?? priceCeiling;
  function updateSearchParam(key, value) {
    const next = new URLSearchParams(searchParams);
    value ? next.set(key, value) : next.delete(key);
    setSearchParams(next);
  }
  function resetFilters() {
    const next = new URLSearchParams(searchParams);
    // Keep the menu destination; clear only user refinements.
    ['size', 'color', 'maxPrice', 'q', 'sort'].forEach((key) => next.delete(key));
    next.delete('category');
    setSearchParams(next);
  }
  const demoProducts = sortProducts(
    filterProducts(
      collection ? products.filter((p) => p.collections?.includes(collection)) : products,
      {
        category,
        type: productType,
        tag: productTag,
        size: selectedSize,
        color: selectedColor,
        maxPrice,
        query: searchQuery,
      },
    ),
    sortOrder,
  );
  return {
    category,
    productType,
    productTag,
    offerId,
    sortOrder,
    searchQuery,
    selectedSize,
    setSelectedSize: (value) => updateSearchParam('size', value),
    selectedColor,
    setSelectedColor: (value) => updateSearchParam('color', value),
    maxPrice,
    setMaxPrice: (value) => updateSearchParam('maxPrice', String(value)),
    categoryLocked: !!fixedCategory,
    hasRefinements: !!(
      selectedSize ||
      selectedColor ||
      priceLimit !== null ||
      searchQuery ||
      (!fixedCategory && category)
    ),
    availableSizes: facets?.sizes || [...new Set(products.flatMap((p) => p.sizes))],
    availableColors: facets?.colors || [...new Set(products.flatMap((p) => p.colors))],
    priceCeiling,
    visibleProducts: isDemo
      ? demoProducts
      : missingScope
        ? []
        : query.data?.pages.flatMap((page) => page.products) || [],
    count: isDemo ? demoProducts.length : missingScope ? 0 : query.data?.pages[0]?.count || 0,
    loading: !isDemo && !missingScope && (data ? query.isPending : contentLoading),
    error: query.error?.message || (!data && contentError),
    hasNextPage: !isDemo && !missingScope && query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    retry: () => (data ? void query.refetch() : retryContent()),
    setCategory: (value) => updateSearchParam('category', value),
    setSortOrder: (value) => updateSearchParam('sort', value),
    resetFilters,
  };
}
