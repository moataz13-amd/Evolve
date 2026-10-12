import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { LoadingSkeleton } from './components/UI';
import AdminLayout from './layouts/AdminLayout';
import { resources, commerceResources } from './components/resources';
import './admin.css';
const Login = lazy(() => import('./pages/LoginPage'));
const Overview = lazy(() => import('./pages/OverviewPage'));
const Resource = lazy(() => import('./pages/ResourcePage'));
const ProductEditor = lazy(() => import('./pages/ProductEditorPage'));
const OrderDetail = lazy(() => import('./pages/OrderDetailPage'));
const Customer = lazy(() => import('./pages/CustomerPage'));
const Inventory = lazy(() => import('./pages/InventoryPage'));
const InventoryCatalog = lazy(() => import('./pages/InventoryCatalogPage'));
const Media = lazy(() => import('./pages/MediaPage'));
const Products = lazy(() => import('./pages/ProductsPage'));
const SectionEditor = lazy(() => import('./pages/SectionEditorPage'));
const HeroEditor = lazy(() => import('./pages/HeroEditorPage'));
const Profile = lazy(() => import('./pages/ProfilePage'));
const Search = lazy(() => import('./pages/SearchPage'));
const Shipping = lazy(() => import('./pages/ShippingPage'));
const OfferEditor = lazy(() => import('./pages/OfferEditorPage'));
export default function AdminApp() {
  return (
    <div className="admin-root" dir="ltr">
      <Suspense fallback={<LoadingSkeleton />}>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<AdminLayout />}>
            <Route index element={<Overview />} />
            <Route path="profile" element={<Profile />} />
            <Route path="shipping" element={<Shipping />} />
            <Route path="offers/:id" element={<OfferEditor />} />
            <Route path="search" element={<Search />} />
            <Route path="products" element={<Products />} />
            <Route path="inventory" element={<InventoryCatalog />} />
            {Object.keys({ ...resources, ...commerceResources })
              .filter((key) => key !== 'products' && key !== 'inventory')
              .map((key) => (
                <Route key={key} path={key} element={<Resource resourceKey={key} />} />
              ))}
            <Route path="products/new" element={<ProductEditor />} />
            <Route path="products/:id" element={<ProductEditor />} />
            <Route path="content/homepage/:id" element={<SectionEditor />} />
            <Route path="content/hero" element={<HeroEditor />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="customers/:id" element={<Customer />} />
            <Route path="inventory/:id" element={<Inventory />} />
            <Route path="media" element={<Media />} />
            <Route
              path="*"
              element={
                <div className="admin-empty">
                  <h1>Page not found</h1>
                  <a href="/admin">Back to overview</a>
                </div>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </div>
  );
}
