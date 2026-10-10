import { Check } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { colorValues as sampleColorValues } from '../../data/products';
import { sizes } from '../../data/sizing';

const arabicColors = { Black: 'أسود', Stone: 'حجري', Olive: 'زيتوني' };

export function ProductOptions({
  product,
  selectedSize,
  selectedColor,
  onSizeChange,
  onColorChange,
  onOpenSizeGuide,
  hasSizeError,
}) {
  const { isArabic } = useStore();
  const colorValues = product.colorValues || sampleColorValues;
  const availableSizes = product.variants
    ? product.variants
        .filter(
          (variant) =>
            variant.active &&
            variant.color_name === selectedColor &&
            (!variant.track_quantity || variant.stock > 0),
        )
        .map((variant) => variant.size)
    : product.sizes;

  return (
    <>
      <div className="selection">
        <label>
          {isArabic ? 'اللون' : 'Color'} —{' '}
          {isArabic ? arabicColors[selectedColor] || selectedColor : selectedColor}
        </label>
        <div className="color-buttons">
          {product.colors.map((color) => (
            <button
              key={color}
              style={{ background: colorValues[color] }}
              className={selectedColor === color ? 'selected' : ''}
              onClick={() => onColorChange(color)}
              aria-label={color}
              aria-pressed={selectedColor === color}
            >
              {selectedColor === color && (
                <Check size={16} color={color === 'Stone' ? '#222' : 'white'} />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="selection">
        <div className="size-label">
          <label>
            {isArabic ? 'المقاس' : 'Size'} —{' '}
            {selectedSize || (isArabic ? 'اختر مقاسك' : 'Select your size')}
          </label>
          <button onClick={onOpenSizeGuide}>{isArabic ? 'دليل المقاسات' : 'Size guide'}</button>
        </div>
        <div className="size-buttons">
          {sizes.map((size) => (
            <button
              key={size}
              disabled={!availableSizes.includes(size)}
              className={selectedSize === size ? 'selected' : ''}
              onClick={() => onSizeChange(size)}
              aria-pressed={selectedSize === size}
            >
              {size}
            </button>
          ))}
        </div>
        {hasSizeError && (
          <p className="error" role="alert">
            {isArabic
              ? 'اختار المقاس الأول علشان تضيف المنتج للحقيبة.'
              : 'Choose a size to add this essential to your bag.'}
          </p>
        )}
      </div>
    </>
  );
}
