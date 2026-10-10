import { Select } from '../Select';
import { X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useContent } from '../../context/ContentContext';
import { formatMoney } from '../../utils/format';

export function FilterPanel({ filters, onClose }) {
  const { isArabic } = useStore();
  const { data, isDemo } = useContent();
  const {
    category,
    setCategory,
    selectedSize,
    setSelectedSize,
    selectedColor,
    setSelectedColor,
    maxPrice,
    setMaxPrice,
    resetFilters,
  } = filters;

  return (
    <aside className="filters">
      <div>
        <h3>Refine your rotation</h3>
        <button aria-label="Close filters" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <label>
        {isArabic ? 'القسم' : 'Category'}
        <Select
          disabled={filters.categoryLocked}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">All categories</option>
          {(isDemo
            ? ['Gym wear', 'Sweatpants'].map((name) => ({ name, slug: name }))
            : data?.categories || []
          ).map((item) => (
            <option key={item.slug} value={item.slug}>
              {isArabic ? item.name_ar || item.name : item.name}
            </option>
          ))}
        </Select>
      </label>
      <label>
        {isArabic ? 'المقاس' : 'Size'}
        <Select value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)}>
          <option value="">All sizes</option>
          {filters.availableSizes.map((size) => (
            <option key={size}>{size}</option>
          ))}
        </Select>
      </label>
      <label>
        {isArabic ? 'اللون' : 'Color'}
        <Select value={selectedColor} onChange={(event) => setSelectedColor(event.target.value)}>
          <option value="">All colors</option>
          {filters.availableColors.map((color) => (
            <option key={color}>{color}</option>
          ))}
        </Select>
      </label>
      <label>
        {isArabic ? 'أعلى سعر' : 'Maximum price'}: {formatMoney(maxPrice)}
        <input
          type="range"
          min="0"
          max={filters.priceCeiling}
          value={maxPrice}
          onChange={(event) => setMaxPrice(Number(event.target.value))}
        />
      </label>
      <button className="text-link" onClick={resetFilters}>
        {isArabic ? 'مسح الفلاتر' : 'Clear all filters'}
      </button>
    </aside>
  );
}
