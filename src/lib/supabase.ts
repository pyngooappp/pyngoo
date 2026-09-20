import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

// detectSessionInUrl: false — App.tsx zaten #access_token hash'ini kendi initializeAuth/handleSession
// mantığıyla (setSession + JWT fallback) manuel olarak işliyor. SDK'nın kendi otomatik hash algılaması
// AÇIK kalırsa, sayfa yüklenirken App.tsx'in manuel akışıyla AYNI ANDA ikinci bir onAuthStateChange
// (SIGNED_IN) tetiklenir; bu iki paralel oturum kurma denemesi birbirine girip adres çubuğunda
// #access_token'ın temizlenmemesine ve kullanıcının yanlışlıkla Landing Page'e düşmesine yol açıyordu.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
});
