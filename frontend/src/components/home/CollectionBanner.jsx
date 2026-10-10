import { useContent } from '../../context/ContentContext';
import { CmsText } from './CmsText';
import { SectionTitle } from '../SectionTitle';
import { Link } from 'react-router-dom';

import { useStore } from '../../context/StoreContext';
import { photo } from '../../data/products';

export function CollectionBanner() {
  const { isArabic } = useStore();
  const config = useContent().section('core_collection');
  return (
    <section className={`collection-banner cms-theme-${config?.background || 'charcoal'}`}>
      <div>
        <span className="eyebrow">
          <CmsText sectionKey="core_collection" field="eyebrow">
            THE CORE COLLECTION / VOL. 01
          </CmsText>
        </span>
        <SectionTitle as="h2">
          <CmsText sectionKey="core_collection" field="heading">
            {isArabic ? (
              <>
                أقل ضوضاء.
                <br />
                أكثر تركيزًا.
              </>
            ) : (
              <>
                LESS NOISE.
                <br />
                MORE FOCUS.
              </>
            )}
          </CmsText>
        </SectionTitle>
        <p>
          <CmsText sectionKey="core_collection" field="description">
            {isArabic
              ? 'خطوط نظيفة. تفاصيل مدروسة. أساسيات تتحرك معك.'
              : 'Clean lines. Considered details.\nEssentials that show up when you do.'}
          </CmsText>
        </p>
        <Link className="button button-primary" to={config?.cta_url || '/new-arrivals'}>
          <CmsText sectionKey="core_collection" field="cta_label">
            {isArabic ? 'اكتشف مجموعة كور' : 'Discover the core collection'}
          </CmsText>
        </Link>
      </div>
      <img
        src={config?.image || photo('photo-1534438327276-14e5300c3a48', 1000)}
        alt="Minimal strength training environment"
        loading="lazy"
        width="1000"
        height="800"
      />
      <span className="collection-watermark">EVOLVE</span>
    </section>
  );
}
