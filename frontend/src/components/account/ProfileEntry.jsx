import { SectionTitle } from '../SectionTitle';
import { Heart, Mail, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AccountEditorial } from './AccountEditorial';
export function ProfileEntry({ isArabic, profile, onSubmit, onCancel }) {
  return (
    <section className="account-entry" aria-labelledby="account-entry-title">
      <AccountEditorial isArabic={isArabic} />
      <div className="account-entry-panel">
        <Link className="account-back" to="/shop">
          {isArabic ? 'العودة للتسوق' : 'Back to the store'}
        </Link>
        <div className="account-entry-heading">
          <span className="eyebrow">
            <i />
            {isArabic ? 'مساحتك في EVOLVE' : 'YOUR EVOLVE SPACE'}
          </span>
          <SectionTitle as="h1" id="account-entry-title">
            {profile
              ? isArabic
                ? 'تفاصيلك.'
                : 'Your details.'
              : isArabic
                ? 'أهلًا بيك.'
                : 'Welcome in.'}
          </SectionTitle>
          <p>
            {isArabic
              ? 'احفظ بياناتك وتابع مفضلتك وطلباتك التجريبية في مكان واحد.'
              : 'Your saved essentials and demo orders, all in one place.'}
          </p>
        </div>
        <form className="store-form account-entry-form" onSubmit={onSubmit}>
          <label htmlFor="profile-name">{isArabic ? 'الاسم' : 'Full name'}</label>
          <div className="account-input">
            <UserRound size={18} aria-hidden="true" />
            <input
              id="profile-name"
              name="name"
              required
              maxLength={80}
              defaultValue={profile?.name || ''}
              autoComplete="name"
              placeholder={isArabic ? 'اكتب اسمك' : 'Enter your name'}
            />
          </div>
          <label htmlFor="profile-email">{isArabic ? 'البريد الإلكتروني' : 'Email address'}</label>
          <div className="account-input">
            <Mail size={18} aria-hidden="true" />
            <input
              id="profile-email"
              type="email"
              name="email"
              required
              defaultValue={profile?.email || ''}
              autoComplete="email"
              placeholder="you@example.com"
              dir="ltr"
            />
          </div>
          <p className="account-demo-note" id="account-demo-note">
            {isArabic
              ? 'نسخة تجريبية: البيانات بتتحفظ في المتصفح ده فقط، بدون إنشاء حساب فعلي.'
              : 'Demo experience. Your details are saved only in this browser; no online account is created.'}
          </p>
          <button
            type="submit"
            className="button button-primary"
            aria-describedby="account-demo-note"
          >
            {profile
              ? isArabic
                ? 'حفظ التعديلات'
                : 'Save changes'
              : isArabic
                ? 'متابعة إلى حسابي'
                : 'Continue to my space'}
          </button>
          {profile && (
            <button type="button" className="account-cancel" onClick={onCancel}>
              {isArabic ? 'إلغاء التعديل' : 'Cancel changes'}
            </button>
          )}
        </form>
        <div className="account-entry-footer">
          <Heart size={16} aria-hidden="true" />
          <span>{isArabic ? 'لسه بتختار أساسياتك؟' : 'Still finding your essentials?'}</span>
          <Link to="/new-arrivals">{isArabic ? 'اكتشف الجديد' : 'Explore new arrivals'}</Link>
        </div>
      </div>
    </section>
  );
}
