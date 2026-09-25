// PYNGOO — Takipçilere "çevrimiçi oldu / canlı yayında" bildirimi (Supabase Edge Function)
//
// KURULUM (Supabase panelinden):
//   1) Edge Functions -> "Deploy a new function" -> "Via Editor" -> İsim: notify-followers
//   2) Bu dosyanın içeriğini yapıştır -> Deploy
//   3) "Verify JWT with legacy secret" KAPALI olsun (kimlik aşağıda kodla doğrulanır).
//   4) Edge Functions -> Secrets:
//        FCM_SERVICE_ACCOUNT = Firebase'den indirilen service account .json dosyasının TAMAMI
//      (SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY otomatik gelir.)
//
// GÜVENLİK:
//   * Yalnızca giriş yapmış YAYINCI kendi takipçilerine bildirim tetikleyebilir.
//   * Aynı yayıncı için 30 dakikada en fazla 1 bildirim (spam engeli, live_notify_log).
//   * Banlı yayıncı bildirim gönderemez; yayıncının engellediği kişilere bildirim gitmez.
//   * Geçersiz / silinmiş cihaz anahtarları otomatik temizlenir.

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

const THROTTLE_MINUTES = 30;
const MAX_TOKENS = 5000;
const SITE_URL = "https://www.pyngoo.app/";

// Bildirim metinleri (alıcının diline göre)
const TEXTS: Record<string, { live: [string, string]; online: [string, string] }> = {
  tr: { live: ["🔴 {name} canlı yayında!", "Takip ettiğin {name} şu an yayında. Hemen bağlan!"], online: ["🟢 {name} çevrimiçi oldu", "Takip ettiğin {name} şu an çevrimiçi. Selam vermek için dokun."] },
  en: { live: ["🔴 {name} is live!", "{name}, who you follow, is live right now. Join now!"], online: ["🟢 {name} is online", "{name}, who you follow, is online now. Tap to say hi."] },
  de: { live: ["🔴 {name} ist live!", "{name}, dem du folgst, ist gerade live. Jetzt verbinden!"], online: ["🟢 {name} ist online", "{name}, dem du folgst, ist jetzt online. Tippe, um Hallo zu sagen."] },
  fr: { live: ["🔴 {name} est en direct !", "{name}, que vous suivez, est en direct. Rejoignez-la maintenant !"], online: ["🟢 {name} est en ligne", "{name}, que vous suivez, est en ligne. Touchez pour dire bonjour."] },
  es: { live: ["🔴 ¡{name} está en directo!", "{name}, a quien sigues, está en directo ahora. ¡Conéctate ya!"], online: ["🟢 {name} está en línea", "{name}, a quien sigues, está en línea. Toca para saludar."] },
  ru: { live: ["🔴 {name} в эфире!", "{name}, на кого вы подписаны, сейчас в эфире. Подключайтесь!"], online: ["🟢 {name} в сети", "{name}, на кого вы подписаны, сейчас в сети. Нажмите, чтобы поздороваться."] },
  ar: { live: ["🔴 {name} في بث مباشر!", "{name} التي تتابعها في بث مباشر الآن. انضم الآن!"], online: ["🟢 {name} متصلة الآن", "{name} التي تتابعها متصلة الآن. اضغط لإلقاء التحية."] },
  az: { live: ["🔴 {name} canlı yayındadır!", "İzlədiyin {name} indi yayındadır. Dərhal qoşul!"], online: ["🟢 {name} onlayn oldu", "İzlədiyin {name} indi onlayndır. Salam vermək üçün toxun."] },
  it: { live: ["🔴 {name} è in diretta!", "{name}, che segui, è in diretta ora. Collegati subito!"], online: ["🟢 {name} è online", "{name}, che segui, è online ora. Tocca per salutare."] },
  pt: { live: ["🔴 {name} está ao vivo!", "{name}, que você segue, está ao vivo agora. Entre já!"], online: ["🟢 {name} está online", "{name}, que você segue, está online agora. Toque para dizer oi."] },
};

