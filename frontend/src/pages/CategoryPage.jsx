import { SectionTitle } from '../components/SectionTitle';
import { Link, useParams } from 'react-router-dom';

import { useStore } from '../context/StoreContext';

import { hero, photo } from '../data/products';
import Shop from './ShopPage';
import { useContent } from '../context/ContentContext';
import { mediaUrl } from '../lib/supabase';
export default function CategoryPage({ categoryOnly = false }) {
  const { slug } = useParams();
  const { isArabic } = useStore();
  const isGymWear = slug === 'gym-wear';
  const { data, isDemo, loading, error, retry } = useContent();
  if (!isDemo) {
    if (!data && loading)
      return (
        <section className="section" role="status">
          {isArabic ? 'جاري تحميل القسم…' : 'Loading collection…'}
        </section>
      );
    if (!data && error)
      return (
        <section className="section" role="alert">
          <p>{error}</p>
          <button onClick={retry}>Try again</button>
        </section>
      );
    const collection =
      !categoryOnly && data?.collections.find((collection) => collection.slug === slug);
    // Preserve old category URLs while giving collections their own namespace.
    const category = !collection && data?.categories.find((category) => category.slug === slug);
    const item = category || collection;
    if (!item)
      return (
        <section className="section empty">
          <h1>{isArabic ? 'القسم غير متوفر.' : 'Collection not found.'}</h1>
          <Link to="/shop">Shop all</Link>
        </section>
      );
    const showPageTitle = !category || category.show_page_title === true;
    return (
      <>
        {item.media?.path && (
          <section className={`category-hero${showPageTitle ? '' : ' category-hero--image-only'}`}>
            <img src={mediaUrl(item.media.path)} alt={item.name} width="1600" height="900" />
            {showPageTitle && (
              <div>
                <SectionTitle as="h1">
                  {isArabic ? item.name_ar || item.name : item.name}
                </SectionTitle>
                <p>{item.description}</p>
              </div>
            )}
          </section>
        )}
        <Shop
          key={item.id}
          fixedCategory={category?.slug}
          fixedCollection={collection?.id}
          headingAs={showPageTitle && item.media?.path ? 'h2' : 'h1'}
          pageTitle={
            category
              ? isArabic
                ? 'تسوق المجموعة'
                : 'Shop the collection'
              : isArabic
                ? item.name_ar || item.name
                : item.name
          }
        />
      </>
    );
  }
  if (!['gym-wear', 'sweatpants'].includes(slug)) {
    if (slug === 'core' && !categoryOnly)
      return <Shop pageTitle={isArabic ? 'مجموعة كور' : 'Core Collection'} />;
    return (
      <section className="section empty">
        <h1>{isArabic ? 'القسم غير متوفر.' : 'Collection not found.'}</h1>
        <Link to="/shop">Shop all</Link>
      </section>
    );
  }
  return (
    <>
      <section className="category-hero">
        <img
          src={isGymWear ? hero : photo('photo-1552902865-b72c031ac5ea', 1600)}
          alt={isGymWear ? 'Training collection' : 'Sweatpants collection'}
          width="1600"
          height="900"
        />
        <div>
          <span className="eyebrow">EVOLVE / {isGymWear ? 'PERFORMANCE' : 'EVERYDAY'}</span>
          <SectionTitle as="h1">
            {isArabic
              ? isGymWear
                ? 'جاهز لكل تمرين.'
                : 'راحة على طريقتك.'
              : isGymWear
                ? 'PUT IN THE WORK.'
                : 'OFF DUTY. ON FORM.'}
          </SectionTitle>
          <p>
            {isArabic
              ? isGymWear
                ? 'قطع أساسية تتحرك معاك، في كل تكرار.'
                : 'من الإحماء لوقت الراحة. قصّات مدروسة لكل يوم.'
              : isGymWear
                ? 'Your training rotation, redefined.'
                : 'From the warm-up to the wind-down. Your everyday uniform.'}
          </p>
          <a className="button button-primary" href="#collection-products">
            {isArabic ? 'اكتشف المنتجات' : 'Explore the edit'}
          </a>
        </div>
      </section>
      <div id="collection-products">
        <Shop fixedCategory={isGymWear ? 'Gym wear' : 'Sweatpants'} />
      </div>
      <section className="section editorial-note">
        <span className="eyebrow">01 / THE EVERYDAY ATHLETE</span>
        <SectionTitle as="h2">
          {isArabic ? 'أداء يستمر خارج النادي.' : 'Performance doesn’t clock out.'}
        </SectionTitle>
        <p>
          {isArabic
            ? 'اختار قطع تناسب تدريبك وحياتك اليومية.'
            : 'Build a rotation that moves between training and everyday life.'}
        </p>
        <Link
          className="text-link"
          to={isGymWear ? '/collections/sweatpants' : '/collections/gym-wear'}
        >
          {isArabic ? 'اكتشف القسم الآخر' : 'Discover the other side'}
        </Link>
      </section>
    </>
  );
}
