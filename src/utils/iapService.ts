// PYNGOO — iOS Apple In-App Purchase (IAP) servisi
//
// Apple App Store Review Guideline 3.1.1: uygulama içinde kullanılan sanal para (altın)
// iOS'ta YALNIZCA Apple'ın kendi satın alma sistemi (StoreKit) üzerinden satılabilir.
// Bu dosya SADECE iOS'ta devreye girer (isIosNative() false ise hiçbir şey yapmaz);
// web ve Android'de Market.tsx eskisi gibi Shopier/kripto/havale akışını kullanmaya devam eder.
//
// ÖNEMLİ: Altın burada İSTEMCİDE eklenmez. Apple satın almayı onayladıktan sonra
// RevenueCat bir webhook gönderir -> Supabase Edge Function (revenuecat-webhook)
// -> credit_iap_gold() sunucu fonksiyonu altını profiles tablosuna yazar.
// Bu dosyadaki "success" dönüşü yalnızca "Apple ödemeyi onayladı, kredi yolda" demektir;
// bakiye, Layout.tsx'teki mevcut realtime abonelik üzerinden birkaç saniye içinde
// kendiliğinden güncellenir (ek bir polling YOK — Supabase Nano kuralına uygun).

import { Capacitor } from '@capacitor/core';
// NOT: Daha once bilerek dynamic import() kullaniyordu (web/Android bundle'ini kucultmek icin).
// TANI: ic zaman asimlari (10-25 sn) hic tetiklenmeden yalnizca en distaki 55 sn'lik zaman
// asimi ateslendi — bu, dynamic import()'un cihazda hic tamamlanmadan takildigini gosteriyor
// (fonksiyona daha girmeden). Statik import'a gecerek bunu tamamen ortadan kaldiriyoruz.
import { Purchases } from '@revenuecat/purchases-capacitor';

export const isIosNative = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

const REVENUECAT_IOS_API_KEY = (import.meta.env.VITE_REVENUECAT_IOS_API_KEY || '').trim();

let configuredForUserId: string | null = null;
let configuringPromise: Promise<void> | null = null;

async function getPurchases(): Promise<typeof Purchases> {
  return Purchases;
}

// Native köprü yanıt vermezse (RevenueCat eklentisi ile bir sorun olursa) sonsuza kadar
// beklemek yerine belirli sürede net bir hata fırlatır.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// configure() çağrısını (henüz yapılmadıysa veya önceki deneme hiç bitmediyse) garanti eder.
async function ensureConfigured(userId: string): Promise<void> {
  if (configuredForUserId === userId) return;
  if (!configuringPromise) {
    configuringPromise = (async () => {
      const Purchases = await getPurchases();
      await withTimeout(
        Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY, appUserID: userId }),
        15000,
        'configure'
      );
      configuredForUserId = userId;
    })().catch((err) => {
      configuringPromise = null; // basarisiz olursa bir sonraki denemede tekrar dene
      throw err;
    });
  }
  await configuringPromise;
}

// RevenueCat anahtarı .env'e girilmeden IAP hiçbir şekilde devreye girmez (uygulama çökmez,
// yalnızca Market.tsx bu değeri kontrol edip iOS satın alma butonunu gizler).
export function iapAvailable(): boolean {
  return isIosNative() && REVENUECAT_IOS_API_KEY.length > 0;
}

// Uygulama açılışında / kullanıcı giriş yaptığında bir kere çağrılır (Market.tsx mount).
// appUserID = Supabase kullanıcı UUID'si: webhook bu kimlikle profiles.id eşleştirir.
export async function initIAP(userId: string): Promise<void> {
  if (!iapAvailable() || !userId) return;
  try {
    await ensureConfigured(userId);
  } catch (err) {
    console.error('RevenueCat baslatma hatasi:', err);
  }
}

export type IapPurchaseOutcome =
  | { status: 'success'; productId: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export async function purchaseGoldProduct(productId: string, userId: string): Promise<IapPurchaseOutcome> {
  if (!iapAvailable()) return { status: 'error', message: 'not_available' };
  // Iz (breadcrumb): hangi adima kadar ilerledigimizi hata mesajina ekleriz, boyle
  // Mac/konsol olmadan da TAM olarak nerede tikandigini goruruz.
  const steps: string[] = [];
  const mark = (s: string) => steps.push(s);
  try {
    mark('start');
    try {
      await ensureConfigured(userId);
      mark('configured');
    } catch (cfgErr: any) {
      mark(`configure_failed:${cfgErr?.message || cfgErr}`);
      return { status: 'error', message: `steps=${steps.join('>')}` };
    }

    const Purchases = await getPurchases();
    mark('bridge_loaded');

    // Saglik kontrolu: en basit native cagri (urun/magaza gerektirmez). Bu bile
    // takilirsa sorun urunlerde/Offerings'te degil, koprunun kendisindedir.
    await withTimeout<any>(Purchases.getCustomerInfo(), 10000, 'getCustomerInfo');
    mark('customerInfo_ok');

    const { products } = await withTimeout<any>(
      Purchases.getProducts({ productIdentifiers: [productId] }),
      25000,
      'getProducts'
    );
    mark(`getProducts_ok:${products?.length ?? 0}`);
    const product = products && products[0];
    if (!product) return { status: 'error', message: `steps=${steps.join('>')} | product_not_found` };

    const result = await withTimeout<any>(
      Purchases.purchaseStoreProduct({ product }),
      90000,
      'purchaseStoreProduct'
    );
    mark('purchase_ok');
    return { status: 'success', productId: result.productIdentifier };
  } catch (err: any) {
    if (err?.userCancelled === true || err?.code === '1' /* PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR */) {
      return { status: 'cancelled' };
    }
    const msg = err?.message || String(err);
    console.error('Apple satin alma hatasi:', steps.join('>'), err);
    return { status: 'error', message: `steps=${steps.join('>')} | ${msg}` };
  }
}

// Apple'ın gerektirdiği "Satın Alımları Geri Yükle" (yeni cihaz / silinip yeniden kurulum senaryosu).
export async function restoreGoldPurchases(): Promise<{ success: boolean; message?: string }> {
  if (!iapAvailable()) return { success: false, message: 'not_available' };
  try {
    const Purchases = await getPurchases();
    await Purchases.restorePurchases();
    return { success: true };
  } catch (err: any) {
    console.error('Geri yukleme hatasi:', err);
    return { success: false, message: err?.message || 'unknown' };
  }
}
