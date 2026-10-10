import { SectionTitle } from '../components/SectionTitle';
import { getFaqs } from '../data/faqs';
import { SizeTable } from '../components/SizeTable';

import { Link, useParams } from 'react-router-dom';

import { useStore } from '../context/StoreContext';

import { PageIntro } from '../components/PageIntro';
import { useContent } from '../context/ContentContext';

export default function HelpPage() {
  const { topic } = useParams();
  const { isArabic } = useStore();
  const { data, isDemo } = useContent();
  const faqs = isDemo
    ? getFaqs(isArabic)
    : (data?.faqs || []).map((faq) => [
        isArabic ? faq.question_ar || faq.question : faq.question,
        isArabic ? faq.answer_ar || faq.answer : faq.answer,
      ]);
  const topicTitles = {
    'size-guide': isArabic ? 'دليل المقاسات' : 'Find your fit.',
    faq: isArabic ? 'الأسئلة الشائعة' : 'Good questions. Clear answers.',
    'shipping-returns': isArabic ? 'الشحن والاسترجاع' : 'Shipping & returns.',
    privacy: isArabic ? 'الخصوصية' : 'Your privacy.',
    terms: isArabic ? 'شروط الاستخدام' : 'Store terms.',
  };
  return (
    <section className="section utility-page">
      <PageIntro label="EVOLVE / INFORMATION" title={topicTitles[topic] || topicTitles.faq} />
      <div className="help-layout">
        <aside>
          {Object.entries(topicTitles).map(([topicId, title]) => (
            <Link
              className={topic === topicId ? 'active' : ''}
              key={topicId}
              to={'/help/' + topicId}
            >
              {title}
            </Link>
          ))}
          <Link to="/contact">{isArabic ? 'تواصل معنا' : 'Contact us'}</Link>
        </aside>
        <article>
          {topic === 'size-guide' ? (
            <>
              <SectionTitle as="h2">
                {isArabic ? 'اختار مقاسك.' : 'A fit that moves with you.'}
              </SectionTitle>
              <p>
                {isArabic
                  ? 'قياسات الجسم بالسنتيمتر. جدول تجريبي؛ تأكد من قياسات المنتج قبل الشراء الفعلي.'
                  : 'Body measurements in centimeters. This is a sample guide; check final product measurements before a real purchase.'}
              </p>
              <SizeTable />
              <h3>{isArabic ? 'طريقة القياس' : 'How to measure'}</h3>
              <p>
                {isArabic
                  ? 'قِس حول أعرض جزء في الصدر، وحول محيط الوسط الطبيعي. خلي شريط القياس أفقي ومن غير شد.'
                  : 'Measure around the fullest part of your chest and your natural waist. Keep the tape level and comfortable.'}
              </p>
            </>
          ) : topic === 'faq' ? (
            <>
              {faqs.map(([question, answer]) => (
                <details key={question}>
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </>
          ) : topic === 'privacy' ? (
            <>
              <SectionTitle as="h2">
                {isArabic ? 'بياناتك على جهازك.' : 'Your data stays local.'}
              </SectionTitle>
              <p>
                {isArabic
                  ? 'السلة والمفضلة والملف والطلبات التجريبية تُحفظ في هذا المتصفح. لا يوجد حساب على خادم. بيانات نموذج التواصل لا تُرسل أو تُحفظ. يمكنك مسح البيانات المحلية من إعدادات المتصفح.'
                  : 'Cart, wishlist, profile, and demo orders are stored in this browser. There is no server account. Contact form details are neither sent nor saved. Clear this site’s browser data to remove local records.'}
              </p>
              <p>
                {isArabic
                  ? 'الصور تُحمّل من Unsplash والخطوط من Google Fonts. هذه الخدمات تستقبل طلبات الشبكة المعتادة عند تحميل الموارد.'
                  : 'Images load from Unsplash and fonts from Google Fonts. Those services receive normal network requests when loading these assets.'}
              </p>
            </>
          ) : (
            <>
              <SectionTitle as="h2">
                {isArabic ? 'نسخة تجريبية، موضحة بوضوح.' : 'A clearly marked demo.'}
              </SectionTitle>
              <p>
                {isArabic
                  ? 'هذا المتجر يعرض تجربة التسوق فقط. لا يتم تحصيل أموال أو إنشاء طلبات شراء فعلية. الأسعار والمقاسات والصور بيانات توضيحية.'
                  : 'This storefront demonstrates a shopping experience. No money is collected and no real purchase orders are created. Prices, measurements, and photos are sample content.'}
              </p>
              <p>
                {isArabic
                  ? 'سياسات الشحن والاسترجاع والشروط التجارية النهائية تُضاف عند إطلاق المتجر الفعلي.'
                  : 'Final shipping, returns, and commercial terms will be added when the real store launches.'}
              </p>
              <Link className="text-link" to="/contact">
                {isArabic ? 'عندك سؤال؟ تواصل معنا' : 'Have a question? Get in touch'}
              </Link>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
