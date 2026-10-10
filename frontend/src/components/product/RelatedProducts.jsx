import { useContent } from '../../context/ContentContext';
import { SectionTitle } from '../SectionTitle';
import { Link } from 'react-router-dom';

import { useStore } from '../../context/StoreContext';
import { ProductGrid } from '../ProductGrid';

export function RelatedProducts({ productId }) {
  const { products } = useContent();
  const { isArabic } = useStore();
  const relatedProducts = products.filter((product) => product.id !== productId).slice(0, 4);

  return (
    <section className="related">
      <div className="section-heading">
        <SectionTitle as="h2">
          {isArabic ? 'كمّل إطلالتك.' : 'Complete your rotation.'}
        </SectionTitle>
        <Link to="/shop" className="text-link">
          {isArabic ? 'عرض الكل' : 'View all'}
        </Link>
      </div>
      <ProductGrid products={relatedProducts} />
    </section>
  );
}
