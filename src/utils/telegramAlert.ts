// Telegram Moderasyon Bildirim Servisi
// GÜVENLİK: Bot token'ı artık koda GÖMÜLÜ DEĞİL.
//   ANA YOL: Supabase Edge Function "telegram-alert" (token sunucudaki secret'ta,
//            istemciye asla inmez). Bu yol HER ZAMAN önce denenir.
//   YEDEK YOL: Bu tarayıcıda localStorage'a kaydedilmiş token (panel üzerinden
//            elle verildiyse). Token iptal edilirse otomatik temizlenir.
import { supabase } from '../lib/supabase';

export interface ReportPayload {
  reporterName?: string;
  reporterId: string;
  reportedName?: string;
  reportedId: string;
  category: string;
  reason?: string;
  matchId?: string;
  evidenceSnapshot?: string | null;
}

// Kodda gömülü token YOK. Boş bırakılması kasıtlıdır — sızıntıyı önler.
export const DEFAULT_TELEGRAM_BOT_TOKEN = '';
export const DEFAULT_TELEGRAM_CHAT_ID = '';

export const getTelegramConfig = () => {
  const token = localStorage.getItem('pyngoo_telegram_bot_token') || DEFAULT_TELEGRAM_BOT_TOKEN;
  const chatId = localStorage.getItem('pyngoo_telegram_chat_id') || DEFAULT_TELEGRAM_CHAT_ID;
  return { token: token.trim(), chatId: chatId.trim() };
};

export const saveTelegramConfig = (token: string, chatId: string) => {
  localStorage.setItem('pyngoo_telegram_bot_token', token.trim());
  localStorage.setItem('pyngoo_telegram_chat_id', chatId.trim());
};

// Sunucu tarafı Edge Function üzerinden gönderim (ANA YOL)
const sendViaEdgeFunction = async (body: { text?: string; photo?: string }): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('telegram-alert', { body });
    if (error) {
      return { success: false, error: error.message };
    }
    return data?.ok ? { success: true } : { success: false, error: data?.error || 'Bilinmeyen hata' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Edge Function erişilemedi' };
  }
};

// Eski/ölü token'ı tarayıcıdan temizle — sonraki denemeler Edge Function'a düşsün
const clearStaleLocalToken = () => {
  try {
    localStorage.removeItem('pyngoo_telegram_bot_token');
    localStorage.removeItem('pyngoo_telegram_chat_id');
  } catch (_) {}
};

export const fetchTelegramChatIdFromUpdates = async (botToken?: string): Promise<{ success: boolean; chatId?: string; chatName?: string; error?: string }> => {
  const token = (botToken || getTelegramConfig().token).trim();
  if (!token) return { success: false, error: 'Bot token bulunamadı.' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json();
    if (!data.ok) {
      return { success: false, error: data.description || 'Telegram API hatası' };
    }
    const updates = data.result || [];
    if (updates.length === 0) {
      return { 
        success: false, 
        error: 'Henüz Telegram\'da botunuza gönderilmiş bir mesaj bulunamadı. Lütfen Telegram\'da @pyngoo_bot botunuza gidip /start veya herhangi bir mesaj yazın (veya botu grubunuza ekleyip bir mesaj atın), ardından buraya tekrar tıklayın!' 
      };
    }
    const lastUpdate = updates[updates.length - 1];
    const chat = lastUpdate.message?.chat || lastUpdate.channel_post?.chat || lastUpdate.my_chat_member?.chat;
    if (chat && chat.id) {
      const foundChatId = String(chat.id);
      const foundName = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || 'Telegram Kullanıcısı';
      return { success: true, chatId: foundChatId, chatName: foundName };
    }
    return { success: false, error: 'Mesaj bulundu ancak Chat ID tespit edilemedi.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Bağlantı hatası' };
  }
};

export const sendTelegramAlert = async (text: string): Promise<{ success: boolean; error?: string }> => {
  // ANA YOL: her zaman önce sunucu (Edge Function). Tarayıcıda kalmış ESKİ/ÖLÜ
  // token'ın gönderimi ele geçirmesini bu sıra engeller.
  const viaServer = await sendViaEdgeFunction({ text });
  if (viaServer.success) return viaServer;

  // Sunucu ulaşılamazsa bu tarayıcıdaki elle girilmiş token ile dene.
  const { token, chatId } = getTelegramConfig();
  if (!token || !chatId) {
    console.warn('Telegram bildirimi sunucu üzerinden iletilemedi:', viaServer.error);
    return viaServer;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });

    const data = await res.json();
    if (data.ok) {
      return { success: true };
    } else {
      // Token iptal edilmiş/ölü ise tarayıcıdan temizle; sonraki denemeler sunucuya düşsün
      if (res.status === 401 || (data.description || '').toLowerCase().includes('unauthorized')) {
        clearStaleLocalToken();
      }
      return { success: false, error: data.description || 'Bilinmeyen Telegram hatası' };
    }
  } catch (err: any) {
    console.error('Telegram bildirim hatası:', err);
    return { success: false, error: err.message };
  }
};

