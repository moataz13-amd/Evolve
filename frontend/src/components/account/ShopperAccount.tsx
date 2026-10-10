import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { database } from '../../lib/supabase';
import { ShopperAuthForm } from './ShopperAuthForm';
import { useStore } from '../../context/StoreContext';
import { AccountProfile } from './AccountProfile';
export function ShopperAccount() {
  const { session, admin, loading, error } = useAuth();
  const { isArabic } = useStore();
  const [signingOut, setSigningOut] = useState(false);
  const [signoutError, setSignoutError] = useState('');
  const query = useQuery({
    queryKey: ['customer', session?.user.id],
    queryFn: async () => {
      const { data, error } = await database()
        .from('customers')
        .select('*,orders(id,order_number,total,status,created_at)')
        .eq('id', session!.user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session,
  });
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignoutError('');
    try {
      const result = await database().auth.signOut();
      if (result.error) throw result.error;
    } catch {
      setSignoutError(
        isArabic ? 'تعذر تسجيل الخروج. حاول مرة تانية.' : 'Unable to sign out. Please try again.',
      );
    } finally {
      setSigningOut(false);
    }
  }
  if (!session) return <ShopperAuthForm />;
  return (
    <AccountProfile
      isArabic={isArabic}
      name={query.data?.name || session.user.user_metadata?.name || ''}
      email={session.user.email || ''}
      phone={query.data?.phone || ''}
      orders={query.data?.orders || []}
      loading={query.isPending}
      failed={query.isError}
      canManage={Boolean(
        !loading &&
        !error &&
        admin?.active &&
        admin.id === session.user.id &&
        ['admin', 'super_admin'].includes(admin.role),
      )}
      signingOut={signingOut}
      signoutError={signoutError}
      onRetry={() => void query.refetch()}
      onSignOut={() => void signOut()}
    />
  );
}
