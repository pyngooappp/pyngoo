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
// flowType: 'pkce' — Supabase Auth (GoTrue v2.197+) implicit akışta OAuth state'ini kaydedemiyor ve
// Google/Apple dönüşünde "bad_oauth_state: OAuth state not found or expired" hatası veriyordu (web, iOS,
// Android). PKCE akışı state'i auth.flow_state'e yazar ve sorunsuz çalışır; dönüş ?code=... ile gelir ve
// App.tsx (initializeAuth + appUrlOpen) ile Login.tsx (iOS InAppAuth) bunu exchangeCodeForSession ile işler.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
});