export const sendTelegramPhoto = async (photoBase64: string, caption: string): Promise<{ success: boolean; error?: string }> => {
  // ANA YOL: fotoğrafı da önce sunucu üzerinden gönder (base64 olarak Edge Function'a iletilir)
  const viaServer = await sendViaEdgeFunction({ text: caption, photo: photoBase64 });
  if (viaServer.success) return viaServer;

  const { token, chatId } = getTelegramConfig();
  if (!token || !chatId) {
    console.warn('Telegram fotoğrafı sunucu üzerinden iletilemedi:', viaServer.error);
    return viaServer;
  }

  try {
    // Base64 DataURL'i Blob'a dönüştür
    const commaIdx = photoBase64.indexOf(',');
    const base64Data = commaIdx !== -1 ? photoBase64.slice(commaIdx + 1) : photoBase64;
    const mimeMatch = photoBase64.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const byteCharacters = atob(base64Data);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteNumbers], { type: mimeType });

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', blob, 'kanit_snapshot.jpg');
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.ok) {
      return { success: true };
    } else {
      console.warn('sendPhoto hatası, metin mesajına geçiliyor:', data.description);
      return await sendTelegramAlert(caption + '\n\n<i>(⚠️ Kanıt fotoğrafı Telegram kotası veya formatı sebebiyle iletilemedi: ' + (data.description || 'Hata') + ')</i>');
    }
  } catch (err: any) {
    console.error('Telegram sendPhoto error:', err);
    return await sendTelegramAlert(caption);
  }
};

export const sendReportToTelegram = async (payload: ReportPayload) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR');
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  const hasPhoto = !!payload.evidenceSnapshot;

  const message = `
🚨 <b>YENİ KULLANICI ŞİKAYETİ (PYNGOO)</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Şikayet Eden:</b> ${payload.reporterName || 'Anonim'} (<code>${payload.reporterId.slice(0, 8)}</code>)
🎯 <b>Şikayet Edilen:</b> ${payload.reportedName || 'Kullanıcı'} (<code>${payload.reportedId.slice(0, 8)}</code>)
⚠️ <b>Kategori:</b> <b>${payload.category}</b>
📝 <b>Açıklama:</b> ${payload.reason && payload.reason.trim() !== '' ? payload.reason : '<i>Açıklama girilmedi</i>'}
${hasPhoto ? '📸 <b>Kanıt:</b> Şikayet anında karşı tarafın kamerasından 1 kare alındı (Ekli görsel)' : '🎙️ <b>Kanıt:</b> Sesli görüşme (Görüntü yok)'}
📅 <b>Tarih:</b> ${dateStr} • ${timeStr}

🔗 <b>Yönetim Paneli:</b> https://admin.pyngoo.app
  `.trim();

  if (hasPhoto && payload.evidenceSnapshot) {
    return await sendTelegramPhoto(payload.evidenceSnapshot, message);
  } else {
    return await sendTelegramAlert(message);
  }
};

export interface NewRegistrationPayload {
  displayName: string;
  userId: string;
  gender: string;
  authMethod?: string;
  preferredLanguage?: string;
  email?: string;
}

/**
 * Yeni bir kullanıcı kaydolduğunda adminin özel Telegram sohbetine anlık bildirim gönderir.
 */
export const sendNewRegistrationToTelegram = async (payload: NewRegistrationPayload) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR');
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  const genderIcon = payload.gender === 'kadin' ? '♀️ Kadın (Yapay Zekâ Doğrulamalı ✅)' : '♂️ Erkek';
  const methodText = payload.authMethod || 'Google / E-posta';

  const message = `
🎉 <b>YENİ KULLANICI KAYDI (PYNGOO)</b> 🚀
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Kullanıcı Adı:</b> @${payload.displayName}
🆔 <b>ID:</b> <code>${payload.userId.slice(0, 8)}</code>
⚧ <b>Cinsiyet:</b> ${genderIcon}
🔑 <b>Kayıt Yöntemi:</b> ${methodText}
🌍 <b>Dil:</b> ${(payload.preferredLanguage || 'tr').toUpperCase()}
📅 <b>Tarih:</b> ${dateStr} • ${timeStr}

🔗 <b>Yönetim Paneli:</b> https://admin.pyngoo.app
  `.trim();

  return await sendTelegramAlert(message);
};
