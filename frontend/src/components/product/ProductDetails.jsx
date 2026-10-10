import { useState } from 'react';
import { Heart, Plus } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatMoney } from '../../utils/format';
import { descriptions } from '../../data/translations';
import { ProductOptions } from './ProductOptions';
import { ProductBadge } from '../ProductBadge';
import { useContent } from '../../context/ContentContext';
import { DeliveryEstimate } from './DeliveryEstimate';
import { quantityOfferLabel } from '../../utils/offers';
import { matchesProductTag } from '../../utils/catalogPlacement';

export function ProductDetails({ product, onOpenSizeGuide }) {
  const { isArabic, addToCart, wishlist, toggleWishlist } = useStore();
  const { isDemo } = useContent();
  const [cartError, setCartError] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState(product.colors[0]);
  const [hasSizeError, setHasSizeError] = useState(false);
  const comingSoon = matchesProductTag(product, 'COMING_SOON');
  const isSaved = wishlist.includes(product.id);
  const selectedVariant = product.variants?.find(
    (variant) => variant.size === selectedSize && variant.color_name === selectedColor,
  );
  const price = selectedVariant?.price_override ?? product.price;
  const compareAtPrice = selectedVariant?.compare_at_price ?? product.compareAtPrice;
  const deliveryAvailable = product.variants
    ? product.variants.some(
        (variant) =>
          variant.active &&
          variant.color_name === selectedColor &&
          (!selectedSize || variant.size === selectedSize) &&
          (!variant.track_quantity || variant.stock > 0),
      )
    : product.sizes.length > 0;
  const isAvailable = !comingSoon && deliveryAvailable;
  const addLabel = isArabic ? 'أضف إلى الحقيبة' : 'Add to bag';
  const unavailableLabel = isArabic ? 'غير متوفر' : 'Out of stock';
  const saveLabel = isArabic ? 'احفظ في المفضلة' : 'Save to wishlist';
  const savedLabel = isArabic ? 'محفوظ في المفضلة' : 'Saved to your wishlist';

  function handleSizeChange(size) {
    setSelectedSize(size);
    setHasSizeError(false);
  }

  function handleAddToCart() {
    if (!selectedSize) {
      setHasSizeError(true);
      return;
    }
    try {
      addToCart(product, selectedSize, selectedColor);
      setCartError('');
    } catch (error) {
      setCartError(error.message);
    }
  }

  return (
    <div className="detail-info">
      <span className="eyebrow">EVOLVE / {product.category.toUpperCase()}</span>
      <ProductBadge product={product} className="detail-badge" />
      <h1>{isArabic ? product.ar : product.name}</h1>
      <span className="detail-price">
        {compareAtPrice > price && <del>{formatMoney(compareAtPrice)}</del>}
        {formatMoney(price)}
      </span>
      {product.quantityOffers?.map((offer) => (
        <div className="product-quantity-offer" key={offer.id}>
          <strong>{quantityOfferLabel(offer, isArabic)}</strong>
          <p>
            {isArabic
              ? `أضف ${Number(offer.buy_quantity) + Number(offer.get_quantity)} قطع من منتجات العرض للسلة، بما فيها الهدية. أقل القطع سعرًا هدية، ويمكنك اختيار ألوان ومقاسات مختلفة.`
              : `Add ${Number(offer.buy_quantity) + Number(offer.get_quantity)} eligible pieces, including the gift, to your bag. The cheapest pieces are free. Mix sizes and colors.`}
          </p>
        </div>
      ))}
      <p>
        {isArabic
          ? product.descriptionAr || descriptions[product.id] || product.description
          : product.description}
      </p>
      {cartError && (
        <p role="alert" className="admin-error">
          {cartError}
        </p>
      )}
      <ProductOptions
        product={product}
        selectedSize={selectedSize}
        selectedColor={selectedColor}
        onSizeChange={handleSizeChange}
        onColorChange={(color) => {
          setSelectedColor(color);
          setSelectedSize('');
          setCartError('');
        }}
        onOpenSizeGuide={onOpenSizeGuide}
        hasSizeError={hasSizeError}
      />
      <button
        className="button button-primary add-button"
        disabled={!isAvailable}
        onClick={handleAddToCart}
      >
        {comingSoon
          ? isArabic
            ? 'قريبًا'
            : 'Coming soon'
          : isAvailable
            ? addLabel
            : unavailableLabel}
        <Plus size={18} />
      </button>
      <button
        className="detail-wishlist"
        onClick={() => toggleWishlist(product.id)}
        aria-pressed={isSaved}
      >
        <Heart size={17} fill={isSaved ? 'currentColor' : 'none'} />
        {isSaved ? savedLabel : saveLabel}
      </button>
      {isDemo && (
        <small className="demo-note">
          {isArabic
            ? 'متجر تجريبي. لا يتم دفع أو شراء فعلي.'
            : 'Demo storefront. No payment or orders are processed.'}
        </small>
      )}
      <DeliveryEstimate available={!comingSoon && deliveryAvailable} />
      {isDemo && (
        <>
          <details open>
            <summary>{isArabic ? 'تفاصيل المنتج' : 'Product details'}</summary>
            <p>
              {isArabic
                ? 'قصّة رياضية تناسب كل يوم. راجع دليل المقاسات قبل الاختيار. المواصفات في هذه النسخة تجريبية.'
                : 'Designed with an athletic everyday fit. Check the sample size guide before choosing. This demo uses sample product specifications.'}
            </p>
          </details>
          <details>
            <summary>{isArabic ? 'الخامة والعناية' : 'Care & materials'}</summary>
            <p>
              {isArabic
                ? 'إرشادات تجريبية: غسيل بارد مع ألوان مشابهة وتجفيف في الهواء. اتبع ملصق المنتج لمعرفة تعليمات العناية النهائية.'
                : 'Sample care guidance: wash cold with similar colors and air dry. Refer to the garment label for final material and care instructions.'}
            </p>
          </details>
        </>
      )}
    </div>
  );
}
