/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_MEDIA_PROVIDER?: 'supabase' | 'cloudinary';
  readonly VITE_CLOUDINARY_FUNCTION_NAME?: string;
}
