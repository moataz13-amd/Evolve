import { useContent } from '../../context/ContentContext';
import { CmsText } from './CmsText';
import { SectionTitle } from '../SectionTitle';
import { Link } from 'react-router-dom';

import { useStore } from '../../context/StoreContext';

export function BrandStory() {
  const { isArabic } = useStore();
  const config = useContent().section('story');
  return (
    <div className="home-story-frame">
      <section className={`home-story cms-theme-${config?.background || 'red'}`}>
        <div>
          <span className="eyebrow">
            <CmsText sectionKey="story" field="eyebrow">
              MORE THAN A ROTATION
            </CmsText>
          </span>
          <SectionTitle as="h2">
            <CmsText sectionKey="story" field="heading">
              {isArabic ? 'للي بيختاروا يكملوا.' : 'FOR THOSE WHO SHOW UP.'}
            </CmsText>
          </SectionTitle>
          <p>
            <CmsText sectionKey="story" field="description">
              {isArabic
                ? 'من أول خطوة لآخر تكرار. اكتشف الفكرة وراء EVOLVE.'
                : 'From the first step to the final rep. Get to know the mindset behind EVOLVE.'}
            </CmsText>
          </p>
          <Link className="button button-primary" to={config?.cta_url || '/about'}>
            <CmsText sectionKey="story" field="cta_label">
              {isArabic ? 'قصة EVOLVE' : 'Our story'}
            </CmsText>
          </Link>
        </div>
        <span>EVOLVE / 01</span>
      </section>
    </div>
  );
}
