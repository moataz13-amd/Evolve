import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { database } from '../../lib/supabase';
import { saveRecord } from '../../services/admin.service';
import { throwIfError } from '../../services/result';
import { useAuth } from '../../context/AuthContext';
import { resources } from '../components/resources';
import { RecordForm } from '../components/RecordForm';
import { PageHeader, LoadingSkeleton, ErrorState } from '../components/UI';
import { formatMoney } from '../../utils/format';
import { offerPrice, quantityOfferLabel } from '../../utils/offers';
import type { Row } from '../../types/admin';

function CreateOffer() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const create = useMutation({
    mutationFn: (values: Record<string, unknown>) => saveRecord('offers', values),
    onSuccess: (offer) => {
      void client.invalidateQueries();
      navigate(`/admin/offers/${offer.id}`, { replace: true });
    },
  });
  return (
    <>
      <PageHeader
        title="Add offer"
        subtitle="Create another offer with its own settings and products."
      >
        <Link className="admin-button" to="/admin/offers">
          All offers
        </Link>
        <Link className="admin-button" to="/admin/offer-types">
          Manage offer types
        </Link>
      </PageHeader>
      <section className="admin-card">
        <h2>Offer settings</h2>
        <p className="admin-muted">
          Save your offer, then choose the products it applies to. You can create multiple offers
          and activate or deactivate each one independently.
        </p>
        {create.isError && (
          <p className="admin-error" role="alert">
            {create.error.message}
          </p>
        )}
        <RecordForm
          resource={resources.offers}
          pending={create.isPending}
          onSave={(values) => create.mutate(values)}
        />
      </section>
    </>
  );
}

function OfferProducts({ offer }: { offer: Row }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<string[]>(
    offer.offer_products.map((link: any) => link.product_id),
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin', 'offer-catalog', search, page],
    queryFn: async () =>
      throwIfError(await database().rpc('admin_catalog', { p_filters: { q: search, page } })),
  });
  const chosen = useQuery({
    queryKey: ['admin', 'offer-selected', selected],
    queryFn: async () =>
      throwIfError(
        await database().from('products').select('id,name,price,active').in('id', selected),
      ),
    enabled: selected.length > 0,
  });
  const save = useMutation({
    mutationFn: async () =>
      throwIfError(
        await database().rpc('set_offer_products', { p_offer: offer.id, p_products: selected }),
      ),
    onSuccess: () => void client.invalidateQueries(),
  });
  const metadata = useMutation({
    mutationFn: (values: Record<string, unknown>) => saveRecord('offers', values, offer.id),
    onSuccess: () => {
      void client.invalidateQueries();
    },
  });
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    save.reset();
  }
  return (
    <>
      <PageHeader
        title={offer.name}
        subtitle="Choose the products that receive this automatic offer. Drafts receive it once published."
      >
        <Link to="/admin/offers" className="admin-button">
          All offers
        </Link>
        <Link to="/admin/offers/new" className="admin-button">
          Add another offer
        </Link>
        <a className="admin-button" href="#offer-settings">
          Offer type & settings
        </a>
        <button
          className="admin-button admin-primary"
          disabled={save.isPending || selected.length > 1000}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save selected products'}
        </button>
      </PageHeader>
      <p className="admin-notice">
        {offer.offer_types?.name && (
          <>
            <strong>{offer.offer_types.name}</strong> ·{' '}
          </>
        )}
        {offer.discount_type === 'buy_get'
          ? quantityOfferLabel(offer)
          : offer.discount_type === 'percentage'
            ? `${offer.discount_value}%`
            : `${formatMoney(offer.discount_value)} off each item`}{' '}
        · {offer.active ? 'Active' : 'Inactive'} · {selected.length} products selected. An offer
        with no selected products applies to none.
      </p>
      {save.isError && (
        <p role="alert" className="admin-error">
          {save.error.message}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="admin-notice">
          Selected products saved.
        </p>
      )}
      <section className="admin-card" id="offer-settings">
        <h2>Offer type & settings</h2>
        <p className="admin-muted">
          Choose the offer type and set its values below. Changing the type keeps your selected
          products. Save these settings separately from your product selection.
        </p>
        <RecordForm
          key={offer.updated_at}
          resource={resources.offers}
          record={offer}
          pending={metadata.isPending}
          onSave={(values) => metadata.mutate(values)}
        />
        {metadata.isError && (
          <p role="alert" className="admin-error">
            {metadata.error.message}
          </p>
        )}
        {metadata.isSuccess && (
          <p role="status" className="admin-notice">
            Offer type and settings saved.
          </p>
        )}
      </section>
      <section className="admin-card">
        <label>
          Search products
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Product name or SKU"
          />
        </label>
        {query.isPending ? (
          <LoadingSkeleton />
        ) : query.isError ? (
          <ErrorState message={query.error.message} />
        ) : (
          <>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Price with this offer</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data?.rows.map((product: Row) => (
                    <tr key={product.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Include ${product.name} in offer`}
                          checked={selected.includes(product.id)}
                          onChange={() => toggle(product.id)}
                        />
                      </td>
                      <td>
                        {product.name}
                        {!product.active && ' · Draft'}
                      </td>
                      <td>{formatMoney(product.price)}</td>
                      <td>
                        {offer.discount_type === 'buy_get'
                          ? 'Calculated in the bag'
                          : formatMoney(
                              offerPrice(product.price, [
                                { ...offer, active: true, starts_at: null, ends_at: null },
                              ]).price,
                            )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-actions">
              <button
                className="admin-button"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                className="admin-button"
                disabled={page * 20 >= (query.data?.count || 0)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
      <section className="admin-card">
        <h2>Selected products ({selected.length})</h2>
        <button
          className="admin-button"
          onClick={() => {
            setSelected([]);
            save.reset();
          }}
        >
          Clear selection
        </button>
        {chosen.isError && selected.length > 0 && <p role="alert">{chosen.error.message}</p>}
        <div className="admin-checkbox-grid">
          {selected.length > 0 &&
            chosen.data?.map((product: any) => (
              <button
                key={product.id}
                className="admin-button"
                aria-label={`Remove ${product.name} from offer`}
                onClick={() => toggle(product.id)}
              >
                {product.name} ×
              </button>
            ))}
        </div>
      </section>
    </>
  );
}

export default function OfferEditorPage() {
  const { id } = useParams();
  const { admin } = useAuth();
  const canManage = admin?.role === 'admin' || admin?.role === 'super_admin';
  const query = useQuery({
    queryKey: ['admin', 'offer', id],
    queryFn: async () =>
      throwIfError(
        await database()
          .from('offers')
          .select('*,offer_products(product_id),offer_types(name,name_ar)')
          .eq('id', id!)
          .single(),
      ),
    enabled: canManage && id !== 'new',
  });
  if (!canManage) return <ErrorState message="An administrator manages product offers." />;
  if (id === 'new') return <CreateOffer />;
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError) return <ErrorState message={query.error.message} />;
  return <OfferProducts key={query.data.id} offer={query.data} />;
}
