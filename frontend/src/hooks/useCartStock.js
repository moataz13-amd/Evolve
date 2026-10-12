import { useQuery } from '@tanstack/react-query';
import { database } from '../lib/supabase';

export function useCartStock(cart, enabled) {
  const variantIds = [...new Set(cart.map((item) => item.variantId).filter(Boolean))].sort();

  return useQuery({
    queryKey: ['storefront', 'cart-stock', variantIds],
    queryFn: async () => {
      if (!variantIds.length) return {};
      const { data, error } = await database()
        .from('product_variants')
        .select('id,active,track_quantity,stock,low_stock_threshold')
        .in('id', variantIds);
      if (error) throw error;
      return Object.fromEntries(data.map((variant) => [variant.id, variant]));
    },
    enabled,
    refetchOnMount: 'always',
    staleTime: 0,
    retry: 1,
  });
}