// ---------------------------------------------------------------------------
// Firebase (FCM HTTP v1) erişim anahtarı — service account ile RS256 JWT imzalanır
// ---------------------------------------------------------------------------
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
    throw new Error("FCM erisim anahtari alinamadi");
  }
  cachedToken = { value: data.access_token, exp: now + (data.expires_in || 3600) };
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Yalnizca POST" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SA_RAW = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!SUPABASE_URL || !SERVICE_KEY || !SA_RAW) {
    return json({ error: "Sunucu yapilandirmasi eksik" }, 500);
  }

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(SA_RAW);
    if (!sa.project_id || !sa.client_email || !sa.private_key) throw new Error();
  } catch {
    return json({ error: "FCM_SERVICE_ACCOUNT gecersiz" }, 500);
  }

  // 1. Çağıran kim?
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Yetkisiz" }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  const streamerId = userData?.user?.id;
  if (userErr || !streamerId) return json({ error: "Yetkisiz" }, 401);

  let body: { event?: string } = {};
  try { body = await req.json(); } catch { /* boş gövde */ }
  const event: "live" | "online" = body.event === "online" ? "online" : "live";

  // 2. Yayıncı mı, banlı mı?
  const { data: prof } = await admin
    .from("profiles")
    .select("display_name, role, is_streamer, is_banned")
    .eq("id", streamerId)
    .maybeSingle();
  if (!prof) return json({ error: "Profil yok" }, 404);
  if (prof.is_banned === true) return json({ error: "Hesap askida" }, 403);
  if (!(prof.is_streamer === true || prof.role === "streamer")) {
    return json({ error: "Yalnizca yayincilar" }, 403);
  }

  // 3. Spam engeli: 30 dakikada en fazla 1 bildirim
  const { data: logRow } = await admin
    .from("live_notify_log")
    .select("last_sent_at")
    .eq("streamer_id", streamerId)
    .maybeSingle();
  if (logRow?.last_sent_at) {
    const diffMin = (Date.now() - new Date(logRow.last_sent_at).getTime()) / 60000;
    if (diffMin < THROTTLE_MINUTES) {
      return json({ success: true, skipped: "throttled", sent: 0 });
    }
  }
  await admin.from("live_notify_log").upsert({ streamer_id: streamerId, last_sent_at: new Date().toISOString() });

  // 4. Takipçiler (yayıncının engellediği kişiler hariç)
  const { data: followers } = await admin
    .from("follows")
    .select("follower_id")
    .eq("following_id", streamerId)
    .limit(MAX_TOKENS);
  let followerIds = (followers || []).map((f: { follower_id: string }) => f.follower_id);
  if (followerIds.length === 0) return json({ success: true, sent: 0 });

  try {
    const { data: blocked } = await admin
      .from("blocks")
      .select("blocked_user_id")
      .eq("user_id", streamerId);
    const blockedSet = new Set((blocked || []).map((b: { blocked_user_id: string }) => b.blocked_user_id));
    followerIds = followerIds.filter((id: string) => !blockedSet.has(id));
  } catch { /* blocks tablosu yoksa atla */ }
  if (followerIds.length === 0) return json({ success: true, sent: 0 });

  const { data: tokens } = await admin
    .from("push_tokens")
    .select("token, language, platform")
    .in("user_id", followerIds)
    .limit(MAX_TOKENS);
  if (!tokens || tokens.length === 0) return json({ success: true, sent: 0 });

  // 5. Gönder
  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch {
    return json({ error: "Bildirim servisine baglanilamadi" }, 502);
  }

  const name = String(prof.display_name || "Pyngoo").slice(0, 40);
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const deadTokens: string[] = [];
  let sent = 0;

  const sendOne = async (t: { token: string; language: string | null }) => {
    const lang = (t.language || "en").slice(0, 2).toLowerCase();
    const tpl = (TEXTS[lang] || TEXTS.en)[event];
    const title = tpl[0].replace("{name}", name);
    const text = tpl[1].replace("{name}", name);
    const res = await fetch(fcmUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token: t.token,
          notification: { title, body: text },
          data: { type: `streamer_${event}`, streamer_id: streamerId },
          android: { priority: "HIGH", notification: { sound: "default" } },
          apns: { payload: { aps: { sound: "default" } } },
          webpush: {
            notification: { icon: "/logo.png" },
            fcm_options: { link: `${SITE_URL}explore` },
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
    if (res.status === 404 || code.includes("UNREGISTERED") || code.includes("registration-token-not-registered") ||
        (res.status === 400 && code.includes("INVALID_ARGUMENT") && code.includes("token"))) {
      deadTokens.push(t.token);
    }
  };

  for (let i = 0; i < tokens.length; i += 50) {
    await Promise.all(tokens.slice(i, i + 50).map((t) => sendOne(t).catch(() => {})));
  }

  if (deadTokens.length > 0) {
    await admin.from("push_tokens").delete().in("token", deadTokens);
  }

  return json({ success: true, sent, removed: deadTokens.length });
});
