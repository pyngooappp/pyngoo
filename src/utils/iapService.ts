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
// NOT: @revenuecat/purchases-capacitor BİLEREK statik olarak import edilmiyor (yalnızca
// aşağıdaki getPurchases() içinde dynamic import ile). Web/Android bundle'ına hiç girmesin
// diye — RevenueCat'in PURCHASE_CANCELLED_ERROR kodu ("1") bu yüzden string literal olarak kontrol edilir.

export const isIosNative = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

const REVENUECAT_IOS_API_KEY = (import.meta.env.VITE_REVENUECAT_IOS_API_KEY || '').trim();

let PurchasesRef: any = null;
let configuredForUserId: string | null = null;

async function getPurchases(): Promise<any> {
  if (!PurchasesRef) {
    const mod = await import('@revenuecat/purchases-capacitor');
    PurchasesRef = mod.Purchases;
  }
  return PurchasesRef;
}

// RevenueCat anahtarı .env'e girilmeden IAP hiçbir şekilde devreye girmez (uygulama çökmez,
// yalnızca Market.tsx bu değeri kontrol edip iOS satın alma butonunu gizler).
export function iapAvailable(): boolean {
  return isIosNative() && REVENUECAT_IOS_API_KEY.length > 0;
}

// Uygulama açılışında / kullanıcı giriş yaptığında bir kere çağrılır (Market.tsx mount).
// appUserID = Supabase kullanıcı UUID'si: webhook bu kimlikle profiles.id eşleştirir.
export async function initIAP(userId: string): Promise<void> {
  if (!iapAvailable() || !userId || configuredForUserId === userId) return;
  try {
    const Purchases = await getPurchases();
    await Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY, appUserID: userId });
    configuredForUserId = userId;
  } catch (err) {
    console.error('RevenueCat baslatma hatasi:', err);
  }
}

export type IapPurchaseOutcome =
  | { status: 'success'; productId: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export async function purchaseGoldProduct(productId: string): Promise<IapPurchaseOutcome> {
  if (!iapAvailable()) return { status: 'error', message: 'not_available' };
  try {
    const Purchases = await getPurchases();
    const { products } = await Purchases.getProducts({ productIdentifiers: [productId] });
    const product = products && products[0];
    if (!product) return { status: 'error', message: 'product_not_found' };

    const result = await Purchases.purchaseStoreProduct({ product });
    return { status: 'success', productId: result.productIdentifier };
  } catch (err: any) {
    if (err?.userCancelled === true || err?.code === '1' /* PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR */) {
      return { status: 'cancelled' };
    }
    console.error('Apple satin alma hatasi:', err);
    return { status: 'error', message: err?.message || 'unknown' };
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
