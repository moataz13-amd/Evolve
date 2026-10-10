import { Link } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatMoney } from '../../utils/format';

export function CartItem({ item, pricing }) {
  const { isArabic, closeCart, updateQuantity, removeFromCart } = useStore();

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
        <div className="quantity">
          <button
            aria-label="Decrease quantity"
            onClick={() => updateQuantity(item.key, item.qty - 1)}
          >
            <Minus size={14} />
          </button>
          <span>{item.qty}</span>
          <button
            aria-label="Increase quantity"
            onClick={() => updateQuantity(item.key, item.qty + 1)}
          >
            <Plus size={14} />
          </button>
        </div>
        <button className="remove" onClick={() => removeFromCart(item.key)}>
          {isArabic ? 'حذف' : 'Remove'}
        </button>
      </div>
    </div>
  );
}
