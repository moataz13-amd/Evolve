import { createClient } from '@supabase/supabase-js';
const url = (import.meta.env.VITE_SUPABASE_URL || 'https://cyuarwdaxhfhnkojklnc.supabase.co')?.trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dWFyd2RheGhmaG5rb2prbG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzOTg1NDAsImV4cCI6MjEwNjk3NDU0MH0.EjY39ACS8TOk89f7EbreJY9n3EBv63j22pY4zQsVQaw')?.trim();
export const isConfigured = Boolean(url && key);
export const demoMode =
  !isConfigured && import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== 'false';
if (key?.startsWith('sb_secret_'))
  throw new Error('Use a publishable/anon key, never a secret key.');
if (key?.split('.').length === 3) {
  try {
    const payload = JSON.parse(atob(key.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')));
    if (payload.role === 'service_role')
      throw new Error('Service role keys must never be used in the browser.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Service role')) throw error;
  }
}
export const supabase = url && key ? createClient(url, key) : null;
export function database() {
  if (!supabase)
    throw new Error('Supabase is not configured. Add the project URL and publishable/anon key.');
  return supabase;
}
export function mediaUrl(path?: string | null) {
  if (!path) return '';
  if (path.startsWith('https://')) return path;
  return database().storage.from('evolve-media').getPublicUrl(path).data.publicUrl;
}
