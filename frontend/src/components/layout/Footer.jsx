import { Link } from 'react-router-dom';
import { Globe } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { BrandLogo } from '../BrandLogo';
import { useContent } from '../../context/ContentContext';
import { Newsletter } from '../Newsletter';
export function Footer() {
  const { isArabic, toggleLanguage } = useStore();
  const { data, isDemo } = useContent();
  const settings = data?.settings;
  return (
    <footer>
      <div className="footer-top">
        <div className="footer-brand">
          <BrandLogo light />
          <p>
            For the work. For the everyday.
            <br />
            Move with purpose.
          </p>
          <span className="footer-motto">KEEP SHOWING UP.</span>
        </div>
        <div>
          <h4>{isArabic ? 'اكتشف' : 'EXPLORE'}</h4>
          <Link to="/shop">{isArabic ? 'تسوق الكل' : 'Shop all'}</Link>
          {isDemo ? (
            <>
              <Link to="/collections/gym-wear">{isArabic ? 'ملابس التدريب' : 'Gym wear'}</Link>
              <Link to="/collections/sweatpants">
                {isArabic ? 'البناطيل الرياضية' : 'Sweatpants'}
              </Link>
            </>
          ) : (
            (data?.categories || []).map((c) => (
              <Link key={c.id} to={'/categories/' + c.slug}>
                {isArabic ? c.name_ar || c.name : c.name}
              </Link>
            ))
          )}
          <Link to="/new-arrivals">{isArabic ? 'وصل حديثًا' : 'New arrivals'}</Link>
          <Link to="/about">{isArabic ? 'عن EVOLVE' : 'Our story'}</Link>
          <Link to="/wishlist">{isArabic ? 'المفضلة' : 'Wishlist'}</Link>
        </div>
        <div>
          <h4>{isArabic ? 'معلومات' : 'INFORMATION'}</h4>
          {[
            ['size-guide', isArabic ? 'دليل المقاسات' : 'Size guide'],
            ['faq', isArabic ? 'الأسئلة الشائعة' : 'FAQs'],
            ['shipping-returns', isArabic ? 'الشحن والاسترجاع' : 'Shipping & returns'],
            ['privacy', isArabic ? 'الخصوصية' : 'Privacy policy'],
            ['terms', isArabic ? 'الشروط' : 'Terms of service'],
          ].map(([path, label]) => (
            <Link key={path} to={'/help/' + path}>
              {label}
            </Link>
          ))}
          <Link to="/contact">{isArabic ? 'تواصل معنا' : 'Contact us'}</Link>
          <Link to="/account">{isArabic ? 'حسابي' : 'My account'}</Link>
        </div>
        <div>
          <h4>{isArabic ? 'خليك متابع' : 'STAY IN THE LOOP'}</h4>
          <p>
            New essentials. Fresh perspective.
            <br />
            Follow the movement.
          </p>
          {isDemo ? (
            <>
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                Instagram
              </a>
              <small>Brand social account coming soon.</small>
            </>
          ) : (
            ['instagram', 'facebook', 'tiktok']
              .filter((key) => /^https:\/\//.test(settings?.[key] || ''))
              .map((key) => (
                <a key={key} href={settings[key]} target="_blank" rel="noreferrer">
                  {key}
                </a>
              ))
          )}
          {(isDemo || settings) && <Newsletter />}
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 EVOLVE. All rights reserved.</span>
        <span>
          {isDemo ? 'DEMO STOREFRONT · EGP' : settings?.currency || ''} <Globe size={13} />
        </span>
        <button
          onClick={toggleLanguage}
          aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
        >
          {isArabic ? 'EN' : 'AR'}
        </button>
      </div>
    </footer>
  );
}
