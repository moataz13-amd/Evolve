import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { CartDrawer } from './components/cart/CartDrawer';
import { useContent } from './context/ContentContext';
import HomePage from './pages/HomePage';
const ShopPage = lazy(() => import('./pages/ShopPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const CollectionPage = lazy(() => import('./pages/CollectionPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrderPage = lazy(() => import('./pages/OrderPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const AdminApp = lazy(() => import('./admin/AdminApp'));
export default function App() {
  const { pathname, search } = useLocation();
  const content = useContent();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  const isEmbedded = window.self !== window.top;
  const isPrivatePage =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/account' ||
    pathname === '/checkout' ||
    pathname === '/order' ||
    pathname.startsWith('/order/');

  if (isEmbedded && isPrivatePage) {
    return (
      <main className="section empty">
        <h1>Continue on EVOLVE</h1>
        <p>Open this page in a new tab to access your account or complete your order.</p>
        <a
          className="button button-primary"
          href={window.location.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open EVOLVE
        </a>
      </main>
    );
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return (
      <Suspense fallback={<div className="loading">Loading EVOLVE operations…</div>}>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
        </Routes>
      </Suspense>
    );
  }
  const isHome = pathname === '/';
  if (
    (!isHome && content.loading) ||
    (content.error && (!isHome || !content.data)) ||
    content.data?.settings.maintenance_mode
  ) {
    return (
      <>
        <Header />
        <main className="section empty" role={content.error ? 'alert' : 'status'}>
          <h1>
            {content.loading
              ? 'Loading your essentials…'
              : content.error
                ? 'Unable to load the store.'
                : 'EVOLVE will be back soon.'}
          </h1>
          {content.error && (
            <>
              <p>{content.error}</p>
              <button className="button button-primary" onClick={content.retry}>
                Try again
              </button>
            </>
          )}
        </main>
        <Footer />
      </>
    );
  }
  return (
    <>
      <Header />
      <main>
        <Suspense
          fallback={
            <div className="loading" role="status">
              Loading your essentials…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/collections/:slug" element={<CategoryPage />} />
            <Route path="/categories/:slug" element={<CategoryPage categoryOnly />} />
            <Route path="/new-arrivals" element={<CollectionPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order/:id" element={<OrderPage />} />
            <Route path="/help/:topic" element={<HelpPage />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Page not found</h1>
                  <Link to="/">Back to EVOLVE</Link>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
