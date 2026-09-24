// PYNGOO — Agora RTC Token Edge Function (Supabase)
// Amaç: Agora App Certificate'ı istemciden tamamen uzak tutmak ve token'ı YALNIZCA
// ilgili görüşmenin taraflarına üretmek.
//
// KURULUM (Supabase panelinden, CLI gerekmez):
//   1) Edge Functions -> "Deploy a new function" -> "Via Editor" -> İsim: agora-token
//   2) Bu dosyanın İÇERİĞİNİ editöre yapıştır -> Deploy
//   3) "Verify JWT" AÇIK kalsın.
//   4) Edge Functions -> Secrets:
//        AGORA_APP_ID          = <Agora App ID>
//        AGORA_APP_CERTIFICATE = <Agora Console'da YENİLENMİŞ App Certificate (GİZLİ)>
//      (SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından otomatik sağlanır.)
//
// GÜVENLİK KURALLARI:
//   * Giriş yapmamış (anon) istekler reddedilir.
//   * channelName = match_history.match_id olmalı ve çağıran kişi o görüşmenin
//     caller_id veya receiver_id'si olmalıdır. Başkasının görüşmesine token üretilmez.
//   * Reddedilmiş / meşgul görüşmelere token üretilmez.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
// @ts-ignore — npm paketi Deno ortamında npm: specifier ile kullanılır
import pkg from "npm:agora-token@2.0.5";
// @ts-ignore
const { RtcTokenBuilder, RtcRole } = pkg as any;

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Yalnizca POST desteklenir" }, 405);
  }

  const APP_ID = Deno.env.get("AGORA_APP_ID");
  const APP_CERT = Deno.env.get("AGORA_APP_CERTIFICATE");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!APP_ID || !APP_CERT || !SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Sunucu yapilandirmasi eksik" }, 500);
  }

  // 1. Çağıranın kimliği (giriş yapmış kullanıcı olmalı)
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return json({ error: "Yetkisiz" }, 401);
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  const callerId = userData?.user?.id;
  if (userErr || !callerId) {
    return json({ error: "Yetkisiz" }, 401);
  }

  let body: { channelName?: string; uid?: number; expireSeconds?: number } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Gecersiz JSON govdesi" }, 400);
  }

  const channelName = (body.channelName || "").toString().trim();
  if (!UUID_RE.test(channelName)) {
    return json({ error: "Gecersiz kanal" }, 400);
  }
  const uid = Number.isInteger(body.uid) && Number(body.uid) >= 0 && Number(body.uid) < 2 ** 31
    ? Number(body.uid)
    : Math.floor(Math.random() * 10000);
  const expireSeconds = Math.min(Math.max(Number(body.expireSeconds) || 3600, 60), 2 * 3600);

  // 2. Çağıran bu görüşmenin tarafı mı?
  const { data: match, error: matchErr } = await admin
    .from("match_history")
    .select("caller_id, receiver_id, status")
    .eq("match_id", channelName)
    .maybeSingle();

  if (matchErr) {
    return json({ error: "Sunucu hatasi" }, 500);
  }
  if (!match || (match.caller_id !== callerId && match.receiver_id !== callerId)) {
    return json({ error: "Bu gorusmeye erisim yetkiniz yok" }, 403);
  }
  if (["rejected", "busy"].includes(String(match.status || ""))) {
    return json({ error: "Gorusme aktif degil" }, 403);
  }

  // 3. Banlı kullanıcıya token yok
  const { data: prof } = await admin.from("profiles").select("is_banned").eq("id", callerId).maybeSingle();
  if (prof?.is_banned === true) {
    return json({ error: "Hesap askida" }, 403);
  }

  try {
    const expireTs = Math.floor(Date.now() / 1000) + expireSeconds;
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERT,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      expireTs,
      expireTs
    );
    return json({ token, uid, appId: APP_ID, expiresAt: expireTs });
  } catch (err) {
    return json({ error: (err as Error)?.message || "Token uretilemedi" }, 500);
  }
});
