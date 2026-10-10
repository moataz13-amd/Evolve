import { Select } from '../../components/Select';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { options } from '../../services/admin.service';

export const offerCalculations = {
  percentage: 'Percentage (%)',
  fixed: 'Amount off each item (EGP)',
  buy_get: 'Buy X, get Y free / اشتري وخد هدية',
};

export function OfferTypeSelect({
  calculation,
  typeId,
  onChange,
}: {
  calculation: string;
  typeId: string | null;
  onChange: (calculation: string, typeId: string | null) => void;
}) {
  const query = useQuery({
    queryKey: ['options', 'offer_types'],
    queryFn: () => options('offer_types'),
  });
  return (
    <>
      <Select
        id="field-discount_type"
        value={typeId ? `custom:${typeId}` : calculation}
        onChange={(event) => {
          const custom = query.data?.find((row) => `custom:${row.id}` === event.target.value);
          onChange(custom?.calculation || event.target.value, custom?.id || null);
        }}
      >
        <optgroup label="Standard types">
          {Object.entries(offerCalculations).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Your offer types">
          {query.data
            ?.filter((row) => row.active || row.id === typeId)
            .map((row) => (
              <option key={row.id} value={`custom:${row.id}`}>
                {row.name}
                {row.name_ar ? ` / ${row.name_ar}` : ''}
                {!row.active ? ' (Inactive)' : ''}
              </option>
            ))}
          {typeId && !query.data?.some((row) => row.id === typeId) && (
            <option value={`custom:${typeId}`}>Current custom type</option>
          )}
        </optgroup>
      </Select>
      {query.isPending && <small role="status">Loading your offer types…</small>}
      {query.isError && (
        <small className="admin-error" role="alert">
          {query.error.message}
        </small>
      )}
      <Link className="admin-text-action" to="/admin/offer-types">
        Add or manage offer types
      </Link>
    </>
  );
}
