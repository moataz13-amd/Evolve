import { SectionTitle } from '../components/SectionTitle';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, User, Mail, Check, Package } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatMoney } from '../utils/format';

import { PageIntro } from '../components/PageIntro';
import { ProfileEntry } from '../components/account/ProfileEntry';
import { ShopperAccount } from '../components/account/ShopperAccount';
import { useContent } from '../context/ContentContext';

export default function AccountPage() {
  const { isArabic, profile, setProfile, orders } = useStore();
  const [isEditingProfile, setIsEditingProfile] = useState(!profile);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const { isDemo } = useContent();
  function handleSaveProfile(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setProfile({ name: formData.get('name').trim(), email: formData.get('email').trim() });
    setIsEditingProfile(false);
    setHasSavedProfile(true);
  }

  if (!isDemo) return <ShopperAccount />;
  if (isEditingProfile || !profile) {
    return (
      <ProfileEntry
        isArabic={isArabic}
        profile={profile}
        onSubmit={handleSaveProfile}
        onCancel={() => setIsEditingProfile(false)}
      />
    );
  }

  return (
    <section className="section utility-page">
      <PageIntro
        label="YOUR EVOLVE SPACE"
        title={isArabic ? 'حسابك. بطريقتك.' : 'Your personal space.'}
        copy={
          isArabic
            ? 'ملف محلي تجريبي على هذا المتصفح، بدون تسجيل دخول أو خادم.'
            : 'A local demo profile in this browser. No sign-in or server account.'
        }
      />
      <div className="account-layout">
        <aside className="account-sidebar">
          <User size={32} />
          <h3>{profile?.name || (isArabic ? 'مرحبًا بيك' : 'Welcome in')}</h3>
          <p>
            {profile?.email ||
              (isArabic ? 'كل أساسياتك في مكان واحد.' : 'Your essentials, in one place.')}
          </p>
          <Link to="/wishlist">
            <Heart size={17} />
            {isArabic ? 'المفضلة' : 'Saved essentials'}
          </Link>
          <Link to="/contact">
            <Mail size={17} />
            {isArabic ? 'المساعدة' : 'Need a hand?'}
          </Link>
          <button
            onClick={() => {
              setIsEditingProfile(true);
              setHasSavedProfile(false);
            }}
          >
            {isArabic ? 'تعديل الملف' : 'Edit profile'}
          </button>
          {profile && (
            <button
              onClick={() => {
                setProfile(null);
                setIsEditingProfile(true);
              }}
            >
              {isArabic ? 'مسح الملف المحلي' : 'Clear local profile'}
            </button>
          )}
        </aside>
        <div>
          <div className="account-welcome">
            <span className="eyebrow">KEEP SHOWING UP.</span>
            <SectionTitle as="h2">
              {isArabic ? `أهلًا ${profile.name}.` : `Good to see you, ${profile.name}.`}
            </SectionTitle>
            {hasSavedProfile && (
              <p role="status">
                <Check size={16} />
                {isArabic ? 'تم حفظ الملف محليًا.' : 'Your profile is saved locally.'}
              </p>
            )}
          </div>
          <div className="order-history">
            <h3>
              <Package size={20} />
              {isArabic ? 'الطلبات التجريبية' : 'Demo order history'}
            </h3>
            {orders.length ? (
              orders.map((order) => (
                <Link to={'/order/' + order.id} className="history-row" key={order.id}>
                  <div>
                    <strong>#{order.id}</strong>
                    <span>
                      {order.items.length} {isArabic ? 'قطع' : 'items'} ·{' '}
                      {isArabic ? 'تجريبي' : 'Demo'}
                    </span>
                  </div>
                  <span>{formatMoney(order.total)}</span>
                </Link>
              ))
            ) : (
              <p>
                {isArabic
                  ? 'لسه مفيش طلبات تجريبية. اختار قطعة وجرب إتمام الطلب.'
                  : 'No demo orders yet. Find an essential and try the checkout.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
