import { useStore } from '../../context/StoreContext';
import { useContent } from '../../context/ContentContext';

export function Benefits() {
  const { isArabic } = useStore();
  const { section, isDemo } = useContent();
  if (!isDemo)
    return (
      <section className="benefits section">
        {section('values')?.items.map((value, index) => (
          <div key={value.id}>
            <span>0{index + 1}</span>
            <h3>{isArabic ? value.heading_ar || value.heading : value.heading}</h3>
            <p>{isArabic ? value.description_ar || value.description : value.description}</p>
          </div>
        ))}
      </section>
    );
  return (
    <section className="benefits section">
      <div>
        <span>01</span>
        <h3>{isArabic ? 'حرية الحركة' : 'Made to move'}</h3>
        <p>
          {isArabic
            ? 'قصّات مدروسة بتسيب لك مساحة تتحرك وتتمرن.'
            : 'Thoughtful fits that give you room to put in the work.'}
        </p>
      </div>
      <div>
        <span>02</span>
        <h3>{isArabic ? 'تفاصيل مدروسة' : 'Purpose in every detail'}</h3>
        <p>
          {isArabic
            ? 'خطوط نظيفة. تفاصيل عملية. كل حاجة ليها هدف.'
            : 'Clean silhouettes. Practical details. Nothing you don’t need.'}
        </p>
      </div>
      <div>
        <span>03</span>
        <h3>{isArabic ? 'خارج النادي أيضًا' : 'Beyond the gym'}</h3>
        <p>
          {isArabic
            ? 'قطع متنوعة لكل يوم، من التدريب لوقت الراحة.'
            : 'A versatile everyday rotation, from training to downtime.'}
        </p>
      </div>
    </section>
  );
}
