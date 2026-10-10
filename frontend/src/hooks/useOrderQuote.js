import { useQuery } from '@tanstack/react-query';
import { useContent } from '../context/ContentContext';
import { useStore } from '../context/StoreContext';
import { database } from '../lib/supabase';
export function useOrderQuote(promo = '', governorate = 'cairo', enabled = true) {
  const { cart } = useStore();
  const { isDemo } = useContent();
  return useQuery({
    queryKey: [
      'storefront',
      'quote',
      cart.map((item) => [item.variantId, item.qty]),
      promo,
      governorate,
    ],
    queryFn: async () => {
      const { data, error } = await database().rpc('quote_order', {
        p_items: cart.map((item) => ({ variant_id: item.variantId, quantity: item.qty })),
        p_promo: promo || null,
        p_governorate: governorate,
      });
      if (error) throw error;
      return data;
    },
    enabled: enabled && !isDemo && !!cart.length,
    staleTime: 0,
  });
}
