import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import i18next from 'i18next';
import { supabase } from '../lib/supabase';

// Firebase web yapılandırması (bu değerler gizli değildir; tarayıcıda zaten herkese görünür).
const FIREBASE_WEB_CONFIG = {
  apiKey: 'AIzaSyCb46rAvE73HPx9MNBj9u0utZXLGBJevvQ',
  authDomain: 'pyngoo-ce491.firebaseapp.com',
  projectId: 'pyngoo-ce491',
  storageBucket: 'pyngoo-ce491.firebasestorage.app',
  messagingSenderId: '673577776513',
  appId: '1:673577776513:web:18e6fcb6d53b551bbb2480',
};
// Web Push (VAPID) genel anahtarı — gizli değildir.
const WEB_VAPID_KEY = 'BIl9_iwebp6dOtuzMcdsAbuJdYa160tAZrRyVzEnZ70brNOPGmeSCEwrcvCLXD8qiCCObL4VxDp9DLrgfwSsfkU';

export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

let currentToken: string | null = null;
let listenersAdded = false;
let webFirebaseReady = false;

const isNative = () => Capacitor.isNativePlatform();

const platformName = (): 'ios' | 'android' | 'web' => {
  const p = Capacitor.getPlatform();
  return p === 'ios' ? 'ios' : p === 'android' ? 'android' : 'web';
};

// Not: Capacitor eklentisi async bir fonksiyondan döndürülmemeli ("then() is not implemented" hatası verir).
const messaging = () => FirebaseMessaging;

async function ensureWebFirebase() {
  if (isNative() || webFirebaseReady) return;
  const { initializeApp, getApps } = await import('firebase/app');
  if (getApps().length === 0) initializeApp(FIREBASE_WEB_CONFIG);
  webFirebaseReady = true;
}

/** Bu cihaz / tarayıcı bildirim alabilir mi? (iPhone Safari'de yalnızca ana ekrana eklenmiş uygulamada çalışır) */
export function isPushSupported(): boolean {
  if (isNative()) return true;
  return typeof window !== 'undefined'
    && window.isSecureContext
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
}

export async function getPushPermission(): Promise<PushPermission> {
  if (!isPushSupported()) return 'unsupported';
  try {
    if (!isNative()) {
      const p = Notification.permission;
      return p === 'default' ? 'prompt' : p;
    }
    const FM = messaging();
    const { receive } = await FM.checkPermissions();
    console.warn('[push] izin durumu:', receive);
    if (receive === 'granted') return 'granted';
    if (receive === 'denied') return 'denied';
    return 'prompt';
  } catch (err) {
    console.warn('[push] izin kontrol hatasi:', String((err as Error)?.message || err));
    return 'unsupported';
  }
}

/** Sistem izin penceresini açar. */
export async function requestPushPermission(): Promise<PushPermission> {
  if (!isPushSupported()) return 'unsupported';
  try {
    await ensureWebFirebase();
    const FM = messaging();
    const { receive } = await FM.requestPermissions();
    if (receive === 'granted') {
      await registerPushToken();
      return 'granted';
    }
    return receive === 'denied' ? 'denied' : 'prompt';
  } catch {
    return getPushPermission();
  }
}

async function saveToken(token: string) {
  if (!token) return;
  currentToken = token;
  try {
    const { data, error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: platformName(),
      p_language: (i18next.language || 'en').slice(0, 2),
    });
    if (error) console.warn('[push] kayit hatasi:', error.message);
    else console.warn('[push] kayit sonucu:', JSON.stringify(data));
  } catch (err) {
    console.warn('[push] kayit istisnasi:', String((err as Error)?.message || err));
  }
}

/** İzin verilmişse cihaz anahtarını alır ve sunucuya kaydeder (her girişte yenilenir). */
export async function registerPushToken(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    await ensureWebFirebase();
    const FM = messaging();

    let options: { vapidKey?: string; serviceWorkerRegistration?: ServiceWorkerRegistration } = {};
    if (!isNative()) {
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      options = { vapidKey: WEB_VAPID_KEY, serviceWorkerRegistration: reg };
    }
    const { token } = await FM.getToken(options);
    console.warn('[push] anahtar alindi:', token ? token.slice(0, 12) + '...' : 'BOS');
    await saveToken(token);

    if (!listenersAdded) {
      listenersAdded = true;
      await FM.addListener('tokenReceived', (ev) => { saveToken(ev.token); });
      await FM.addListener('notificationActionPerformed', (ev) => {
        const data = (ev.notification?.data || {}) as Record<string, unknown>;
        if (data.streamer_id) {
          window.dispatchEvent(new CustomEvent('pyngoo_push_open', { detail: { path: '/explore' } }));
        }
      });
    }
  } catch (err) {
    console.warn('[push] anahtar alinamadi:', String((err as Error)?.message || err));
  }
}

/** Çıkışta bu cihazın anahtarını siler (çıkış yapan hesaba bildirim gitmez). signOut'tan ÖNCE çağrılmalı. */
export async function unregisterPushToken(): Promise<void> {
  const token = currentToken;
  currentToken = null;
  if (!token) return;
  try { await supabase.from('push_tokens').delete().eq('token', token); } catch (_) {}
  try {
    const FM = messaging();
    await FM.deleteToken();
  } catch (_) {}
}

/**
 * Yayıncı çevrimiçi olduğunda / canlıya geçtiğinde takipçilerine bildirim gönderilmesini ister.
 * Sunucu ayrıca 30 dakikada 1 sınırı uygular; burada gereksiz istekleri de azaltırız.
 */
export async function notifyFollowers(event: 'live' | 'online'): Promise<void> {
  try {
    const key = 'pyngoo_notify_followers_last';
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < 30 * 60 * 1000) return;
    localStorage.setItem(key, String(Date.now()));
  } catch (_) {}
  try {
    await supabase.functions.invoke('notify-followers', { body: { event } });
  } catch (_) { /* sessizce geç */ }
}
