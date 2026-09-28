// PYNGOO — RevenueCat Webhook (Apple In-App Purchase kredisi)
// Amaç: iOS'ta yapılan Apple satın alımını (RevenueCat üzerinden) doğrulayıp
// altını YALNIZCA sunucuda, tek seferlik (idempotent) olarak profile ekler.
//
// KURULUM (Supabase panelinden):
//   1) Edge Functions -> Deploy -> İsim: revenuecat-webhook
//   2) Bu dosyanın içeriğini yapıştır -> Deploy
//   3) "Verify JWT" KAPALI olmalı (RevenueCat sunucuları Supabase JWT'si göndermez;
//      doğrulamayı REVENUECAT_WEBHOOK_SECRET ile kendimiz yapıyoruz).
//   4) Edge Functions -> Secrets:
//        REVENUECAT_WEBHOOK_SECRET = <RevenueCat panelinde webhook için belirlediğiniz uzun rastgele metin>
//      (SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY otomatik sağlanır.)
//   5) RevenueCat panelinde: Project -> Integrations -> Webhooks -> bu fonksiyonun
//      URL'sini gir, "Authorization Header" alanına AYNI REVENUECAT_WEBHOOK_SECRET
//      değerini yaz.
//
// GÜVENLİK:
//   * Authorization header, bizim belirlediğimiz gizli değerle birebir eşleşmezse istek reddedilir.
//   * Eklenecek altın miktarı asla webhook gövdesinden alınmaz; yalnızca veritabanındaki
//     iap_products tablosundan (product_id -> gold_amount) okunur (bkz. credit_iap_gold fonksiyonu).
//   * Aynı transaction_id ikinci kez gelirse (RevenueCat'in kendi tekrar deneme mekanizması)
//     altın ikinci kez eklenmez.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Bu olay tiplerinde bir kere satın alınan (tüketilebilir) altın paketi kredilenir.
const CREDIT_EVENT_TYPES = new Set(["INITIAL_PURCHASE", "NON_RENEWING_PURCHASE"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Yalnizca POST desteklenir" }, 405);
  }

  const SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SECRET || !SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Sunucu yapilandirmasi eksik" }, 500);
  }

  // RevenueCat, panelde girdiğiniz değeri Authorization header'ında olduğu gibi gönderir.
  const auth = req.headers.get("Authorization") || "";
  if (auth !== SECRET && auth.replace(/^Bearer\s+/i, "") !== SECRET) {
    return json({ error: "Yetkisiz" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (_e) {
    return json({ error: "Gecersiz JSON" }, 400);
  }

  const event = payload?.event;
  if (!event || typeof event !== "object") {
    return json({ error: "Gecersiz olay" }, 400);
  }

  const eventType: string = String(event.type || "");
  // Bilmediğimiz/ilgilenmediğimiz olay tipleri (CANCELLATION, TEST, RENEWAL, vb.):
  // RevenueCat'e "aldık" deriz ki tekrar tekrar göndermesin, ama hiçbir şey yapmayız.
  if (!CREDIT_EVENT_TYPES.has(eventType)) {
    return json({ ok: true, ignored: eventType });
  }

  const userId: string | undefined = event.app_user_id;
  const productId: string | undefined = event.product_id;
  const transactionId: string | undefined = event.transaction_id || event.original_transaction_id || event.id;
  const environment: string = String(event.environment || "PRODUCTION").toLowerCase();
  const priceText: string | null = (event.price != null && event.currency)
    ? `${event.price} ${event.currency}`
    : null;

  if (!userId || !productId || !transactionId) {
    return json({ error: "Eksik alan (app_user_id/product_id/transaction_id)" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("credit_iap_gold", {
    p_user_id: userId,
    p_product_id: productId,
    p_transaction_id: String(transactionId),
    p_environment: environment,
    p_price_text: priceText,
  });

  if (error) {
    console.error("credit_iap_gold RPC hatasi:", error);
    return json({ error: "Sunucu hatasi" }, 500);
  }
  if (data && data.success === false) {
    // unknown_product / profile_not_found / invalid_input -> RevenueCat'e 200 dönüp
    // tekrar tekrar denemesini engelliyoruz; hata detayını loglarda görürüz.
    console.error("credit_iap_gold basarisiz:", data);
    return json({ ok: true, credited: false, reason: data.error });
  }

  return json({ ok: true, credited: true, result: data });
});
