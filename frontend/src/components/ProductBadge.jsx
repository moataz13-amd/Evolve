import { useStore } from '../context/StoreContext';
import { productBadges } from '../utils/productBadge';

export function ProductBadge({ product, className = '' }) {
  const { isArabic } = useStore();
  const badges = productBadges(product);

  if (!badges.length) return null;

  return (
    <span className={`product-badges ${className}`}>
      {badges.map((badge) => (
        <span
          key={`${badge.variant}:${badge.label}`}
          className={`product-badge product-badge--${badge.variant}`}
        >
          {isArabic ? badge.arabicLabel : badge.label}
        </span>
      ))}
    </span>
  );
}
