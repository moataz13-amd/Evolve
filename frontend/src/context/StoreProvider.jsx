import { useCallback, useEffect, useMemo, useState } from 'react';
import { matchesProductTag } from '../utils/catalogPlacement';
import { useNavigate } from 'react-router-dom';
import { StoreContext } from './StoreContext';
import { usePersistentState } from '../hooks/usePersistentState';
import { useContent } from './ContentContext';
import { useQueryClient } from '@tanstack/react-query';
import { createOrder } from '../services/orders.service';
import {
  addCartItem,
  createDemoOrder,
  getCartCount,
  getCartTotal,
  removeCartItem,
  updateCartQuantity,
} from '../utils/cart';
import { isCart, isOrderHistory, isProfile, isWishlist, storageKeys } from '../utils/storage';

const isBoolean = (value) => typeof value === 'boolean';

export function StoreProvider({ children }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isDemo } = useContent();
  const [isArabic, setIsArabic] = usePersistentState(storageKeys.language, false, isBoolean);
  const [cart, setCart] = usePersistentState(storageKeys.cart, [], isCart);
  const [wishlist, setWishlist] = usePersistentState(storageKeys.wishlist, [], isWishlist);
  const [profile, setProfile] = usePersistentState(storageKeys.profile, null, isProfile);
  const [orders, setOrders] = usePersistentState(storageKeys.orders, [], isOrderHistory);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = isArabic ? 'ar' : 'en';
  }, [isArabic]);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleLanguage = useCallback(() => setIsArabic((current) => !current), [setIsArabic]);

  const addToCart = useCallback(
    (product, size, color) => {
      if (matchesProductTag(product, 'COMING_SOON'))
        throw new Error('This product is coming soon and cannot be ordered yet.');
      const variant = product.variants?.find(
        (variant) => variant.size === size && variant.color_name === color && variant.active,
      );
      if (!isDemo && (!variant || (variant.track_quantity && variant.stock < 1)))
        throw new Error('This size and color are out of stock.');
      const cartProduct = variant
        ? {
            ...product,
            variantId: variant.id,
            price: Number(variant.price_override ?? product.price),
          }
        : product;
      setCart((current) => addCartItem(current, cartProduct, size, color));
      openCart();
    },
    [setCart, openCart, isDemo],
  );

  const updateQuantity = useCallback(
    (key, quantity) => {
      setCart((current) => updateCartQuantity(current, key, quantity));
    },
    [setCart],
  );

  const removeFromCart = useCallback(
    (key) => {
      setCart((current) => removeCartItem(current, key));
    },
    [setCart],
  );

  const toggleWishlist = useCallback(
    (productId) => {
      setWishlist((current) =>
        current.includes(productId)
          ? current.filter((id) => id !== productId)
          : [...current, productId],
      );
    },
    [setWishlist],
  );

  async function placeOrder(details, requestKey, promo = '') {
    if (!cart.length) return;

    if (!isDemo) {
      const id = await createOrder(cart, details, requestKey, promo);
      void queryClient.invalidateQueries();
      setCart([]);
      closeCart();
      navigate(`/order/${id}`);
      return;
    }

    const order = createDemoOrder(cart);
    setOrders((current) => [order, ...current]);
    setCart([]);
    closeCart();
    navigate(`/order/${order.id}`);
  }

  const cartCount = useMemo(() => getCartCount(cart), [cart]);
  const cartTotal = useMemo(() => getCartTotal(cart), [cart]);

  const store = {
    isArabic,
    toggleLanguage,
    cart,
    cartCount,
    cartTotal,
    isCartOpen,
    openCart,
    closeCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    wishlist,
    toggleWishlist,
    profile,
    setProfile,
    orders,
    placeOrder,
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
