import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Heart, User, Search, ShoppingBag, Menu, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { BrandLogo } from '../BrandLogo';
import { NavigationDrawer } from './NavigationDrawer';
import { useContent } from '../../context/ContentContext';
import { OfferAnnouncement } from './OfferAnnouncement';
export function Header() {
  const { isArabic, toggleLanguage, wishlist, openCart, cartCount } = useStore();
  const { data, isDemo } = useContent();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  function handleSearch(event) {
    event.preventDefault();
    navigate(`/shop?${new URLSearchParams({ q: query })}`);
  }
  useEffect(() => {
    setIsMenuOpen(false);
    setIsSearchOpen(false);
  }, [location.pathname, location.search]);
  return (
    <>
      <OfferAnnouncement />
      <header>
        <BrandLogo />
        <nav className="nav">
          <Link to="/shop">{isArabic ? 'تسوق الكل' : 'Shop all'}</Link>
          {!isDemo ? (
            (data?.categories || []).slice(0, 2).map((c) => (
              <Link key={c.id} to={'/categories/' + c.slug}>
                {isArabic ? c.name_ar || c.name : c.name}
              </Link>
            ))
          ) : (
            <>
              <Link to="/collections/gym-wear">{isArabic ? 'ملابس التدريب' : 'Gym wear'}</Link>
              <Link to="/collections/sweatpants">
                {isArabic ? 'البناطيل الرياضية' : 'Sweatpants'}
              </Link>
            </>
          )}
          <Link to="/new-arrivals">
            {isArabic ? 'وصل حديثًا' : 'New arrivals'}
            <i className="nav-dot" />
          </Link>
          <Link to="/about">{isArabic ? 'عن EVOLVE' : 'Our story'}</Link>
        </nav>
        <div className="header-actions">
          <Link
            className="header-icon"
            to="/wishlist"
            aria-label={isArabic ? 'المفضلة' : 'Wishlist'}
          >
            <Heart size={19} />
            {wishlist.length > 0 && <span className="tiny-count">{wishlist.length}</span>}
          </Link>
          <Link
            className="header-icon account-link"
            to="/account"
            aria-label={isArabic ? 'حسابي' : 'My account'}
          >
            <User size={19} />
          </Link>
          <button
            className="language"
            onClick={toggleLanguage}
            aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            {isArabic ? 'EN' : 'AR'}
          </button>
          <button onClick={() => setIsSearchOpen((isOpen) => !isOpen)} aria-label="Search products">
            <Search size={20} />
          </button>
          <button className="bag" onClick={openCart} aria-label="Open shopping cart">
            <ShoppingBag size={20} />
            <span>{cartCount}</span>
          </button>
          <button
            className="menu-button"
            onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
            aria-label="Toggle navigation"
            aria-expanded={isMenuOpen}
            aria-controls="store-navigation"
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <NavigationDrawer isOpen={isMenuOpen} onClose={closeMenu} />
      {isSearchOpen && (
        <form className="search-panel" onSubmit={handleSearch}>
          <Search size={20} />
          <input
            autoFocus
            name="q"
            placeholder="Search your next essential…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search products"
          />
          <button className="button button-primary" type="submit">
            Search
          </button>
        </form>
      )}
    </>
  );
}
