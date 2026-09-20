// PYNGOO — Agora RTC Token Edge Function (Supabase)
// Amaç: Agora App Certificate'ı istemci koddan çıkarıp sunucuda gizli tutmak.
//
// KURULUM (Supabase panelinden, CLI gerekmez):
//   1) Edge Functions -> "Deploy a new function" -> "Via Editor"
//   2) İsim: agora-token
//   3) Bu dosyanın İÇERİĞİNİ editöre yapıştır -> Deploy
//   4) Edge Functions -> agora-token -> Secrets:
//        AGORA_APP_ID          = 42f01590d5f14201a201b5d85e2f944a  (zaten herkese açık olan App ID)
//        AGORA_APP_CERTIFICATE = <Agora Console > App Certificate (GİZLİ)>
//
// DAVRANIŞ: İstemci (VoiceChat) önce bu fonksiyondan token ister.
// Fonksiyon yoksa/yanıt vermezse istemci yerel üretime düşer (geçiş dönemi).
// Fonksiyon deploy + secret'lar girildikten SONRA .env'den
// VITE_AGORA_APP_CERTIFICATE satırı kaldırılır ve yeniden build alınır;
// böylece sertifika bir daha istemciye inmez.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Yalnizca POST desteklenir" }, 405);
  }

  const APP_ID = Deno.env.get("AGORA_APP_ID");
  const APP_CERT = Deno.env.get("AGORA_APP_CERTIFICATE");

  if (!APP_ID || !APP_CERT) {
    return json({ error: "Sunucu yapilandirmasi eksik (AGORA_APP_ID / AGORA_APP_CERTIFICATE)" }, 500);
  }

  let body: { channelName?: string; uid?: number; expireSeconds?: number } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Gecersiz JSON govdesi" }, 400);
  }

  const channelName = (body.channelName || "").toString().trim();
  const uid = Number.isFinite(body.uid) ? Number(body.uid) : Math.floor(Math.random() * 10000);
  const expireSeconds = Math.min(Math.max(Number(body.expireSeconds) || 3600, 60), 24 * 3600);

  if (!channelName) {
    return json({ error: "channelName zorunludur" }, 400);
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const expireTs = now + expireSeconds;

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
