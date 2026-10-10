import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { database, supabase } from '../lib/supabase';
import type { Role } from '../types/admin';
import { queryClient } from '../lib/queryClient';
type AdminProfile = { id: string; name: string; role: Role; active: boolean };
const AuthContext = createContext<{
  session: Session | null;
  admin: AdminProfile | null;
  loading: boolean;
  error: string;
  reload: () => void;
}>({ session: null, admin: null, loading: true, error: '', reload: () => {} });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let alive = true;
    let generation = 0;
    let currentUser: string | undefined;
    async function refresh(next: Session | null) {
      if (!alive) return;
      const token = ++generation;
      if (currentUser !== next?.user.id) {
        currentUser = next?.user.id;
        setAdmin(null);
        setLoading(true);
        void queryClient.cancelQueries({
          predicate: (query) => query.queryKey[0] !== 'storefront',
        });
        queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'storefront' });
      }
      if (!alive || token !== generation) return;
      setSession(next);
      if (!next) setAdmin(null);
      setError('');
      try {
        if (next) {
          const { data, error: failure } = await database()
            .from('admin_profiles')
            .select('id,name,role,active')
            .eq('id', next.user.id)
            .maybeSingle();
          if (failure) throw failure;
          if (alive && token === generation) setAdmin(data?.active ? data : null);
        }
      } catch (failure) {
        if (alive && token === generation)
          setError(
            failure instanceof Error ? failure.message : 'Unable to verify account permissions.',
          );
      } finally {
        if (alive && token === generation) setLoading(false);
      }
    }
    database()
      .auth.getSession()
      .then(({ data, error }) => {
        if (error && alive) {
          setError(error.message);
          setLoading(false);
        } else void refresh(data.session);
      });
    const { data } = database().auth.onAuthStateChange((_event, next) => {
      setTimeout(() => void refresh(next), 0);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [revision]);
  return (
    <AuthContext.Provider
      value={{ session, admin, loading, error, reload: () => setRevision((v) => v + 1) }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
