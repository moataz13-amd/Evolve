import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { database } from '../../lib/supabase';
import { saveRecord } from '../../services/admin.service';
import { throwIfError } from '../../services/result';
import { governorates } from '../../data/governorates';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, LoadingSkeleton, ErrorState } from '../components/UI';

function ShippingForm({ settings }: { settings: any }) {
  const client = useQueryClient();
  const [cairo, setCairo] = useState(String(settings.shipping_fee));
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      governorates
        .filter((item) => item.code !== 'cairo')
        .map((item) => [item.code, settings.shipping_rates?.[item.code]?.toString() ?? '']),
    ),
  );
  const save = useMutation({
    mutationFn: () =>
      saveRecord(
        'site_settings',
        {
          shipping_fee: Number(cairo),
          shipping_rates: Object.fromEntries(
            Object.entries(rates)
              .filter(([, value]) => value !== '')
              .map(([code, value]) => [code, Number(value)]),
          ),
          currency: 'EGP',
        },
        settings.id,
      ),
    onSuccess: () => void client.invalidateQueries(),
  });
  return (
    <form
      className="admin-form admin-card"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <p className="admin-notice">
        Prices are in Egyptian pounds (EGP). Cairo is the default shipping price. Leave any other
        governorate blank to use Cairo’s price. Existing free-shipping offers still apply.
      </p>
      <fieldset className="admin-form-fields" disabled={save.isPending}>
        <label>
          Cairo / القاهرة — default shipping (EGP)
          <input
            type="number"
            required
            min="0"
            max="1000000"
            step="0.01"
            value={cairo}
            onChange={(event) => {
              setCairo(event.target.value);
              save.reset();
            }}
          />
        </label>
        <div className="admin-form-grid">
          {governorates
            .filter((item) => item.code !== 'cairo')
            .map((item) => (
              <label key={item.code}>
                {item.name} / {item.nameAr}
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  value={rates[item.code]}
                  placeholder={`Cairo: ${cairo || '0'} EGP`}
                  onChange={(event) => {
                    setRates((current) => ({ ...current, [item.code]: event.target.value }));
                    save.reset();
                  }}
                />
              </label>
            ))}
        </div>
      </fieldset>
      {save.isError && (
        <p className="admin-error" role="alert">
          {save.error.message}
        </p>
      )}
      {save.isSuccess && (
        <p className="admin-notice" role="status">
          Shipping prices saved.
        </p>
      )}
      <button className="admin-button admin-primary" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save shipping prices'}
      </button>
    </form>
  );
}

export default function ShippingPage() {
  const { admin } = useAuth();
  const query = useQuery({
    queryKey: ['admin', 'shipping'],
    queryFn: async () =>
      throwIfError(
        await database().from('site_settings').select('id,shipping_fee,shipping_rates').single(),
      ),
    enabled: admin?.role === 'super_admin',
  });
  if (admin?.role !== 'super_admin')
    return <ErrorState message="The store owner manages shipping prices." />;
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError) return <ErrorState message={query.error.message} />;
  return (
    <>
      <PageHeader
        title="Shipping prices"
        subtitle="Delivery prices for all 27 Egyptian governorates."
      />
      <ShippingForm settings={query.data} />
    </>
  );
}
