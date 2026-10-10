import { Select } from '../components/Select';
import { SectionTitle } from '../components/SectionTitle';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Ruler, CircleHelp, MessageSquare, UserRound, Mail } from 'lucide-react';
import { useStore } from '../context/StoreContext';

const helpLinks = [
  {
    to: '/help/size-guide',
    icon: Ruler,
    title: ['Find your fit', 'اختار مقاسك'],
    copy: ['Measurements made simple.', 'دليل بسيط للمقاسات.'],
  },
  {
    to: '/help/faq',
    icon: CircleHelp,
    title: ['Quick answers', 'إجابات سريعة'],
    copy: ['Get to know the store.', 'كل اللي محتاج تعرفه عن المتجر.'],
  },
];

export default function ContactPage() {
  const { isArabic } = useStore();
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const languageIndex = isArabic ? 1 : 0;

  function handleSubmit(event) {
    event.preventDefault();
    setHasSubmitted(true);
  }

  return (
    <section className="section contact-page" aria-labelledby="contact-title">
      <div className="contact-page-intro">
        <span className="eyebrow">
          <i />
          {isArabic ? 'تواصل مع EVOLVE' : 'EVOLVE / LET’S TALK'}
        </span>
        <SectionTitle as="h1" id="contact-title">
          {isArabic ? (
            <>
              إحنا هنا ليك<span>.</span>
            </>
          ) : (
            <>
              LET’S KEEP
              <br />
              MOVING<span>.</span>
            </>
          )}
        </SectionTitle>
        <p>
          {isArabic
            ? 'محتاج مساعدة في المقاس أو عندك سؤال؟ ابدأ من هنا.'
            : 'A question about fit. A little guidance. Your next move starts here.'}
        </p>
      </div>
      <div className="contact-studio">
        <aside className="contact-support" aria-labelledby="contact-support-title">
          <span className="contact-support-icon">
            <MessageSquare size={26} aria-hidden="true" />
          </span>
          <div>
            <span className="eyebrow">{isArabic ? 'كل تفصيلة بتفرق' : 'THE DETAILS MATTER'}</span>
            <SectionTitle as="h2" id="contact-support-title">
              {isArabic ? 'خطوة أقرب. اختيار أفضل.' : 'A little help.\nA better fit.'}
            </SectionTitle>
            <p>
              {isArabic
                ? 'من اختيار المقاس لأساسيات التدريب، اكتشف المعلومات اللي تساعدك تختار بثقة.'
                : 'From finding your size to choosing your training essentials, explore the details that help you shop with confidence.'}
            </p>
          </div>
          <div className="contact-help-links">
            {helpLinks.map(({ to, icon: Icon, title, copy }) => (
              <Link key={to} to={to}>
                <Icon size={20} aria-hidden="true" />
                <div>
                  <strong>{title[languageIndex]}</strong>
                  <span>{copy[languageIndex]}</span>
                </div>
              </Link>
            ))}
          </div>
          <span className="contact-support-signature">EVOLVE / MOVE WITH PURPOSE</span>
        </aside>
        <div className="contact-form-panel">
          <div className="contact-form-heading">
            <span className="eyebrow">{isArabic ? 'ابدأ الحوار' : 'START A CONVERSATION'}</span>
            <SectionTitle as="h2">
              {isArabic ? 'إيه اللي نقدر نساعدك فيه؟' : 'What’s on your mind?'}
            </SectionTitle>
            <p>
              {isArabic
                ? 'اختار الموضوع واكتب التفاصيل في النموذج.'
                : 'Choose a topic and share the details below.'}
            </p>
          </div>
          <form
            className="store-form contact-form"
            onSubmit={handleSubmit}
            onChange={() => setHasSubmitted(false)}
          >
            <div className="form-row">
              <label htmlFor="contact-name">
                {isArabic ? 'الاسم' : 'Full name'}
                <div className="contact-input">
                  <UserRound size={17} aria-hidden="true" />
                  <input
                    id="contact-name"
                    required
                    name="name"
                    maxLength={80}
                    autoComplete="name"
                    placeholder={isArabic ? 'اكتب اسمك' : 'Your name'}
                  />
                </div>
              </label>
              <label htmlFor="contact-email">
                {isArabic ? 'البريد الإلكتروني' : 'Email address'}
                <div className="contact-input">
                  <Mail size={17} aria-hidden="true" />
                  <input
                    id="contact-email"
                    required
                    type="email"
                    name="email"
                    autoComplete="email"
                    dir="ltr"
                    placeholder="you@example.com"
                  />
                </div>
              </label>
            </div>
            <label htmlFor="contact-topic">
              {isArabic ? 'الموضوع' : 'How can we help?'}
              <Select id="contact-topic" name="topic">
                <option value="sizing">
                  {isArabic ? 'المنتجات والمقاسات' : 'Products & sizing'}
                </option>
                <option value="store">{isArabic ? 'تجربة المتجر' : 'Store experience'}</option>
                <option value="other">{isArabic ? 'سؤال آخر' : 'Something else'}</option>
              </Select>
            </label>
            <label htmlFor="contact-message">
              {isArabic ? 'رسالتك' : 'Your message'}
              <textarea
                id="contact-message"
                required
                rows="5"
                name="message"
                maxLength={3000}
                placeholder={isArabic ? 'اكتب سؤالك والتفاصيل هنا…' : 'Tell us a little more…'}
              />
            </label>
            <p className="contact-demo-note" id="contact-demo-note">
              {isArabic
                ? 'نموذج تجريبي: الرسالة لا تُرسل ولا يتم حفظها. الإرسال يعرض تأكيدًا فقط.'
                : 'Demo form: messages are not sent or saved. Submitting shows a preview confirmation only.'}
            </p>
            <button
              type="submit"
              className="button button-primary"
              aria-describedby="contact-demo-note"
            >
              {isArabic ? 'تجربة إرسال الرسالة' : 'Preview submission'}
            </button>
            {hasSubmitted && (
              <p className="contact-form-success" role="status">
                <Check size={20} aria-hidden="true" />
                <span>
                  <strong>
                    {isArabic ? 'تمت تجربة النموذج بنجاح.' : 'Form preview complete.'}
                  </strong>
                  {isArabic
                    ? 'لم تُرسل الرسالة أو يتم حفظها.'
                    : 'Your message has not been sent or saved.'}
                </span>
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
