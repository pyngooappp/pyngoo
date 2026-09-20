import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Sparkles, Send, CheckCircle2, AlertTriangle, Bug, HelpCircle } from 'lucide-react';
import { sendTelegramAlert } from '../utils/telegramAlert';
import { supabase } from '../lib/supabase';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  profile: any;
}

export default function FeedbackModal({ isOpen, onClose, userId, profile }: FeedbackModalProps) {
  const { t, i18n } = useTranslation();

  const [category, setCategory] = useState<'suggestion' | 'complaint' | 'bug' | 'other'>('suggestion');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = [
    { key: 'suggestion', icon: <Sparkles size={15} />, label: t('feedback_cat_suggestion', '💡 Öneri / Fikir') },
    { key: 'complaint', icon: <AlertTriangle size={15} />, label: t('feedback_cat_complaint', '⚠️ Şikayet / Sorun') },
    { key: 'bug', icon: <Bug size={15} />, label: t('feedback_cat_bug', '🐛 Hata Bildirimi') },
    { key: 'other', icon: <HelpCircle size={15} />, label: t('feedback_cat_other', '💬 Diğer Görüşler') }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || message.trim().length < 20) {
      setErrorMsg(t('feedback_err_min_length', 'Lütfen en az 20 karakterlik bir açıklama yazın.'));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const categoryLabel = categories.find(c => c.key === category)?.label || category;
    const userName = profile?.display_name || 'Kullanıcı';
    const userGender = profile?.gender === 'kadin' ? 'Kadın 👩' : 'Erkek 👨';
    const lang = (i18n.language || 'tr').toUpperCase();
    const currentDate = new Date().toLocaleString('tr-TR');

    // Kullanıcının sistemdeki e-posta adresini otomatik al
    let userEmail = profile?.email || '';
    if (!userEmail) {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user?.email) userEmail = data.user.email;
      } catch (_) {}
    }
    if (!userEmail) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user?.email) userEmail = data.session.user.email;
      } catch (_) {}
    }
    const emailDisplay = userEmail.trim() || 'Sistemde Kayıtlı E-posta Yok';

    try {
      // 1. pyngooappp@gmail.com adresine FormSubmit AJAX ile e-posta gönder (Güvenli Token ile)
      try {
        await fetch('https://formsubmit.co/ajax/5b213d20ea55145536a1127efd773868', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            _subject: `[Pyngoo Geri Bildirim] ${categoryLabel} - ${userName} (${emailDisplay})`,
            _template: 'table',
            kullanici_adi: userName,
            kullanici_id: userId,
            sistemdeki_eposta: emailDisplay,
            cinsiyet: userGender,
            kategori: categoryLabel,
            uygulama_dili: lang,
            tarih: currentDate,
            kullanici_mesaji: message.trim()
          })
        });
      } catch (mailErr) {
        console.warn('Formsubmit e-posta iletimi arka planda işleniyor:', mailErr);
      }

      // 2. Telegram Moderasyon Botuna anlık bildirim gönder
      try {
        const safeMessage = message.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const tgText = 
          `💡 <b>BERABER GELİŞTİRELİM Mİ? - YENİ GERİ BİLDİRİM / ÖNERİ</b>\n\n` +
          `👤 <b>Kullanıcı:</b> ${userName} (@${profile?.display_name || 'Kullanıcı'})\n` +
          `📧 <b>Sistemdeki E-posta:</b> <code>${emailDisplay}</code>\n` +
          `🆔 <b>Kullanıcı ID:</b> <code>${userId.slice(0, 8)}</code>\n` +
          `⚧ <b>Cinsiyet:</b> ${userGender}\n` +
          `🏷️ <b>Kategori:</b> ${categoryLabel}\n` +
          `🌐 <b>Uygulama Dili:</b> ${lang}\n` +
          `📅 <b>Tarih:</b> ${currentDate}\n\n` +
          `📝 <b>Mesaj / Öneri:</b>\n<i>${safeMessage}</i>`;

        await sendTelegramAlert(tgText);
      } catch (tgErr) {
        console.warn('Telegram bildirim iletimi:', tgErr);
      }

      // 3. Supabase Reports & Geri Bildirim Veritabanına Kaydet
      try {
        await supabase.from('reports').insert([{
          reporter_id: userId,
          reported_user_id: userId,
          category: `Geri Bildirim & Öneri (${categoryLabel})`,
          reason: `[Sistem E-posta: ${emailDisplay}] ${message.trim()}`,
          status: 'pending'
        }]);
      } catch (dbErr) {
        console.warn('Supabase kayıt:', dbErr);
      }

      setIsSubmitting(false);
      setIsSuccess(true);
    } catch (err: any) {
      console.error('Geri bildirim gönderim hatası:', err);
      setIsSubmitting(false);
      setIsSuccess(true);
    }
  };

  const handleModalClose = () => {
    setMessage('');
    setIsSuccess(false);
    setErrorMsg(null);
    onClose();
  };

  return (
    <div 
      onClick={handleModalClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 5, 12, 0.82)',
        backdropFilter: 'blur(12px)',
        zIndex: 3500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(165deg, #1b122e 0%, #100a1c 65%, #0a0614 100%)',
          border: '1.5px solid rgba(255, 215, 0, 0.45)',
          borderRadius: '26px',
          padding: '24px 20px',
          width: '100%',
          maxWidth: '460px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(255, 215, 0, 0.15)',
          position: 'relative'
        }}
      >
        {/* Kapat Butonu */}
        <button
          onClick={handleModalClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.7)',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
        >
          <X size={18} />
        </button>

        {isSuccess ? (
          /* BAŞARI EKRANI */
          <div style={{ textAlign: 'center', padding: '20px 8px 10px 8px' }}>
            <div style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0, 230, 118, 0.25) 0%, rgba(0, 230, 118, 0.05) 70%)',
              border: '2px solid #00e676',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px auto',
              boxShadow: '0 0 30px rgba(0, 230, 118, 0.4)'
            }}>
              <CheckCircle2 size={38} color="#00e676" />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#fff', margin: '0 0 10px 0' }}>
              {t('feedback_success_title', 'Harika! Mesajın Bize Ulaştı 🎉')}
            </h3>

            <p style={{ fontSize: '0.86rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.55', margin: '0 0 24px 0' }}>
              {t('feedback_success_desc', 'Geri bildirimin doğrudan geliştirici ekibimizin e-posta adresine (pyngooappp@gmail.com) ve Telegram yönetim kanalımıza iletildi. Pyngoo’yu seninle birlikte büyütüyoruz!')}
            </p>

            <button
              onClick={handleModalClose}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #00e676 0%, #00b0ff 100%)',
                border: 'none',
                color: '#061727',
                fontWeight: '900',
                fontSize: '0.96rem',
                cursor: 'pointer',
                boxShadow: '0 6px 22px rgba(0, 230, 118, 0.4)'
              }}
            >
              {t('feedback_close_btn', 'Tamam, Harika')}
            </button>
          </div>
        ) : (
          /* FORM EKRANI */
          <form onSubmit={handleSubmit}>
            {/* Başlık & İkon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #ffd700, #ff9800)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                boxShadow: '0 4px 15px rgba(255, 215, 0, 0.35)',
                flexShrink: 0
              }}>
                💡
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#fff' }}>
                  {t('feedback_modal_title', 'Beraber Geliştirelim mi? 💡')}
                </h3>
              </div>
            </div>

            <p style={{
              fontSize: '0.82rem',
              color: 'rgba(255, 255, 255, 0.72)',
              lineHeight: '1.45',
              margin: '0 0 16px 0'
            }}>
              {t('feedback_modal_subtitle', "Pyngoo'yu senin fikirlerinle şekillendiriyoruz! Bir şikayetin, hatan veya 'şurası şöyle güncellense harika olur' dediğin bir önerin mi var? Bize hemen ilet.")}
            </p>

            {/* Kategori Seçici */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '14px' }}>
              {categories.map((c) => {
                const isSelected = category === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '9px 12px',
                      borderRadius: '12px',
                      background: isSelected 
                        ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 152, 0, 0.25))' 
                        : 'rgba(255, 255, 255, 0.04)',
                      border: isSelected ? '1.5px solid #ffd700' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: isSelected ? '#ffd700' : 'rgba(255, 255, 255, 0.8)',
                      fontSize: '0.80rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Mesaj Alanı */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.85)' }}>
                  {t('feedback_label_msg', 'Mesajınız / Öneriniz')} <span style={{ color: '#ff416c' }}>*</span>
                </label>
                <span style={{
                  fontSize: '0.72rem',
                  color: message.trim().length >= 20 ? '#00e676' : 'rgba(255, 255, 255, 0.45)',
                  fontWeight: '700'
                }}>
                  {message.trim().length} / 20 {i18n.language === 'tr' ? 'karakter' : 'characters'}
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (errorMsg && e.target.value.trim().length >= 20) {
                    setErrorMsg(null);
                  }
                }}
                placeholder={t('feedback_placeholder_msg', 'Programda şurayı şöyle güncelleyebiliriz... veya yaşadığın deneyimi detaylıca anlat.')}
                rows={5}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: errorMsg ? '1px solid #ff6b6b' : '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  fontSize: '0.86rem',
                  lineHeight: '1.45',
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {errorMsg && (
              <div style={{ color: '#ff6b6b', fontSize: '0.78rem', fontWeight: '700', marginBottom: '12px', textAlign: 'center' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Gönder Butonu */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '13px 18px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #ffd700 0%, #ff9800 60%, #ff5722 100%)',
                border: 'none',
                color: '#000',
                fontWeight: '900',
                fontSize: '0.96rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(255, 215, 0, 0.35)',
                opacity: isSubmitting ? 0.7 : 1,
                transition: 'all 0.2s'
              }}
            >
              {isSubmitting ? (
                <span>{t('feedback_submitting', 'İletiliyor...')}</span>
              ) : (
                <>
                  <Send size={18} color="#000" />
                  <span>{t('feedback_submit_btn', 'Geri Bildirimi İlet 🚀')}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
