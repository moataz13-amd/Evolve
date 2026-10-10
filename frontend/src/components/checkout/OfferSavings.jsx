import { useStore } from '../../context/StoreContext';
import { formatMoney } from '../../utils/format';
import { quantityOfferLabel } from '../../utils/offers';

export function OfferSavings({ quote }) {
  const { isArabic } = useStore();
  if (!quote || !Number(quote.offer_discount)) return null;
  return (
    <div className="offer-savings" aria-live="polite">
      <strong>
        {isArabic ? 'توفير العروض' : 'Offer savings'}: {formatMoney(quote.offer_discount)}
      </strong>
      {quote.applied_offers?.map((offer) => (
        <p key={offer.id}>
          {quantityOfferLabel(offer, isArabic)} ·{' '}
          {isArabic ? `${offer.free_quantity} هدية` : `${offer.free_quantity} free`}
        </p>
      ))}
    </div>
  );
}
