import { useQuery } from '@tanstack/react-query';
import { storefrontOffers } from '../services/content.service';
import { isConfigured } from '../lib/supabase';

export function useStorefrontOffers() {
  return useQuery({
    queryKey: ['storefront', 'offers'],
    queryFn: storefrontOffers,
    enabled: isConfigured,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
