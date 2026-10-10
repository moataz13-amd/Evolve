import { BrandLogo } from '../BrandLogo';
import { SectionTitle } from '../SectionTitle';
import { hero } from '../../data/products';

export function AccountEditorial({ isArabic }) {
  return (
    <div className="account-editorial">
      <img
        src={hero}
        alt={isArabic ? 'رياضي في صالة تدريب' : 'Athlete in a strength studio'}
        width="1800"
        height="1200"
      />
      <div className="account-editorial-content">
        <BrandLogo light />
        <div>
          <span className="eyebrow">
            {isArabic ? 'كل يوم. خطوة أقوى.' : 'EVERY DAY. ONE STEP STRONGER.'}
          </span>
          <SectionTitle as="h2">
            {isArabic ? (
              <>
                طوّر نفسك.
                <br />
                كمل طريقك<span>.</span>
              </>
            ) : (
              <>
                KEEP SHOWING UP.
                <br />
                KEEP EVOLVING<span>.</span>
              </>
            )}
          </SectionTitle>
          <p>
            {isArabic
              ? 'أساسيات تواكبك، من التمرين لليوم كله.'
              : 'Essentials that move with you. From the first rep to the rest of your day.'}
          </p>
        </div>
        <span className="account-editorial-index" dir="ltr">
          EVOLVE / PERFORMANCE ESSENTIALS
        </span>
      </div>
    </div>
  );
}
