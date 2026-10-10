import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { database } from '../../lib/supabase';
import { useStore } from '../../context/StoreContext';
import { SectionTitle } from '../SectionTitle';
import { AccountEditorial } from './AccountEditorial';

export function ShopperAuthForm() {
  const { isArabic } = useStore();
  const [registering, setRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const text = (arabic: string, english: string) => (isArabic ? arabic : english);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    setNotice('');
    try {
      const credentials = { email: email.trim(), password };
      if (registering) {
        const result = await database().auth.signUp({
          ...credentials,
          options: {
            data: { name: name.trim() },
            emailRedirectTo: window.location.origin + '/account',
          },
        });
        if (result.error) throw result.error;
        if (!result.data.session) {
          setNotice(
            text(
              'راجع بريدك الإلكتروني لتأكيد الحساب، وبعدها تقدر تسجل الدخول.',
              'Check your inbox to confirm your account, then sign in.',
            ),
          );
          setPassword('');
        }
      } else {
        const result = await database().auth.signInWithPassword(credentials);
        if (result.error) throw result.error;
      }
    } catch (failure) {
      const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : '';
      if (code === 'invalid_credentials') {
        setError(
          text(
            'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
            'The email or password is incorrect.',
          ),
        );
      } else if (code === 'email_not_confirmed') {
        setError(
          text('أكد بريدك الإلكتروني قبل تسجيل الدخول.', 'Confirm your email before signing in.'),
        );
      } else if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
        setError(
          text(
            'محاولات كتير في وقت قصير. استنى شوية وجرب تاني.',
            'Too many attempts. Please wait a moment and try again.',
          ),
        );
      } else {
        setError(
          text(
            'تعذر إكمال الطلب. راجع بياناتك واتصالك وجرب تاني.',
            failure instanceof Error ? failure.message : 'Unable to continue. Please try again.',
          ),
        );
      }
    } finally {
      setPending(false);
    }
  }

  function switchMode() {
    setRegistering(!registering);
    setShowPassword(false);
    setPassword('');
    setError('');
    setNotice('');
  }

  return (
    <section
      className="account-entry shopper-auth"
      aria-labelledby="shopper-auth-title"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <AccountEditorial isArabic={isArabic} />
      <div className="account-entry-panel">
        <Link className="account-back" to="/shop">
          {text('العودة للتسوق', 'Back to the store')}
        </Link>
        <div className="account-entry-heading">
          <span className="eyebrow">
            <i />
            {text('مساحتك في EVOLVE', 'YOUR EVOLVE SPACE')}
          </span>
          <SectionTitle as="h1" id="shopper-auth-title">
            {registering
              ? text('ابدأ مع EVOLVE.', 'Make your move.')
              : text('أهلًا برجوعك.', 'Welcome back.')}
          </SectionTitle>
          <p>
            {registering
              ? text(
                  'حسابك لمتابعة طلباتك وإتمام التسوق بسهولة.',
                  'Create your account and keep your next move in one place.',
                )
              : text(
                  'سجّل دخولك وتابع طلباتك وكمل تسوقك.',
                  'Your orders. Your next essentials. All in one place.',
                )}
          </p>
        </div>
        <form className="store-form account-entry-form" onSubmit={submit} aria-busy={pending}>
          <fieldset disabled={pending} className="account-auth-fields">
            {registering && (
              <>
                <label htmlFor="shopper-name">{text('الاسم بالكامل', 'Full name')}</label>
                <div className="account-input">
                  <UserRound size={18} aria-hidden="true" />
                  <input
                    id="shopper-name"
                    name="name"
                    required
                    maxLength={80}
                    autoComplete="name"
                    placeholder={text('اكتب اسمك', 'Enter your name')}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
              </>
            )}
            <label htmlFor="shopper-email">{text('البريد الإلكتروني', 'Email address')}</label>
            <div className="account-input">
              <Mail size={18} aria-hidden="true" />
              <input
                id="shopper-email"
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="you@example.com"
                dir="ltr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <label htmlFor="shopper-password">{text('كلمة المرور', 'Password')}</label>
            <div className="account-input">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                id="shopper-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={registering ? 8 : 1}
                autoComplete={registering ? 'new-password' : 'current-password'}
                placeholder={text('اكتب كلمة المرور', 'Enter your password')}
                dir="ltr"
                aria-describedby={registering ? 'shopper-password-hint' : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                className="account-password-toggle"
                type="button"
                aria-label={
                  showPassword
                    ? text('إخفاء كلمة المرور', 'Hide password')
                    : text('إظهار كلمة المرور', 'Show password')
                }
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {registering && (
              <p className="account-auth-hint" id="shopper-password-hint">
                {text('استخدم 8 أحرف على الأقل.', 'Use at least 8 characters.')}
              </p>
            )}
            {error && (
              <p className="account-auth-message account-auth-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="account-auth-message" role="status">
                {notice}
              </p>
            )}
            <button type="submit" className="button button-primary">
              {pending
                ? text('جاري المتابعة…', 'Please wait…')
                : registering
                  ? text('إنشاء حساب', 'Create account')
                  : text('تسجيل الدخول', 'Sign in')}
            </button>
          </fieldset>
        </form>
        <p className="account-auth-switch">
          {registering
            ? text('عندك حساب بالفعل؟', 'Already part of EVOLVE?')
            : text('أول مرة معانا؟', 'New to EVOLVE?')}
          <button type="button" disabled={pending} onClick={switchMode}>
            {registering ? text('سجّل دخولك', 'Sign in') : text('أنشئ حسابك', 'Create an account')}
          </button>
        </p>
        <div className="account-entry-footer account-auth-footer">
          <span>{text('محتاج مساعدة؟', 'Need a hand?')}</span>
          <Link to="/contact">{text('تواصل معنا', 'Contact us')}</Link>
          <Link to="/help/privacy">{text('الخصوصية', 'Privacy')}</Link>
        </div>
      </div>
    </section>
  );
}
