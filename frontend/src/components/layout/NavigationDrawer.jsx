import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { clothingLinks, collectionLinks, featuredLinks, helpLinks } from '../../data/navigation';
import { useContent } from '../../context/ContentContext';

function NavigationGroup({ title, links }) {
  const { isArabic } = useStore();

  return (
    <div className="drawer-group">
      <h3>{title}</h3>
      {links.map((link) => (
        <Link
          key={link.label}
          to={link.to}
          className={link.accent ? 'drawer-link drawer-link--accent' : 'drawer-link'}
        >
          {isArabic ? link.arabicLabel : link.label}
          {link.badge && <span className="drawer-new">{isArabic ? 'جديد' : link.badge}</span>}
        </Link>
      ))}
    </div>
  );
}

export function NavigationDrawer({ isOpen, onClose }) {
  const { isArabic } = useStore();
  const { data, isDemo } = useContent();
  const categories = isDemo
    ? clothingLinks
    : [
        { label: 'All products', arabicLabel: 'كل المنتجات', to: '/shop' },
        ...(data?.categories || []).map((c) => ({
          label: c.name,
          arabicLabel: c.name_ar || c.name,
          to: '/categories/' + c.slug,
        })),
      ];
  const collections = isDemo
    ? collectionLinks
    : (data?.collections || []).map((c) => ({
        label: c.name,
        arabicLabel: c.name_ar || c.name,
        to: '/collections/' + c.slug,
      }));
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;

      const controls = panelRef.current.querySelectorAll('a[href], button:not(:disabled)');
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  return (
    <div
      className={`navigation-overlay${isOpen ? ' navigation-overlay--open' : ''}`}
      aria-hidden={!isOpen}
      inert={!isOpen}
      onClick={onClose}
    >
      <aside
        id="store-navigation"
        ref={panelRef}
        className="navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={isArabic ? 'قائمة المتجر' : 'Store navigation'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-heading">
          <span>EXPLORE EVOLVE</span>
          <button
            ref={closeButtonRef}
            aria-label={isArabic ? 'إغلاق القائمة' : 'Close navigation'}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <nav
          className="drawer-columns"
          aria-label={isArabic ? 'أقسام المتجر' : 'Shop categories'}
          onClick={(event) => {
            if (event.target.closest('a')) onClose();
          }}
        >
          <NavigationGroup title={isArabic ? 'الملابس' : 'CLOTHING'} links={categories} />
          <div>
            <NavigationGroup title={isArabic ? 'المجموعات' : 'COLLECTIONS'} links={collections} />
            <NavigationGroup title={isArabic ? 'مميز' : 'FEATURED'} links={featuredLinks} />
          </div>
        </nav>
        <div className="drawer-help">
          <Link to="/wishlist" onClick={onClose}>
            {isArabic ? 'المفضلة' : 'Wishlist'}
          </Link>
          {helpLinks.map((link) => (
            <Link key={link.label} to={link.to} onClick={onClose}>
              {isArabic ? link.arabicLabel : link.label}
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
