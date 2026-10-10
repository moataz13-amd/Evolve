import { SectionTitle } from '../SectionTitle';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { getFaqs } from '../../data/faqs';
import { useContent } from '../../context/ContentContext';
import { CmsText } from './CmsText';

export function Faq() {
  const { isArabic } = useStore();
  const { data, isDemo, section } = useContent();
  const config = section('faq');
  const faqs = isDemo
    ? getFaqs(isArabic)
    : (data?.faqs || []).map((faq) => [
        isArabic ? faq.question_ar || faq.question : faq.question,
        isArabic ? faq.answer_ar || faq.answer : faq.answer,
      ]);

  return (
    <section className="section home-faq" aria-labelledby="home-faq-title">
      <div className="home-faq-intro">
        <span className="eyebrow">
          <i />
          <CmsText sectionKey="faq" field="eyebrow">
            {isArabic ? 'الأسئلة الشائعة' : 'GOOD TO KNOW / FAQ'}
          </CmsText>
        </span>
        <SectionTitle as="h2" id="home-faq-title" lang="en" dir="ltr">
          FAQ
        </SectionTitle>
        <p>
          <CmsText sectionKey="faq" field="description">
            {isArabic
              ? 'كل اللي محتاج تعرفه قبل خطوتك الجاية.'
              : 'A few details to help you make your next move.'}
          </CmsText>
        </p>
        <Link className="button button-primary" to={config?.cta_url || '/contact'}>
          <CmsText sectionKey="faq" field="cta_label">
            {isArabic ? 'تواصل معنا' : 'Contact us'}
          </CmsText>
        </Link>
      </div>
      <div className="home-faq-list">
        {faqs.map(([question, answer], index) => (
          <details key={index}>
            <summary>
              <span className="home-faq-number">0{index + 1}</span>
              <span>{question}</span>
              <span className="home-faq-toggle" aria-hidden="true" />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
        <Link className="text-link" to="/help/faq">
          {isArabic ? 'عرض صفحة الأسئلة الشائعة' : 'Visit the FAQ page'}
        </Link>
      </div>
    </section>
  );
}
