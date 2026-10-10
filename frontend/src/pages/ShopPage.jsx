import { Select } from '../components/Select';
import { SectionTitle } from '../components/SectionTitle';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useProductFilters } from '../hooks/useProductFilters';
import { ProductGrid } from '../components/ProductGrid';
import { FilterPanel } from '../components/shop/FilterPanel';
import { useStorefrontOffers } from '../hooks/useStorefrontOffers';
import { offerAnnouncementText } from '../utils/offerAnnouncements';

const arabicCategoryTitles = {
  'Gym wear': 'ملابس التدريب.',
  Sweatpants: 'البناطيل الرياضية.',
};
const editTitles = {
  NEW: ['New Arrivals', 'وصل حديثًا'],
  BESTSELLER: ['Best Sellers', 'الأكثر مبيعًا'],
  SALE: ['Sale', 'التخفيضات'],
  COMING_SOON: ['Coming Soon', 'قريبًا'],
  RESTOCK: ['Restocks', 'متوفر مجددًا'],
  ACCESSORIES: ['Accessories', 'الإكسسوارات'],
  BUY_GET: ['Buy & Get Offers', 'عروض اشتري وخد هدية'],
  BUY_2_GET_1: ['Buy 2 Get 1', 'اشتري ٢ وخد ١ هدية'],
  'T-Shirts': ['T-Shirts', 'تيشيرتات'],
  Compressions: ['Compressions', 'ملابس ضاغطة'],
  'Tank Tops': ['Tank Tops', 'تانك توب'],
  Jersey: ['Jersey', 'جيرسي'],
  Shorts: ['Shorts', 'شورتات'],
  Hoodies: ['Hoodies', 'هوديز'],
  Swimshorts: ['Swimshorts', 'شورتات سباحة'],
};

export default function ShopPage({ fixedCategory, fixedCollection, fixedTag, pageTitle }) {
  const { isArabic } = useStore();
  const [areFiltersOpen, setAreFiltersOpen] = useState(false);
  const filters = useProductFilters(fixedCategory, fixedCollection, fixedTag);
  const offers = useStorefrontOffers();
  const selectedOffer = offers.data?.find((offer) => offer.id === filters.offerId);
  const {
    category,
    productType,
    productTag,
    sortOrder,
    setSortOrder,
    searchQuery,
    visibleProducts,
    resetFilters,
  } = filters;
  const editTitle = editTitles[productType || productTag];
  const title = isArabic
    ? arabicCategoryTitles[category] || 'أساسياتك. بطريقتك.'
    : category || 'All essentials.';

  return (
    <div className="shop-page section">
      <div className="breadcrumb">
        <Link to="/">{isArabic ? 'الرئيسية' : 'Home'}</Link> / {isArabic ? 'المتجر' : 'Shop'}
      </div>
      <span className="eyebrow">YOUR EVERYDAY STARTS HERE.</span>
      <SectionTitle as="h1">
        {filters.offerId
          ? selectedOffer
            ? offerAnnouncementText(selectedOffer, isArabic)
            : isArabic
              ? 'منتجات العرض'
              : 'Offer products'
          : pageTitle || (editTitle ? editTitle[isArabic ? 1 : 0] : title)}
      </SectionTitle>
      <p className="shop-intro">
        {isArabic
          ? 'مصممة للتدريب. مناسبة لكل اللي بعده.'
          : 'Purpose-built for training. Designed for everything after.'}
      </p>
      <div className="shop-toolbar">
        <button onClick={() => setAreFiltersOpen((isOpen) => !isOpen)}>
          <SlidersHorizontal size={17} />
          {isArabic ? 'الفلاتر' : 'Filters'}
        </button>
        <span>
          {filters.count} {isArabic ? 'منتجات' : 'essentials'}{' '}
          {searchQuery && `for “${searchQuery}”`}
        </span>
        <label>
          {isArabic ? 'الترتيب' : 'Sort by'}
          <Select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="featured">{isArabic ? 'المميزة' : 'Featured'}</option>
            <option value="new">{isArabic ? 'وصل حديثًا' : 'New arrivals'}</option>
            <option value="low">
              {isArabic ? 'السعر: من الأقل للأعلى' : 'Price: low to high'}
            </option>
            <option value="high">
              {isArabic ? 'السعر: من الأعلى للأقل' : 'Price: high to low'}
            </option>
          </Select>
        </label>
      </div>
      <div className={`shop-layout ${areFiltersOpen ? 'with-filters' : ''}`}>
        {areFiltersOpen && (
          <FilterPanel filters={filters} onClose={() => setAreFiltersOpen(false)} />
        )}
        {filters.loading ? (
          <p role="status">{isArabic ? 'جاري تحميل المنتجات…' : 'Loading products…'}</p>
        ) : filters.error ? (
          <div role="alert">
            <p>{filters.error}</p>
            <button className="button button-primary" onClick={filters.retry}>
              Try again
            </button>
          </div>
        ) : (
          <ProductGrid products={visibleProducts}>
            <div className="empty">
              <SectionTitle as="h2">
                {isArabic ? 'لا توجد منتجات مطابقة.' : 'No matching essentials.'}
              </SectionTitle>
              <p>
                {filters.hasRefinements
                  ? isArabic
                    ? 'جرّب تغيير الفلاتر أو البحث.'
                    : 'Try a different filter or search.'
                  : filters.offerId
                    ? isArabic
                      ? 'العرض غير متاح حاليًا أو لا توجد منتجات متاحة فيه.'
                      : 'This offer is no longer available or has no available products.'
                    : isArabic
                      ? 'لم تُضف منتجات لهذا القسم بعد.'
                      : 'No products have been added to this edit yet.'}
              </p>
              {filters.hasRefinements ? (
                <button className="button button-primary" onClick={resetFilters}>
                  {isArabic ? 'مسح الفلاتر' : 'Reset filters'}
                </button>
              ) : (
                <Link className="button button-primary" to="/shop">
                  {isArabic ? 'تسوق كل المنتجات' : 'Shop all products'}
                </Link>
              )}
            </div>
          </ProductGrid>
        )}
      </div>
      {filters.hasNextPage && (
        <button
          className="button button-primary"
          onClick={filters.loadMore}
          disabled={filters.loadingMore}
        >
          {filters.loadingMore ? 'Loading…' : isArabic ? 'عرض المزيد' : 'Load more products'}
        </button>
      )}
    </div>
  );
}
