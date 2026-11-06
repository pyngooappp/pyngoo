// PYNGOO — Sistem Duyurusu & Kilit Ekranı Push Bildirimi (Supabase Edge Function)
//
// Bu fonksiyon Admin / Moderatör Panelinden çağrıldığında:
// 1) Hedef kitleye göre (Tümü, Sadece Kadınlar, Sadece Erkekler) push_tokens tablosundaki cihazları bulur.
// 2) Firebase Cloud Messaging (FCM HTTP v1) üzerinden telefonların kilit ekranına bildirim fırlatır.
// 3) Geçersiz / silinmiş token'ları temizler ve başarı sayısını döner.

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

type ServiceAccount = { project_id: string; client_email: string; private_key: string };
let cachedToken: { value: string; exp: number } | null = null;

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;

  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error("FCM erişim anahtarı alınamadı: " + JSON.stringify(data));
  }
  cachedToken = { value: data.access_token, exp: now + (data.expires_in || 3600) };
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Yalnızca POST kabul edilir" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SA_RAW = Deno.env.get("FCM_SERVICE_ACCOUNT");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Sunucu yapılandırması eksik (SUPABASE_URL / SERVICE_ROLE_KEY)" }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: {
    title?: string;
    content?: string;
    target?: "all" | "female" | "male";
    sent_by?: string;
  } = {};

  try {
    body = await req.json();
  } catch {
    return json({ error: "Geçersiz JSON gövdesi" }, 400);
  }

  const title = (body.title || "").trim();
  const content = (body.content || "").trim();
  const target = body.target || "all";

  if (!title || !content) {
    return json({ error: "Başlık ve içerik zorunludur" }, 400);
  }

  // 1. Hedef Kullanıcı Kimliklerini Belirle
  let targetUserIds: string[] | null = null;
  if (target === "female" || target === "male") {
    const genderVal = target === "female" ? "kadin" : "erkek";
    const { data: profs } = await admin
      .from("profiles")
      .select("id")
      .eq("gender", genderVal)
      .neq("role", "deleted");
    targetUserIds = (profs || []).map((p: { id: string }) => p.id);
  }

  // 2. Hedefe Uygun Push Token'ları Çek
  let tokenQuery = admin.from("push_tokens").select("token, language, platform, user_id").limit(10000);
  if (targetUserIds !== null) {
    if (targetUserIds.length === 0) {
      return json({ success: true, sent: 0, message: "Hedef kitleye ait kullanıcı bulunamadı." });
    }
    tokenQuery = tokenQuery.in("user_id", targetUserIds);
  }

  const { data: tokens, error: tokenErr } = await tokenQuery;
  if (tokenErr) {
    return json({ error: "Token sorgu hatası: " + tokenErr.message }, 500);
  }

  const tokenList = tokens || [];
  if (tokenList.length === 0) {
    return json({ success: true, sent: 0, message: "Kayıtlı telefon/cihaz bildirimi bulunmuyor." });
  }

  // Eğer Firebase Service Account tanımlı değilse token sayısını bildir ve bitir
  if (!SA_RAW) {
    return json({
      success: true,
      sent: 0,
      total_tokens: tokenList.length,
      warning: "FCM_SERVICE_ACCOUNT henüz Supabase Secrets'a eklenmemiş. Tokenlar hazır ancak FCM bekliyor."
    });
  }

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(SA_RAW);
  } catch {
    return json({ error: "FCM_SERVICE_ACCOUNT JSON geçersiz" }, 500);
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (err: any) {
    return json({ error: "FCM token hatası: " + err.message }, 502);
  }

  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const deadTokens: string[] = [];
  let sent = 0;

  const sendOne = async (t: { token: string; language: string | null; platform: string | null }) => {
    const res = await fetch(fcmUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: t.token,
          notification: {
            title: `📢 Pyngoo: ${title}`,
            body: content,
          },
          data: {
            type: "system_broadcast",
            title,
            content,
            sent_at: new Date().toISOString(),
          },
          android: {
            priority: "HIGH",
            notification: {
              sound: "default",
              channel_id: "pyngoo_broadcasts",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
              },
            },
          },
          webpush: {
            notification: {
              icon: "/favicon.ico",
              badge: "/favicon.ico",
            },
            fcm_options: {
              link: "https://www.pyngoo.app/",
            },
          },
        },
      }),
    });

    if (res.ok) {
      sent++;
      return;
    }

    const err = await res.json().catch(() => ({}));
    const code = JSON.stringify(err);
    if (
      res.status === 404 ||
      code.includes("UNREGISTERED") ||
      code.includes("registration-token-not-registered") ||
      (res.status === 400 && code.includes("INVALID_ARGUMENT") && code.includes("token"))
    ) {
      deadTokens.push(t.token);
    }
  };

  // 50'şerli paketler halinde paralel gönder
  for (let i = 0; i < tokenList.length; i += 50) {
    await Promise.all(tokenList.slice(i, i + 50).map((t) => sendOne(t).catch(() => {})));
  }

  // Geçersiz / silinmiş token'ları veritabanından temizle
  if (deadTokens.length > 0) {
    await admin.from("push_tokens").delete().in("token", deadTokens);
  }

  return json({
    success: true,
    sent,
    total_tokens: tokenList.length,
    removed_dead: deadTokens.length,
  });
});
