import { Link, NavLink } from 'react-router-dom';
import {
  BarChart3,
  Package,
  Layers,
  Tags,
  Boxes,
  ShoppingBag,
  Users,
  LayoutTemplate,
  Image,
  CircleHelp,
  BookOpen,
  Ticket,
  Mail,
  Settings,
  PanelLeft,
  Power,
  UserRound,
  ShieldCheck,
  X,
} from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';
import brandMark from '../../assets/EvolveFavicon.svg';
import type { Role } from '../../types/admin';

const groups = [
  { title: '', items: [['Overview', '', BarChart3]] },
  {
    title: 'Commerce',
    items: [
      ['Products', 'products', Package],
      ['Categories', 'categories', Tags],
      ['Collections', 'collections', Layers],
      ['Inventory', 'inventory', Boxes],
      ['Orders', 'orders', ShoppingBag],
      ['Shipping prices', 'shipping', Boxes],
      ['Customers', 'customers', Users],
    ],
  },
  {
    title: 'Content',
    items: [
      ['Hero section', 'content/hero', Image],
      ['Homepage', 'content/homepage', LayoutTemplate],
      ['Banners', 'content/banners', Image],
      ['FAQ', 'content/faq', CircleHelp],
      ['Story', 'content/story', BookOpen],
    ],
  },
  {
    title: 'Marketing',
    items: [
      ['Product offers', 'offers', Ticket],
      ['Offer types', 'offer-types', Ticket],
      ['Promo codes', 'promotions', Ticket],
      ['Newsletter', 'newsletter', Mail],
    ],
  },
  {
    title: 'System',
    items: [
      ['Media', 'media', Image],
      ['Settings', 'settings', Settings],
      ['Team', 'team', ShieldCheck],
      ['Your profile', 'profile', UserRound],
    ],
  },
] as const;

type SidebarProps = {
  admin: { name: string; role: Role };
  collapsed?: boolean;
  mobile?: boolean;
  onCollapse?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
  onSignOut: () => void;
  signoutPending?: boolean;
  signoutError?: string;
};

export function AdminSidebar({
  admin,
  collapsed = false,
  mobile = false,
  onCollapse,
  onNavigate,
  onClose,
  onSignOut,
  signoutPending,
  signoutError,
}: SidebarProps) {
  const compact = collapsed && !mobile;
  return (
    <div className={`admin-sidebar-panel${compact ? ' admin-sidebar-panel--compact' : ''}`}>
      <div className="admin-sidebar-brand">
        {compact ? (
          <Link to="/admin" className="admin-brand-mark" aria-label="EVOLVE dashboard">
            <img src={brandMark} alt="" width="34" height="34" />
          </Link>
        ) : (
          <div>
            <BrandLogo light />
            <span className="admin-sidebar-caption">STORE OPERATIONS</span>
          </div>
        )}
        {mobile ? (
          <button
            type="button"
            className="admin-sidebar-control"
            aria-label="Close admin navigation"
            onClick={onClose}
          >
            <X size={19} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="admin-sidebar-control admin-collapse"
            aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!compact}
            aria-controls="admin-desktop-navigation"
            title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={onCollapse}
          >
            <PanelLeft size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      <nav
        className="admin-sidebar-navigation"
        id={mobile ? 'admin-mobile-navigation' : 'admin-desktop-navigation'}
        aria-label="Dashboard navigation"
      >
        {groups.map((group) => {
          const items = group.items.filter(([, path]) => {
            if (
              admin.role === 'editor' &&
              ['orders', 'customers', 'offers', 'offer-types', 'promotions', 'newsletter'].includes(
                path,
              )
            )
              return false;
            return !['settings', 'team', 'shipping'].includes(path) || admin.role === 'super_admin';
          });
          if (!items.length) return null;
          return (
            <div className="admin-nav-group" key={group.title}>
              {group.title && <span className="admin-nav-label">{group.title}</span>}
              {items.map(([label, path, Icon]) => (
                <NavLink
                  key={path}
                  to={path ? `/admin/${path}` : '/admin'}
                  end={!path}
                  aria-label={label}
                  title={compact ? label : undefined}
                  onClick={onNavigate}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="admin-sidebar-bottom">
        <Link
          className="admin-sidebar-account"
          to="/admin/profile"
          onClick={onNavigate}
          aria-label={`${admin.name}, your profile`}
          title={compact ? admin.name : undefined}
        >
          <span className="admin-sidebar-avatar" aria-hidden="true">
            {admin.name.trim().slice(0, 1).toUpperCase() || 'E'}
          </span>
          <div>
            <strong>{admin.name}</strong>
            <small>{admin.role.replaceAll('_', ' ')}</small>
          </div>
        </Link>
        <button
          type="button"
          className="admin-sidebar-signout"
          disabled={signoutPending}
          onClick={onSignOut}
          aria-label={signoutPending ? 'Signing out' : 'Sign out'}
          title={compact ? 'Sign out' : undefined}
        >
          <Power size={17} aria-hidden="true" />
          <span>{signoutPending ? 'Signing out…' : 'Sign out'}</span>
        </button>
        {signoutError && (
          <p className="admin-sidebar-error" role="alert">
            {signoutError}
          </p>
        )}
      </div>
    </div>
  );
}
