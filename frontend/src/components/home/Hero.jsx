import { useContent } from '../../context/ContentContext';
import { CmsText } from './CmsText';
import { SectionTitle } from '../SectionTitle';
import { Link } from 'react-router-dom';

import { useStore } from '../../context/StoreContext';
import { hero } from '../../data/products';

export function Hero() {
  const { isArabic } = useStore();
  const config = useContent().section('hero');
  return (
    <section className="hero">
      <img
        className="hero-image"
        src={config?.image || hero}
        alt="Athlete wearing training apparel in a strength studio"
        fetchPriority="high"
        width="1800"
        height="1200"
      />
      <div className="hero-shade" />
      <div className="hero-content">
        {config?.show_eyebrow !== false && (
          <span className="eyebrow">
            <CmsText sectionKey="hero" field="eyebrow">
              <i /> {isArabic ? 'صُممت للعمل. صنعت للحياة.' : 'ENGINEERED TO WORK. BUILT TO LIVE.'}
            </CmsText>
          </span>
        )}
        {config?.show_heading !== false && (
          <SectionTitle as="h1">
            <CmsText sectionKey="hero" field="heading">
              {isArabic ? (
                <>
                  القوة في
                  <br />
                  كل حركة<span>.</span>
                </>
              ) : (
                <>
                  STRENGTH IN
                  <br />
                  EVERY MOVE<span>.</span>
                </>
              )}
            </CmsText>
          </SectionTitle>
        )}
        {config?.show_description !== false && (
          <p>
            <CmsText sectionKey="hero" field="description">
              {isArabic
                ? 'ملابس أساسية تواكب طموحك. من أول تكرار إلى آخر خطوة.'
                : 'Purpose-built essentials for the way you move.\nFrom your first rep to your next chapter.'}
            </CmsText>
          </p>
        )}
      </div>
      <div className="hero-actions">
        <Link
          className="button hero-glass-button"
          to={config?.cta_url || '/shop'}
          lang={isArabic ? 'ar' : 'en'}
          dir={isArabic ? 'rtl' : 'ltr'}
        >
          <CmsText sectionKey="hero" field="cta_label">
            Shop Now
          </CmsText>
        </Link>
      </div>
      <div className="hero-bottom">
        <span>01 / THE EVERYDAY ATHLETE</span>
        <span>MOVE WITH PURPOSE</span>
      </div>
      <span className="hero-side">EVOLVE PERFORMANCE — EST. 2026</span>
    </section>
  );
}
