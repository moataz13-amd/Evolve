import { Select } from '../../components/Select';
import { useState } from 'react';
import type { Row } from '../../types/admin';
import {
  productColorOptions,
  suggestedColorName,
  clothingSizes,
  createVariant,
  addVariantCombinations,
  nextVariant,
} from '../../utils/catalogEditor';
export const newVariant = (): Row => createVariant();
export function VariantEditor({
  variants,
  onChange,
  canAdjust,
  savedIds = [],
  onSelectionChange,
}: {
  variants: Row[];
  onChange: (rows: Row[]) => void;
  canAdjust: boolean;
  savedIds?: string[];
  onSelectionChange: (
    selection: {
      sizes: string[];
      colors: { name: string; hex: string }[];
      stock: number;
    } | null,
  ) => void;
}) {
  const [sizes, setSizes] = useState(['M']);
  const [colors, setColors] = useState(['black']);
  const [stock, setStock] = useState(0);
  const [notice, setNotice] = useState('');
  const [bulkOpen, setBulkOpen] = useState(true);
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [colorName, setColorName] = useState('');
  const [colorHex, setColorHex] = useState('#808000');
  const [colorError, setColorError] = useState('');
  const palette = productColorOptions(variants);
  const automaticName = suggestedColorName(colorHex, palette);
  const validStock = Number.isInteger(stock) && stock >= 0;
  function selectCombinations(nextSizes: string[], nextColors: string[], nextStock = stock) {
    setSizes(nextSizes);
    setColors(nextColors);
    setStock(nextStock);
    onSelectionChange({
      sizes: nextSizes,
      colors: palette.filter((color) => nextColors.includes(color.name.toLowerCase())),
      stock: canAdjust ? nextStock : 0,
    });
    setNotice('Your selected sizes and colors will be included when you save the product.');
  }
  function addColor() {
    const name = colorName.trim() || automaticName;
    if (!/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
      setColorError('Enter a HEX color such as #808000.');
      return;
    }
    if (
      colorName.trim() &&
      palette.some((color) => color.name.toLowerCase() === name.toLowerCase())
    ) {
      setColorError('This color already exists. Select it above to add more sizes.');
      return;
    }
    if (!sizes.length || !validStock) {
      setColorError('Select at least one size and enter valid stock.');
      return;
    }
    const next = addVariantCombinations(
      variants,
      sizes,
      [{ name, hex: colorHex.toLowerCase() }],
      canAdjust ? stock : 0,
    );
    onChange(next);
    setColors((current) =>
      current.includes(name.toLowerCase()) ? current : [...current, name.toLowerCase()],
    );
    setColorName('');
    setColorError('');
    setColorEditorOpen(false);
    setNotice(
      `${name}: ${next.length - variants.length} combinations added. Save the product to keep your changes.`,
    );
  }
  function patch(index: number, key: string, value: unknown) {
    onChange(variants.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }
  return (
    <section className="admin-form-section">
      <div className="admin-card-heading">
        <div>
          <h2>3. Sizes & colors</h2>
          <p>
            Choose multiple sizes and colors, then save the product to create every combination.
          </p>
        </div>
        <button
          type="button"
          className="admin-button"
          onClick={() => {
            const next = nextVariant(variants);
            if (next) onChange([...variants, next]);
            else setNotice('All current size and color combinations exist. Add a new color above.');
          }}
        >
          Add one variant
        </button>
      </div>
      <details
        className="admin-advanced"
        open={bulkOpen}
        onToggle={(event) => setBulkOpen(event.currentTarget.open)}
      >
        <summary>Add multiple sizes & colors</summary>
        <div className="admin-advanced-body">
          <fieldset>
            <legend>Sizes</legend>
            <div className="admin-checkbox-grid">
              {clothingSizes.map((size) => (
                <label className="admin-check-label" key={size}>
                  <input
                    type="checkbox"
                    checked={sizes.includes(size)}
                    onChange={(e) =>
                      selectCombinations(
                        e.target.checked
                          ? [...sizes, size]
                          : sizes.filter((value) => value !== size),
                        colors,
                      )
                    }
                  />
                  {size}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Stock for each new combination
            <input
              type="number"
              min={0}
              step={1}
              value={stock}
              disabled={!canAdjust}
              onChange={(e) => selectCombinations(sizes, colors, Number(e.target.value))}
            />
          </label>
          <fieldset>
            <legend>Colors</legend>
            <div className="admin-checkbox-grid">
              {palette.map((color) => (
                <label className="admin-check-label" key={color.name}>
                  <input
                    type="checkbox"
                    checked={colors.includes(color.name.toLowerCase())}
                    onChange={(e) =>
                      selectCombinations(
                        sizes,
                        e.target.checked
                          ? [...colors, color.name.toLowerCase()]
                          : colors.filter((value) => value !== color.name.toLowerCase()),
                      )
                    }
                  />
                  <span className="admin-color-dot" style={{ background: color.hex }} />
                  {color.name}
                </label>
              ))}
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  setColorEditorOpen(true);
                  setColorError('');
                }}
              >
                Add color
              </button>
            </div>
            {colorEditorOpen && (
              <div
                className="admin-new-color"
                onKeyDown={(event) => {
                  const target = event.target as HTMLInputElement;
                  if (
                    event.key === 'Enter' &&
                    target.tagName === 'INPUT' &&
                    target.type !== 'color'
                  ) {
                    event.preventDefault();
                    addColor();
                  }
                }}
              >
                <div className="admin-form-grid">
                  <label>
                    Color name (optional)
                    <input
                      value={colorName}
                      placeholder={automaticName || 'Generated from your shade'}
                      maxLength={80}
                      aria-invalid={!!colorError}
                      onChange={(event) => {
                        setColorName(event.target.value);
                        setColorError('');
                      }}
                    />
                    <small className="admin-muted">Leave blank to use the suggested name.</small>
                  </label>
                  <div className="admin-field">
                    <label htmlFor="new-color-hex">Color shade</label>
                    <div className="admin-color-inputs">
                      <input
                        type="color"
                        aria-label="Choose new color shade"
                        value={/^#[0-9a-fA-F]{6}$/.test(colorHex) ? colorHex : '#808000'}
                        onChange={(event) => {
                          setColorHex(event.target.value);
                          setColorError('');
                        }}
                      />
                      <input
                        id="new-color-hex"
                        value={colorHex}
                        placeholder="#808000"
                        maxLength={7}
                        dir="ltr"
                        onChange={(event) => {
                          setColorHex(event.target.value);
                          setColorError('');
                        }}
                      />
                    </div>
                  </div>
                </div>
                {automaticName && !colorName.trim() && (
                  <p className="admin-suggested-color" role="status">
                    <span className="admin-color-dot" style={{ background: colorHex }} />
                    Suggested name: <strong>{automaticName}</strong>
                  </p>
                )}
                <p>
                  This color will be added for the sizes selected above, using the new-combination
                  stock entered above.
                </p>
                {colorError && (
                  <p className="admin-error" role="alert">
                    {colorError}
                  </p>
                )}
                <div className="admin-actions">
                  <button type="button" className="admin-button" onClick={addColor}>
                    Add color & sizes
                  </button>
                  <button
                    type="button"
                    className="admin-text-action"
                    onClick={() => {
                      setColorEditorOpen(false);
                      setColorError('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </fieldset>
          <button
            type="button"
            className="admin-button"
            disabled={!sizes.length || !colors.length || !validStock}
            onClick={() => {
              const next = addVariantCombinations(
                variants,
                sizes,
                palette.filter((color) => colors.includes(color.name.toLowerCase())),
                canAdjust ? stock : 0,
              );
              onChange(next);
              onSelectionChange(null);
              setNotice(
                `${next.length - variants.length} combinations added. Existing stock and variants were kept.`,
              );
            }}
          >
            Create combinations
          </button>
          {notice && <p role="status">{notice}</p>}
        </div>
      </details>
      {!canAdjust && <p className="admin-muted">An administrator manages stock quantities.</p>}
      {variants.map((row, index) => (
        <div className={`admin-variant${row.active ? '' : ' admin-variant-inactive'}`} key={row.id}>
          <div className="admin-card-heading">
            <strong>
              {row.size} / {row.color_name}
              {!row.active && ' · Inactive'}
            </strong>
            <button
              type="button"
              className="admin-text-action"
              onClick={() => patch(index, 'active', !row.active)}
            >
              {row.active ? 'Deactivate' : 'Activate'}
            </button>
            {!savedIds.includes(row.id) && variants.length > 1 && (
              <button
                type="button"
                className="admin-text-action admin-danger"
                onClick={() => onChange(variants.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            )}
          </div>
          <div className="admin-variant-basics">
            <label>
              Size
              <Select value={row.size} onChange={(e) => patch(index, 'size', e.target.value)}>
                {clothingSizes.map((size) => (
                  <option key={size}>{size}</option>
                ))}
              </Select>
            </label>
            <label>
              Color
              <input
                value={row.color_name}
                onChange={(e) => patch(index, 'color_name', e.target.value)}
              />
            </label>
            <label>
              Stock
              <input
                type="number"
                min={0}
                step={1}
                disabled={!canAdjust}
                value={row.stock}
                onChange={(e) => patch(index, 'stock', Number(e.target.value))}
              />
            </label>
          </div>
          <details className="admin-advanced">
            <summary>Variant options</summary>
            <div className="admin-form-grid admin-advanced-body">
              <label>
                SKU (generated automatically)
                <input value={row.sku} onChange={(e) => patch(index, 'sku', e.target.value)} />
              </label>
              <label>
                Color swatch
                <input
                  type="color"
                  value={row.color_hex}
                  onChange={(e) => patch(index, 'color_hex', e.target.value)}
                />
              </label>
              <label>
                Low stock alert
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={row.low_stock_threshold}
                  onChange={(e) => patch(index, 'low_stock_threshold', Number(e.target.value))}
                />
              </label>
              <label>
                Different price (optional)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Use product price"
                  value={row.price_override ?? ''}
                  onChange={(e) =>
                    patch(
                      index,
                      'price_override',
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                />
                <small className="admin-muted">Leave blank to use the product's main price.</small>
              </label>
              <label className="admin-check-label">
                <input
                  type="checkbox"
                  checked={row.track_quantity}
                  onChange={(e) => patch(index, 'track_quantity', e.target.checked)}
                />
                Track stock
              </label>
            </div>
          </details>
        </div>
      ))}
    </section>
  );
}
