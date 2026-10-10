import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useContent } from '../../context/ContentContext';
import { useStore } from '../../context/StoreContext';
import { SectionTitle } from '../SectionTitle';
import { ProductRail } from '../ProductRail';
import { homepageCatalogEdits } from '../../services/content.service';
import { homepageEdits, demoHomepageEdit, homepagePreviewSize } from '../../utils/homepageEdits';

export function HomeCatalogEdits() {
  const { data, products, isDemo } = useContent();
  const { isArabic } = useStore();
  const edits = useMemo(() => homepageEdits(data, isDemo), [data, isDemo]);
  const query = useQuery({
    queryKey: [
      'storefront',
      'homepage-edits',
      edits.map(({ key, criteria }) => ({ key, criteria })),
    ],
    queryFn: () => homepageCatalogEdits(edits, homepagePreviewSize),
    enabled: !isDemo && !!data,
  });
  if (!isDemo && query.isPending)
    return (
      <div className="section" role="status">
        {isArabic ? 'جاري تحميل مجموعات المنتجات…' : 'Loading product collections…'}
      </div>
    );
  if (query.isError)
    return (
      <div className="section" role="alert">
        <p>{isArabic ? 'تعذّر تحميل مجموعات المنتجات.' : 'Unable to load product collections.'}</p>
        <button className="button button-primary" onClick={() => query.refetch()}>
          {isArabic ? 'حاول مجددًا' : 'Try again'}
        </button>
      </div>
    );
  return edits.map((edit) => {
    const displayed = isDemo
      ? demoHomepageEdit(products, edit)
      : query.data?.find((page) => page.key === edit.key)?.products || [];
    if (!displayed.length) return null;
    return (
      <section className="section bestsellers" key={edit.key}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              EVOLVE / {isArabic ? 'اكتشف مجموعتك' : 'FIND YOUR ROTATION'}
            </span>
            <SectionTitle as="h2">{isArabic ? edit.arabicLabel : edit.label}</SectionTitle>
          </div>
          <Link className="text-link" to={edit.to}>
            {isArabic ? 'عرض الكل' : 'View all'}
          </Link>
        </div>
        <ProductRail products={displayed} label={isArabic ? edit.arabicLabel : edit.label} />
      </section>
    );
  });
}
