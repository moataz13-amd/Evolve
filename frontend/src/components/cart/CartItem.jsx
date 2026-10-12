import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatMoney } from '../../utils/format';
import { cartStockStatus } from '../../utils/cartStock';

export function CartItem({ item, pricing, variant, stockReady }) {
  const { isArabic, closeCart, updateQuantity, removeFromCart } = useStore();
  const [quantityInput, setQuantityInput] = useState(String(item.qty));
  const [quantityError, setQuantityError] = useState(false);
  const stock = stockReady ? cartStockStatus(item, variant) : null;
  const maxQuantity = stock?.remaining;
  const isOut = stock?.kind === 'out';

  useEffect(() => {
    setQuantityInput(String(item.qty));
    setQuantityError(false);
  }, [item.qty]);

  function changeQuantity(value) {
    if (!/^\d*$/.test(value)) return;
    setQuantityInput(value);
    const quantity = Number(value);
    if (!value || quantity < 1) {
      setQuantityError(false);
      return;
    }
    if (maxQuantity !== null && maxQuantity !== undefined && quantity > maxQuantity) {
      setQuantityError(true);
      return;
    }
    setQuantityError(false);
    updateQuantity(item.key, quantity);
  }

  function finishQuantity() {
    if (quantityError && maxQuantity > 0) {
      updateQuantity(item.key, maxQuantity);
      setQuantityInput(String(maxQuantity));
    } else {
      setQuantityInput(String(item.qty));
    }
    setQuantityError(false);
  }

  return (
    <div className="cart-item">
      <img src={item.image} alt={item.name} width="90" height="110" />
      <div>
        <Link onClick={closeCart} to={`/product/${item.id}`}>
          {isArabic ? item.ar : item.name}
        </Link>
        <p>
          {item.color} / {item.size}
        </p>
        <strong>{formatMoney(pricing?.unit_price ?? item.price)}</strong>
        {!!pricing?.free_quantity && (
          <p className="offer-gift">
            {isArabic
              ? `منها ${pricing.free_quantity} هدية`
              : `${pricing.free_quantity} free in this line`}
          </p>
        )}
        {stock?.kind === 'out' && (
          <p className="cart-stock cart-stock-out" role="status">
            {isArabic
              ? 'نفد هذا المقاس واللون — المتبقي 0. احذفه من الحقيبة.'
              : 'This size and color are out of stock — 0 left. Remove this item.'}
          </p>
        )}
        {(stock?.kind === 'low' || stock?.kind === 'exceeded') && (
          <p className="cart-stock cart-stock-low" role="status">
            {isArabic
              ? `باقي ${stock.remaining} قطع فقط من هذا المقاس واللون.`
              : `Only ${stock.remaining} left in this size and color.`}
            {stock.kind === 'exceeded' &&
              (isArabic ? ' قلل الكمية لإتمام الطلب.' : ' Reduce your quantity to check out.')}
          </p>
        )}
        <div className="quantity">
          <button
            aria-label={
              isArabic ? `قلل عدد ${item.ar || item.name}` : `Decrease ${item.name} quantity`
            }
            disabled={item.qty <= 1 || isOut}
            onClick={() => updateQuantity(item.key, item.qty - 1)}
          >
            <Minus size={14} />
          </button>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={quantityInput}
            aria-label={isArabic ? `عدد قطع ${item.ar || item.name}` : `Quantity of ${item.name}`}
            aria-invalid={quantityError}
            disabled={isOut}
            onChange={(event) => changeQuantity(event.target.value)}
            onBlur={finishQuantity}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <button
            aria-label={
              isArabic ? `زود عدد ${item.ar || item.name}` : `Increase ${item.name} quantity`
            }
            disabled={
              isOut ||
              (maxQuantity !== null && maxQuantity !== undefined && item.qty >= maxQuantity)
            }
            onClick={() => updateQuantity(item.key, item.qty + 1)}
          >
            <Plus size={14} />
          </button>
        </div>
        {quantityError && (
          <p className="cart-stock cart-stock-out" role="alert">
            {isArabic
              ? `الحد الأقصى المتاح ${maxQuantity} قطع.`
              : `Maximum available: ${maxQuantity}.`}
          </p>
        )}
        <button className="remove" onClick={() => removeFromCart(item.key)}>
          {isArabic ? 'حذف' : 'Remove'}
        </button>
      </div>
    </div>
  );
}
