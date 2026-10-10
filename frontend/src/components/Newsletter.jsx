import { useState } from 'react';
import { useContent } from '../context/ContentContext';
import { useStore } from '../context/StoreContext';
import { database } from '../lib/supabase';
export function Newsletter() {
  const { isDemo } = useContent();
  const { isArabic } = useStore();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  return (
    <form
      className="newsletter-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const email = new FormData(form).get('email');
        setPending(true);
        setNotice('');
        try {
          if (isDemo)
            setNotice(
              isArabic ? 'معاينة فقط؛ لم يتم حفظ البريد.' : 'Demo preview. Email was not saved.',
            );
          else {
            const { error } = await database().rpc('subscribe_newsletter', { p_email: email });
            if (error) throw error;
            setNotice(
              isArabic ? 'تم تسجيل طلب الاشتراك.' : 'Your subscription request was received.',
            );
            form.reset();
          }
        } catch (error) {
          setNotice(error.message || 'Unable to subscribe.');
        } finally {
          setPending(false);
        }
      }}
    >
      <label htmlFor="newsletter-email">
        {isArabic ? 'تحديثات المجموعة بالبريد' : 'Collection updates by email'}
      </label>
      <input
        id="newsletter-email"
        name="email"
        type="email"
        required
        maxLength={254}
        autoComplete="email"
        placeholder="Your email"
      />
      <small>
        {isArabic
          ? 'بالاشتراك توافق على استقبال تحديثات EVOLVE.'
          : 'By subscribing, you consent to receive EVOLVE email updates.'}
      </small>
      <button className="button button-primary" disabled={pending}>
        {pending ? '…' : isArabic ? 'اشترك' : 'Subscribe'}
      </button>
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
