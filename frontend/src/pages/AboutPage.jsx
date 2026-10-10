import { SectionTitle } from '../components/SectionTitle';
import { Link } from 'react-router-dom';

import { useStore } from '../context/StoreContext';

import { hero } from '../data/products';
import { useContent } from '../context/ContentContext';
import { CmsText } from '../components/home/CmsText';
import { Benefits } from '../components/home/Benefits';
export default function AboutPage() {
  const { isArabic } = useStore();
  const { isDemo, section } = useContent();
  const story = section('story');
  if (!isDemo)
    return (
      <>
        <section className="section about-intro">
          <span className="eyebrow">
            <CmsText sectionKey="story" field="eyebrow" />
          </span>
          <SectionTitle as="h1">
            <CmsText sectionKey="story" field="heading" />
          </SectionTitle>
          <div>
            <span>EVOLVE / THE IDEA</span>
            <p>
              <CmsText sectionKey="story" field="description" />
            </p>
          </div>
        </section>
        {story?.image && (
          <img
            className="about-image"
            src={story.image}
            alt={story.heading}
            width="1800"
            height="900"
          />
        )}
        <Benefits />
        <section className="section">
          <Link className="button button-primary" to="/shop">
            {isArabic ? 'اكتشف EVOLVE' : 'Explore EVOLVE'}
          </Link>
        </section>
      </>
    );
  return (
    <>
      <section className="section about-intro">
        <span className="eyebrow">OUR MINDSET / EVOLVE</span>
        <SectionTitle as="h1">
          {isArabic ? (
            <>
              القوة تبدأ
              <br />
              بالاستمرار.
            </>
          ) : (
            <>
              STRENGTH IS
              <br />
              SHOWING UP.
            </>
          )}
        </SectionTitle>
        <div>
          <span>01 / THE IDEA</span>
          <p>
            {isArabic
              ? 'EVOLVE للناس اللي بتختار تتحرك بهدف. ملابس رجالي للتدريب والحياة اليومية، بتصميم واضح وتفاصيل ليها معنى.'
              : 'EVOLVE is for those who move with purpose. Men’s training and everyday clothing, shaped by clean design and details that earn their place.'}
          </p>
        </div>
      </section>
      <img
        className="about-image"
        src={hero}
        alt="Strength training at the gym"
        width="1800"
        height="900"
      />
      <section className="section values-section">
        <SectionTitle as="h2">
          {isArabic ? 'أقل تعقيدًا. أكثر تركيزًا.' : 'Less distraction. More intention.'}
        </SectionTitle>
        <div className="values-grid">
          {[
            [
              isArabic ? 'الحركة أولًا' : 'Movement first',
              isArabic
                ? 'قصّات تسيب لك مساحة تتحرك بطريقتك.'
                : 'Fits that give you space to move your way.',
            ],
            [
              isArabic ? 'تصميم له هدف' : 'Design with purpose',
              isArabic
                ? 'خطوط نظيفة وتفاصيل عملية بدون تعقيد.'
                : 'Clean lines and practical details, without the noise.',
            ],
            [
              isArabic ? 'جزء من يومك' : 'Part of your everyday',
              isArabic
                ? 'قطع تقدر تلبسها في النادي وخارجه.'
                : 'A rotation that feels at home in and beyond the gym.',
            ],
          ].map(([title, copy], i) => (
            <article key={title}>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <Link className="button button-primary" to="/shop">
          {isArabic ? 'اكتشف EVOLVE' : 'Find your EVOLVE'}
        </Link>
      </section>
    </>
  );
}
