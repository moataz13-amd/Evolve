import { useState, useCallback } from 'react';
import { Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Menu, Bell, Search, Plus } from 'lucide-react';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminNavDrawer } from '../components/AdminNavDrawer';
import { useAuth } from '../../context/AuthContext';
import { database, isConfigured } from '../../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { LoadingSkeleton, ErrorState } from '../components/UI';
import { Modal } from '../components/Modal';
export default function AdminLayout() {
  const { admin, session, loading, error, reload } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const [signoutPending, setSignoutPending] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [search, setSearch] = useState('');
  const [signoutError, setSignoutError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const alerts = useQuery({
    queryKey: ['admin', 'alerts'],
    queryFn: async () => {
      const { data, error } = await database().rpc('admin_overview', { p_days: 30 });
      if (error) throw error;
      return data.low_stock as { id: string; sku: string; stock: number }[];
    },
    enabled: !!admin,
  });
  if (!isConfigured) return <Navigate to="/admin/login" replace />;
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} retry={reload} />;
  if (!session) return <Navigate to="/admin/login" replace />;
  if (!admin)
    return (
      <div className="admin-access-denied">
        <h1>Team access required.</h1>
        <p>This account has no active admin profile. Ask your EVOLVE administrator for access.</p>
        <button onClick={() => void database().auth.signOut()}>Sign out</button>
      </div>
    );
  const title =
    location.pathname.replace('/admin', '').split('/').filter(Boolean).join(' / ') || 'Overview';
  async function signOut() {
    setSignoutPending(true);
    setSignoutError('');
    try {
      const result = await database().auth.signOut();
      if (result.error) throw result.error;
    } catch (failure) {
      setSignoutError(
        failure instanceof Error ? failure.message : 'Unable to sign out. Please try again.',
      );
    } finally {
      setSignoutPending(false);
    }
  }
  return (
    <div className={`admin-shell${collapsed ? ' admin-shell--collapsed' : ''}`} dir="ltr">
      <aside className="admin-sidebar" aria-label="EVOLVE operations sidebar">
        <AdminSidebar
          admin={admin}
          collapsed={collapsed}
          onCollapse={() => setCollapsed((value) => !value)}
          onSignOut={signOut}
          signoutPending={signoutPending}
          signoutError={signoutError}
        />
      </aside>
      {drawer && (
        <AdminNavDrawer onClose={closeDrawer}>
          {(close) => (
            <AdminSidebar
              admin={admin}
              mobile
              onClose={close}
              onNavigate={close}
              onSignOut={signOut}
              signoutPending={signoutPending}
              signoutError={signoutError}
            />
          )}
        </AdminNavDrawer>
      )}
      <div className="admin-main">
        <div className="admin-topbar">
          <button
            className="admin-icon admin-mobile-menu"
            aria-label="Open admin navigation"
            aria-expanded={drawer}
            aria-controls="admin-nav-drawer"
            onClick={() => setDrawer(true)}
          >
            <Menu size={20} />
          </button>
          <div className="admin-breadcrumb">
            Dashboard / <strong>{title}</strong>
          </div>
          <form
            className="admin-global-search"
            onSubmit={(event) => {
              event.preventDefault();
              navigate('/admin/search?q=' + encodeURIComponent(search));
            }}
          >
            <Search size={16} />
            <input
              aria-label="Search products, orders and customers"
              placeholder="Search the store…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <Link className="admin-button admin-primary admin-quick-add" to="/admin/products/new">
            <Plus size={16} />
            Add product
          </Link>
          <button
            className="admin-icon"
            aria-label="Inventory notifications"
            onClick={() => setNotifications(true)}
          >
            <Bell size={18} />
          </button>
        </div>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
      {notifications && (
        <Modal title="Inventory alerts" onClose={() => setNotifications(false)}>
          {alerts.isPending ? (
            <LoadingSkeleton />
          ) : alerts.isError ? (
            <ErrorState message={alerts.error.message} />
          ) : alerts.data?.length ? (
            alerts.data.map((row) => (
              <Link
                key={row.id}
                className="admin-alert-row"
                to={'/admin/inventory/' + row.id}
                onClick={() => setNotifications(false)}
              >
                {row.sku}
                <strong>{row.stock} remaining</strong>
              </Link>
            ))
          ) : (
            <p>No low-stock variants in this list.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
