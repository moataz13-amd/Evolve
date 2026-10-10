import { useContent } from '../context/ContentContext';
import { SectionTitle } from '../components/SectionTitle';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useStore } from '../context/StoreContext';

import { ProductCard } from '../components/ProductCard';
import { PageIntro } from '../components/PageIntro';
import { useQuery } from '@tanstack/react-query';
import { curatedProducts } from '../services/content.service';
export default function WishlistPage() {
  const { products, isDemo } = useContent();
  const { isArabic, wishlist } = useStore();
  const query = useQuery({
    queryKey: ['storefront', 'wishlist', wishlist],
    queryFn: () => curatedProducts(wishlist),
    enabled: !isDemo && !!wishlist.length,
  });
  const savedProducts = isDemo
    ? products.filter((product) => wishlist.includes(product.id))
    : query.data || [];
  return (
    <section className="section utility-page">
      <PageIntro
        label="YOUR PERSONAL EDIT"
        title={isArabic ? 'المفضلة.' : 'The keepers.'}
        copy={
          isArabic
            ? 'القطع اللي لفتت انتباهك. محفوظة على جهازك.'
            : 'The pieces you’ve got your eye on. Saved in this browser.'
        }
      />
      {query.isError ? (
        <p role="alert">{query.error.message}</p>
      ) : !isDemo && wishlist.length && query.isPending ? (
        <p role="status">Loading saved products…</p>
      ) : savedProducts.length ? (
        <div className="product-grid">
          {savedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="empty bordered-empty">
          <Heart size={38} />
          <SectionTitle as="h2">{isArabic ? 'ابدأ قائمتك.' : 'Make it your own.'}</SectionTitle>
          <p>
            {isArabic
              ? 'اضغط على القلب في أي منتج علشان تحفظه هنا.'
              : 'Tap the heart on a product to save it here.'}
          </p>
          <Link className="button button-primary" to="/shop">
            {isArabic ? 'اكتشف المنتجات' : 'Explore essentials'}
          </Link>
        </div>
      )}
    </section>
  );
}
