import { SectionTitle } from '../SectionTitle';
import { Link } from 'react-router-dom';

import { useStore } from '../../context/StoreContext';
import { photo } from '../../data/products';
import { useContent } from '../../context/ContentContext';
import { mediaUrl } from '../../lib/supabase';

export function Categories() {
  const { isArabic } = useStore();
  const { section, data, isDemo } = useContent();
  if (!isDemo) {
    const config = section('categories');
    return (
      <section className="section categories">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{config?.eyebrow}</span>
            <SectionTitle>
              {isArabic ? config?.heading_ar || config?.heading : config?.heading}
            </SectionTitle>
          </div>
        </div>
        <div className="category-grid">
          {(data?.categories || []).map((category) => {
            const item = config?.items?.find((item) => item.category_id === category.id);
            const image = category.media?.path || item?.media?.path;
            return (
              <Link to={'/categories/' + category.slug} className="category" key={category.id}>
                {image && (
                  <img
                    src={mediaUrl(image)}
                    alt={isArabic ? category.name_ar || category.name : category.name}
                    width="1100"
                    height="1000"
                    loading="lazy"
                  />
                )}
                <div>
                  {item?.eyebrow && <span>{item.eyebrow}</span>}
                  <h3>
                    {isArabic
                      ? item?.heading_ar || category.name_ar || category.name
                      : item?.heading || category.name}
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    );
  }
  return (
    <section className="section categories">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE RIGHT GEAR. YOUR WAY.</span>
          <SectionTitle as="h2">
            {isArabic ? 'مصممة لكل يوم.' : 'Built for your everyday.'}
          </SectionTitle>
        </div>
        <p>
          {isArabic
            ? 'من التدريب إلى وقت الراحة.'
            : 'From pushing limits to taking it easy.\nFind your fit.'}
        </p>
      </div>
      <div className="category-grid">
        <Link to="/collections/gym-wear" className="category">
          <img
            src={photo('photo-1581009146145-b5ef050c2e1e', 1100)}
            alt="Athlete training in black gym wear"
            loading="lazy"
            width="1100"
            height="1000"
          />
          <div>
            <span>01 / PERFORMANCE ESSENTIALS</span>
            <h3>{isArabic ? 'ملابس التدريب' : 'Gym wear'}</h3>
          </div>
        </Link>
        <Link to="/collections/sweatpants" className="category">
          <img
            src={photo('photo-1552902865-b72c031ac5ea', 1100)}
            alt="Comfortable men's sweatpants"
            loading="lazy"
            width="1100"
            height="1000"
          />
          <div>
            <span>02 / COMFORT WITHOUT COMPROMISE</span>
            <h3>{isArabic ? 'البناطيل الرياضية' : 'Sweatpants'}</h3>
          </div>
        </Link>
      </div>
    </section>
  );
}
