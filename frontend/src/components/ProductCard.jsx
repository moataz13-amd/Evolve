import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatMoney } from '../utils/format';
import { colorValues } from '../data/products';
import { ProductBadge } from './ProductBadge';
export function ProductCard({ product }) {
  const { isArabic, wishlist, toggleWishlist } = useStore();
  const isSaved = wishlist.includes(product.id);
  return (
    <article className="product-card">
      <div className="product-photo">
        <Link to={'/product/' + product.id}>
          <img
            src={product.image}
            alt={isArabic ? product.ar : product.name}
            loading="lazy"
            width="800"
            height="1000"
          />
        </Link>
        <ProductBadge product={product} className="product-tag" />
        <button
          className={'save-product ' + (isSaved ? 'saved' : '')}
          aria-label={`${isSaved ? 'Remove from' : 'Add to'} wishlist: ${product.name}`}
          aria-pressed={isSaved}
          onClick={() => toggleWishlist(product.id)}
        >
          <Heart size={17} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <Link to={'/product/' + product.id} className="product-meta">
        <h3>{isArabic ? product.ar : product.name}</h3>
        <span className="product-price">
          {product.compareAtPrice > product.price && (
            <del>{formatMoney(product.compareAtPrice)}</del>
          )}
          {formatMoney(product.price)}
        </span>
      </Link>
      <div className="swatches">
        {product.colors.map((color) => (
          <i
            key={color}
            title={color}
            style={{ background: product.colorValues?.[color] || colorValues[color] }}
          />
        ))}
        <small>
          {product.colors.length} {isArabic ? 'ألوان' : 'colors'}
        </small>
        {!product.sizes.length && <small>{isArabic ? 'غير متوفر' : 'Sold out'}</small>}
      </div>
    </article>
  );
}
