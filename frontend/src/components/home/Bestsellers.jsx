import { CmsText } from './CmsText';
import { useContent } from '../../context/ContentContext';
import { SectionTitle } from '../SectionTitle';
import { Link } from 'react-router-dom';

import { useStore } from '../../context/StoreContext';
import { ProductRail } from '../ProductRail';
import { useQuery } from '@tanstack/react-query';
import { curatedProducts } from '../../services/content.service';
export function Bestsellers() {
  const { products, section, isDemo } = useContent();
  const config = section('products');
  const selectedIds = [...(config?.homepage_products || [])]
    .sort((a, b) => a.display_order - b.display_order)
    .map((item) => item.product_id);
  const collectionId = config?.collection_id;
  const query = useQuery({
    queryKey: ['storefront', 'curated', selectedIds, collectionId],
    queryFn: () => curatedProducts(selectedIds, collectionId),
    enabled: !isDemo,
  });
  const displayed = isDemo ? products : query.data || [];
  const { isArabic } = useStore();
  return (
    <section className="section bestsellers">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            <CmsText sectionKey="products" field="eyebrow">
              HEAVY ROTATION. FOR A REASON.
            </CmsText>
          </span>
          <SectionTitle as="h2">
            <CmsText sectionKey="products" field="heading">
              {isArabic ? 'قطع أساسية مميزة.' : 'Your next go-to.'}
            </CmsText>
          </SectionTitle>
        </div>
        <Link className="text-link" to="/shop">
          {isArabic ? 'تسوق كل المنتجات' : 'Shop all essentials'}
        </Link>
      </div>
      <ProductRail
        products={displayed.slice(0, 24)}
        label={isArabic ? 'المنتجات المميزة' : 'Featured products'}
      >
        {!isDemo && query.isPending && (
          <p role="status">{isArabic ? 'جاري تحميل المنتجات…' : 'Loading products…'}</p>
        )}
        {!isDemo && query.isSuccess && displayed.length === 0 && (
          <p role="status">
            {isArabic ? 'منتجات جديدة قريبًا.' : 'New essentials are on the way.'}
          </p>
        )}
        {query.isError && (
          <p role="alert">
            Unable to load products. <button onClick={() => query.refetch()}>Try again</button>
          </p>
        )}
      </ProductRail>
    </section>
  );
}
