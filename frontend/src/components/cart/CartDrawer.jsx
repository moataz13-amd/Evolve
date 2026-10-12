import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatMoney } from '../../utils/format';
import { useContent } from '../../context/ContentContext';
import { useOrderQuote } from '../../hooks/useOrderQuote';
import { OfferSavings } from '../checkout/OfferSavings';
import { CartItem } from './CartItem';
import { useCartStock } from '../../hooks/useCartStock';
import { cartStockStatus } from '../../utils/cartStock';

export function CartDrawer() {
  const { cart, cartCount, cartTotal, isCartOpen, closeCart, isArabic } = useStore();
  const { isDemo } = useContent();
  const stock = useCartStock(cart, isCartOpen && !isDemo);
  const stockReady = isDemo || (stock.isSuccess && !stock.isFetching);
  const hasUnavailableItems =
    !isDemo &&
    stockReady &&
    cart.some((item) => {
      const status = cartStockStatus(item, stock.data?.[item.variantId]);
      return status.kind === 'out' || status.kind === 'exceeded';
    });
  const quote = useOrderQuote('', 'cairo', isCartOpen && stockReady && !hasUnavailableItems);
  const canCheckout = isDemo || (stockReady && !hasUnavailableItems && quote.isSuccess);
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!isCartOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeCart();
      if (event.key === 'Tab') {
        const controls = panelRef.current?.querySelectorAll(
          'a[href],button:not(:disabled),input:not(:disabled)',
        );
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isCartOpen, closeCart]);

  if (!isCartOpen) return null;

  return (
    <div className="cart-overlay" onClick={closeCart}>
      <aside
        ref={panelRef}
        className="cart"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cart-heading">
          <h2>
            {isArabic ? 'حقيبتك' : 'Your bag'} <small>({cartCount})</small>
          </h2>
          <button ref={closeRef} aria-label="Close cart" onClick={closeCart}>
            <X />
          </button>
        </div>

        {cart.length ? (
          <>
            <div className="cart-items">
              {cart.map((item) => (
                <CartItem
                  key={item.key}
                  item={item}
                  pricing={quote.data?.items?.find((line) => line.variant_id === item.variantId)}
                  variant={stock.data?.[item.variantId]}
                  stockReady={!isDemo && stockReady}
                />
              ))}
            </div>
            <div className="cart-total">
              <OfferSavings quote={quote.data} />
              {!isDemo && (stock.isPending || stock.isFetching) && (
                <p role="status">
                  {isArabic ? 'جارٍ التحقق من المخزون…' : 'Checking availability…'}
                </p>
              )}
              {!isDemo && stock.isError && (
                <p role="alert">
                  {isArabic
                    ? 'تعذر التحقق من المخزون الآن. حاول فتح الحقيبة مجددًا.'
                    : 'Could not check availability. Please reopen your bag and try again.'}
                </p>
              )}
              {hasUnavailableItems && (
                <p role="alert">
                  {isArabic
                    ? 'راجع القطع غير المتوفرة أو قلل كميتها لإتمام الطلب.'
                    : 'Remove unavailable items or reduce their quantity to check out.'}
                </p>
              )}
              {quote.isError && <p role="alert">{quote.error.message}</p>}
              <div>
                <span>{isArabic ? 'الإجمالي' : 'Subtotal'}</span>
                <strong>
                  {!isDemo && (!stockReady || hasUnavailableItems)
                    ? '—'
                    : quote.isFetching
                      ? '…'
                      : quote.isError
                        ? '—'
                        : formatMoney(quote.data?.subtotal ?? cartTotal)}
                </strong>
              </div>
              <p>
                {isDemo
                  ? isArabic
                    ? 'متجر تجريبي · لن يتم خصم أي مبلغ.'
                    : 'Demo store · No payment will be collected.'
                  : isArabic
                    ? 'يتم تأكيد السعر والتوفر عند إتمام الطلب.'
                    : 'Price and availability are verified at checkout.'}
              </p>
              {canCheckout ? (
                <Link className="button button-primary" to="/checkout" onClick={closeCart}>
                  {isArabic
                    ? isDemo
                      ? 'إتمام الطلب التجريبي'
                      : 'إتمام الطلب'
                    : 'Continue to checkout'}
                </Link>
              ) : (
                <button className="button button-primary" disabled>
                  {isArabic ? 'إتمام الطلب' : 'Continue to checkout'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="empty">
            <ShoppingBag size={48} />
            <h3>{isArabic ? 'حقيبتك لسه فاضية.' : 'Your bag is taking a rest.'}</h3>
            <p>
              {isArabic ? 'اكتشف قطعتك المفضلة للتمرين.' : 'Find your next training essential.'}
            </p>
            <Link className="button button-primary" to="/shop" onClick={closeCart}>
              {isArabic ? 'اكتشف المجموعة' : 'Explore the collection'}
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
