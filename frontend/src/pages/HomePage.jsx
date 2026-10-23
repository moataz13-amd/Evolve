import { Hero } from '../components/home/Hero';
import { BrandStrip } from '../components/home/BrandStrip';
import { Categories } from '../components/home/Categories';
import { Bestsellers } from '../components/home/Bestsellers';
import { HomeCatalogEdits } from '../components/home/HomeCatalogEdits';
import { CollectionBanner } from '../components/home/CollectionBanner';
import { BrandStory } from '../components/home/BrandStory';
import { Benefits } from '../components/home/Benefits';
import { Faq } from '../components/home/Faq';
import { useContent } from '../context/ContentContext';
import { Link } from 'react-router-dom';
import { mediaUrl } from '../lib/supabase';
import { useStore } from '../context/StoreContext';
import { safeStorefrontPath } from '../utils/storefrontLinks';
export default function HomePage() {
  const { isDemo, data, loading } = useContent();
  const { isArabic } = useStore();
  if (!isDemo) {
    // The hero has local copy and photography, so a first visit needs no CMS wait screen.
    if (!data && loading) return <Hero />;
    if (!data?.sections?.length && !data?.banners?.length) {
      return (
        <section className="section empty" role="status">
          <h1>{isArabic ? 'مجموعة EVOLVE قريبًا' : 'EVOLVE is getting ready.'}</h1>
          <p>
            {isArabic ? 'تابعنا لاكتشاف مجموعتنا القادمة.' : 'Stay tuned for our next collection.'}
          </p>
          <Link className="button button-primary" to="/contact">
            {isArabic ? 'تواصل معنا' : 'Contact us'}
          </Link>
        </section>
      );
    }
    const sections = {
      hero: Hero,
      categories: Categories,
      products: HomeProducts,
      core_collection: CollectionBanner,
      story: BrandStory,
      values: Benefits,
      faq: Faq,
      strip: BrandStrip,
    };
    return (
      <>
        {data?.sections.map((section) => {
          const Component = sections[section.key];
          return Component ? <Component key={section.id} /> : null;
        })}
        {data?.banners.map((banner) => (
          <section className="section editorial-note" key={banner.id}>
            {banner.media?.path && (
              <img
                src={mediaUrl(banner.media.path)}
                alt={banner.title}
                width="1200"
                height="400"
                loading="lazy"
              />
            )}
            <h2>{banner.title}</h2>
            <p>{banner.description}</p>
            <Link
              className="button button-primary compact-button"
              to={safeStorefrontPath(banner.cta_url)}
            >
              {banner.cta_label}
            </Link>
          </section>
        ))}
      </>
    );
  }
  return (
    <>
      <Hero />
      <BrandStrip />
      <Categories />
      <Bestsellers />
      <HomeCatalogEdits />
      <CollectionBanner />
      <BrandStory />
      <Benefits />
      <Faq />
    </>
  );
}

function HomeProducts() {
  return (
    <>
      <Bestsellers />
      <HomeCatalogEdits />
    </>
  );
}
