import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { demoMode, isConfigured, mediaUrl } from '../lib/supabase';
import { products as sampleProducts } from '../data/products';
import { storefrontContent, catalogPage } from '../services/content.service';
import { setStoreCurrency } from '../utils/format';
import { readStorefrontCache, saveStorefrontCache } from '../utils/storefrontCache';

const contentSource = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
function cachedContent() {
  try {
    return readStorefrontCache(window.localStorage, contentSource);
  } catch {
    return undefined;
  }
}
type ContentState = {
  products: any[];
  data: any;
  loading: boolean;
  error: string;
  hasNextPage: boolean;
  loadMore: () => void;
  loadingMore: boolean;
  retry: () => void;
  section: (key: string) => any;
  isDemo: boolean;
};
const ContentContext = createContext<ContentState>({
  products: [],
  data: null,
  loading: true,
  error: '',
  hasNextPage: false,
  loadMore: () => {},
  loadingMore: false,
  retry: () => {},
  section: () => null,
  isDemo: false,
});
export function ContentProvider({ children }: { children: ReactNode }) {
  const content = useQuery({
    queryKey: ['storefront', 'content'],
    queryFn: storefrontContent,
    enabled: isConfigured,
    initialData: isConfigured ? cachedContent : undefined,
    initialDataUpdatedAt: 0,
  });
  const catalog = useInfiniteQuery({
    queryKey: ['storefront', 'catalog'],
    queryFn: ({ pageParam }) => catalogPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (page, pages) => (page.length === 24 ? pages.length : undefined),
    enabled: isConfigured,
  });
  const data = content.data;
  useEffect(() => {
    if (!isConfigured || !data || !content.dataUpdatedAt) return;
    try {
      saveStorefrontCache(window.localStorage, contentSource, data);
    } catch {
      /* Storage is optional; content still renders without it. */
    }
  }, [data, content.dataUpdatedAt]);
  useEffect(() => {
    const settings = data?.settings;
    setStoreCurrency(settings?.currency || 'EGP');
    if (settings) {
      document.title = settings.meta_title || settings.store_name;
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute('content', settings.meta_description || '');
    }
  }, [data?.settings]);
  const products = isConfigured ? catalog.data?.pages.flat() || [] : demoMode ? sampleProducts : [];
  const error =
    (content.error || catalog.error)?.message ||
    (!isConfigured && !demoMode
      ? 'The store connection has not been configured. Please contact the store owner.'
      : '');
  function section(key: string) {
    const s = data?.sections?.find((section: any) => section.key === key);
    if (!s) return null;
    const rows = [...s.homepage_content].sort(
      (a: any, b: any) => a.display_order - b.display_order,
    );
    return { ...s, ...rows[0], items: rows, image: mediaUrl(rows[0]?.media?.path) };
  }
  return (
    <ContentContext.Provider
      value={{
        products,
        data,
        section,
        loading: isConfigured && (content.isPending || catalog.isPending),
        error,
        hasNextPage: !!catalog.hasNextPage,
        loadMore: () => void catalog.fetchNextPage(),
        loadingMore: catalog.isFetchingNextPage,
        retry: () => {
          void content.refetch();
          void catalog.refetch();
        },
        isDemo: demoMode,
      }}
    >
      {children}
    </ContentContext.Provider>
  );
}
export const useContent = () => useContext(ContentContext);
