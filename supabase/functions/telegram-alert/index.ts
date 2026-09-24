// PYNGOO — Telegram Bildirim Edge Function (Supabase)
// Amaç: Bot token'ını istemci koddan çıkarıp sunucuda gizli tutmak.
//
// KURULUM (Supabase panelinden, CLI gerekmez):
//   1) Sol menü: Edge Functions -> "Deploy a new function" -> "Via Editor"
//   2) İsim: telegram-alert
//   3) Bu dosyanın İÇERİĞİNİ editöre yapıştır -> Deploy
//   4) Edge Functions -> telegram-alert -> Secrets (veya Project Settings -> Edge Functions -> Secrets):
//        TELEGRAM_BOT_TOKEN = <BotFather'dan alınan YENİ token>
//        TELEGRAM_CHAT_ID   = 7656900686   (kendi chat ID'niz)
//   5) Test: uygulamayı açıp bir şikayet gönderin; Telegram'a mesaj düşmeli.
//
// "Verify JWT" AÇIK kalmalı. GÜVENLİK: Yalnızca GİRİŞ YAPMIŞ kullanıcılar mesaj gönderebilir
// (anon anahtarla gelen istekler reddedilir), kullanıcı başına dakikada en fazla 10 mesaj,
// metin 4000 karakter ve fotoğraf ~3 MB ile sınırlıdır.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Basit hız sınırı (fonksiyon örneği başına; kötüye kullanımı büyük ölçüde keser)
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const recentCalls = new Map<string, number[]>();
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const list = (recentCalls.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) {
    recentCalls.set(userId, list);
    return true;
  }
  list.push(now);
  recentCalls.set(userId, list);
  return false;
}

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Yalnizca POST desteklenir" }, 405);
  }

  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!BOT_TOKEN || !CHAT_ID) {
    return json({ ok: false, error: "Sunucu yapilandirmasi eksik (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)" }, 500);
  }

  // Çağıran giriş yapmış bir kullanıcı olmalı
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!SUPABASE_URL || !SERVICE_KEY || !jwt) {
    return json({ ok: false, error: "Yetkisiz" }, 401);
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  const userId = userData?.user?.id;
  if (userErr || !userId) {
    return json({ ok: false, error: "Yetkisiz" }, 401);
  }
  if (isRateLimited(userId)) {
    return json({ ok: false, error: "Cok fazla istek" }, 429);
  }

  let payload: { text?: string; photo?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "Gecersiz JSON govdesi" }, 400);
  }

  const text = (payload.text || "").toString().slice(0, 4000);
  const photo = typeof payload.photo === "string" && payload.photo.length <= 4_000_000 ? payload.photo : undefined;

  if (!text && !photo) {
    return json({ ok: false, error: "Gonderilecek metin veya fotograf yok" }, 400);
  }

  try {
    // Fotoğraf varsa sendPhoto deneyecek, olmazsa sendMessage'a düşecek
    if (photo) {
      try {
        const commaIdx = photo.indexOf(",");
        const base64Data = commaIdx !== -1 ? photo.slice(commaIdx + 1) : photo;
        const mimeMatch = photo.match(/data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

        // base64 -> Uint8Array (Deno'da atob mevcut)
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const form = new FormData();
        form.append("chat_id", CHAT_ID);
        form.append("photo", new Blob([bytes], { type: mimeType }), "kanit_snapshot.jpg");
        if (text) {
          form.append("caption", text);
          form.append("parse_mode", "HTML");
        }

        const photoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: "POST",
          body: form,
        });
        const photoData = await photoRes.json();

        if (photoData?.ok) {
          return json({ ok: true });
        }
        // Fotoğraf gönderilemedi -> metin olarak dene
        console.warn("sendPhoto basarisiz, metne dusuluyor:", photoData?.description);
      } catch (photoErr) {
        console.warn("sendPhoto istisnasi, metne dusuluyor:", photoErr);
      }
    }

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text: text || "Pyngoo bildirimi", parse_mode: "HTML" }),
    });
    const data = await res.json();

    if (data?.ok) {
      return json({ ok: true });
    }
    return json({ ok: false, error: data?.description || "Telegram API hatasi" });
  } catch (err) {
    return json({ ok: false, error: (err as Error)?.message || "Bilinmeyen sunucu hatasi" }, 500);
  }
});
