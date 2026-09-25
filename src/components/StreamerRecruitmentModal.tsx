import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Sparkles, ShieldCheck, 
  Upload, Camera, X, Check, DollarSign, Wallet, Coins
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validateAndSanitizeImage } from '../utils/imageSecurity';

interface StreamerRecruitmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  profile: any;
  onStreamerActivated?: (updatedProfile: any) => void;
}

export default function StreamerRecruitmentModal({
  isOpen,
  onClose,
  userId,
  profile,
  onStreamerActivated
}: StreamerRecruitmentModalProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<'intro' | 'upload' | 'success'>('intro');
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(profile?.avatar || null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Fotoğraf Yükleme ve Canvas ile Optimize Etme (Askeri Düzeyde Güvenlik)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await validateAndSanitizeImage(file, 600, 0.88);
      if (!result.valid || !result.sanitizedDataUrl) {
        setUploadError(t(result.errorKey || 'photo_err_invalid_type', result.errorFallback || 'Lütfen geçerli bir resim dosyası seçin.'));
        return;
      }
      setUploadedPhoto(result.sanitizedDataUrl);
    } catch (_) {
      setUploadError(t('photo_err_processing', 'Görsel işleme sırasında hata oluştu.'));
    }
  };

  // Yayıncı Profilini Kaydet & Keşfette En Üste Çıkar
  const handleActivateStreamer = async () => {
    if (!uploadedPhoto) {
      setUploadError(t('streamer_err_photo_required', 'Lütfen galerinizden bir profil görseli yükleyin!'));
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Supabase Profiles Güncelle (Avatar, is_streamer, is_streamer_online ve role sütunlarını güvenle kaydet)
      const { error: fullUpdateErr } = await supabase
        .from('profiles')
        .update({ 
          role: 'streamer',
          avatar: uploadedPhoto,
          is_streamer: true,
          is_streamer_online: true
        })
        .eq('id', userId);

      if (fullUpdateErr) {
        console.warn('Tam profil güncelleme başarısız, role fallback uygulanıyor:', fullUpdateErr);
        await supabase
          .from('profiles')
          .update({ role: 'streamer', is_streamer: true, is_streamer_online: true })
          .eq('id', userId);
      }

      try {
        await supabase.auth.updateUser({
          // Avatar (base64) ASLA auth metadata'ya yazılmaz: giriş token'ını şişirip girişi bozar.
          data: {
            role: 'streamer',
            is_streamer: true
          }
        });
      } catch (_) {}

      // 2. Local Storage Senkronizasyonu & Canlı Durumu
      localStorage.setItem(`pyngoo_is_streamer_${userId}`, 'true');
      localStorage.setItem(`pyngoo_streamer_avatar_${userId}`, uploadedPhoto);
      localStorage.setItem(`pyngoo_streamer_online_${userId}`, 'true');

      // Realtime Supabase Broadcast (Keşfet ekranındaki tüm istemciler anında görsün)
      try {
        const statusCh = supabase.channel('pyngoo_streamer_status_channel');
        statusCh.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            statusCh.send({
              type: 'broadcast',
              event: 'streamer_status_changed',
              payload: { userId, isOnline: true }
            });
            setTimeout(() => { try { supabase.removeChannel(statusCh); } catch (_) {} }, 2000);
          }
        });
      } catch (_) {}

      // 3. Waiting Room'a anında canlı yayıncı olarak yerleştir (Keşfet ve çağrılar için)
      try {
        await supabase.from('waiting_room').upsert([{ 
          user_id: userId,
          gender: 'kadin',
          chat_mode: 'video',
          joined_at: new Date().toISOString()
        }], { onConflict: 'user_id' });
      } catch (_) {}

      // 4. Keşfet Sayfasına & Diğer Bileşenlere Canlı Yayıncı Sinyali Gönder
      window.dispatchEvent(new CustomEvent('pyngoo_streamer_updated', {
        detail: { userId, avatar: uploadedPhoto }
      }));
      window.dispatchEvent(new CustomEvent('pyngoo_streamer_online_changed', {
        detail: { isOnline: true }
      }));

      if (onStreamerActivated) {
        onStreamerActivated({ ...profile, role: 'streamer', is_streamer: true, is_streamer_online: true, avatar: uploadedPhoto });
      }

      setStep('success');
    } catch (err) {
      console.error('Yayıncı aktivasyon hatası:', err);
      localStorage.setItem(`pyngoo_is_streamer_${userId}`, 'true');
      setStep('success');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    onClose();
  };

  const handleGoToCockpit = () => {
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10005,
      background: 'rgba(5, 5, 16, 0.88)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      animation: 'fadeIn 0.3s ease'
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '430px',
        background: 'linear-gradient(165deg, #1b132e 0%, #110d22 50%, #0d091a 100%)',
        border: '1.5px solid rgba(255, 215, 0, 0.55)',
        borderRadius: '26px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(255, 215, 0, 0.22)',
        overflow: 'hidden',
        color: '#fff',
        animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>

        {/* Kapatma Çarpı Butonu (Tek Çıkış) */}
        <button
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.12)',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            transition: 'background 0.2s'
          }}
          title="Kapat"
        >
          <X size={18} />
        </button>

        {/* Üst Parlayan Altın & Para Işıltı Efekti */}
        <div style={{
          position: 'absolute',
          top: '-70px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '260px',
          height: '140px',
          background: 'radial-gradient(circle, rgba(255, 215, 0, 0.45) 0%, rgba(46, 204, 113, 0.3) 50%, transparent 80%)',
          filter: 'blur(32px)',
          pointerEvents: 'none'
        }} />

        {/* ========================================================= */}
        {/* ADIM 1: ULTRA CEZBEDİCİ YAYINCI OL & PARA KAZAN EKRANI     */}
        {/* ========================================================= */}
        {step === 'intro' && (
          <div style={{ padding: '28px 20px 24px', textAlign: 'center', position: 'relative' }}>
            
            {/* Altın / Dolar Kazanç Rozeti */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.28), rgba(46, 204, 113, 0.28))',
              border: '1px solid #ffd700',
              color: '#ffd700',
              fontSize: '0.76rem',
              fontWeight: '900',
              letterSpacing: '0.5px',
              marginBottom: '14px',
              boxShadow: '0 0 20px rgba(255, 215, 0, 0.35)'
            }}>
              <DollarSign size={15} color="#2ecc71" strokeWidth={3} />
              <span>{t('recruit_badge')}</span>
            </div>

            {/* Büyük Başlık - Düzeltilmiş ve Çekici */}
            <h2 style={{
              fontSize: '1.65rem',
              fontWeight: '900',
              margin: '0 0 8px',
              background: 'linear-gradient(135deg, #ffffff 15%, #ffd700 60%, #2ecc71 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: '1.25'
            }}>
              {t('recruit_title')}
            </h2>

            <p style={{
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: '0.88rem',
              lineHeight: '1.45',
              margin: '0 0 18px',
              padding: '0 6px'
            }}>
              <span dangerouslySetInnerHTML={{ __html: t('recruit_desc') }} />
            </p>

            {/* 4 Ana Avantaj Kartı - Gerçek Para ve Dolar Simgeleriyle */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '22px', textAlign: 'left' }}>
              
              {/* Kart 1: Dakika Başı Nakit Para */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(46, 204, 113, 0.4)',
                borderRadius: '16px',
                padding: '12px 10px',
                boxShadow: '0 4px 15px rgba(46, 204, 113, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2ecc71', fontWeight: '800', fontSize: '0.82rem', marginBottom: '4px' }}>
                  <DollarSign size={16} strokeWidth={3} />
                  <span>{t('recruit_perk_cash_title')}</span>
                </div>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.72)', fontSize: '0.73rem', lineHeight: '1.35' }}>
                  {t('recruit_perk_cash_desc')}
                </p>
              </div>

              {/* Kart 2: Canlı Hediyeler & Bahşişler */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 215, 0, 0.4)',
                borderRadius: '16px',
                padding: '12px 10px',
                boxShadow: '0 4px 15px rgba(255, 215, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ffd700', fontWeight: '800', fontSize: '0.82rem', marginBottom: '4px' }}>
                  <Coins size={16} />
                  <span>{t('recruit_perk_gifts_title')}</span>
                </div>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.72)', fontSize: '0.73rem', lineHeight: '1.35' }}>
                  {t('recruit_perk_gifts_desc')}
                </p>
              </div>

              {/* Kart 3: Hızlı IBAN & Papara Çekimi */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(0, 242, 254, 0.4)',
                borderRadius: '16px',
                padding: '12px 10px',
                boxShadow: '0 4px 15px rgba(0, 242, 254, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00f2fe', fontWeight: '800', fontSize: '0.82rem', marginBottom: '4px' }}>
                  <Wallet size={16} />
                  <span>{t('recruit_perk_payout_title')}</span>
                </div>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.72)', fontSize: '0.73rem', lineHeight: '1.35' }}>
                  {t('recruit_perk_payout_desc')}
                </p>
              </div>

              {/* Kart 4: %100 Yüz Gizliliği */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 65, 108, 0.4)',
                borderRadius: '16px',
                padding: '12px 10px',
                boxShadow: '0 4px 15px rgba(255, 65, 108, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff416c', fontWeight: '800', fontSize: '0.82rem', marginBottom: '4px' }}>
                  <ShieldCheck size={16} />
                  <span>{t('recruit_perk_privacy_title')}</span>
                </div>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.72)', fontSize: '0.73rem', lineHeight: '1.35' }}>
                  {t('recruit_perk_privacy_desc')}
                </p>
              </div>

            </div>

            {/* Büyük Cezbedici Başlama Butonu */}
            <button
              onClick={() => {
                setStep('upload');
              }}
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, #2ecc71 0%, #11998e 45%, #ffd700 100%)',
                border: 'none',
                color: '#000',
                fontSize: '1.02rem',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 8px 30px rgba(46, 204, 113, 0.5)',
                transition: 'transform 0.15s'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>💰</span>
              <span>{t('recruit_cta')}</span>
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* ADIM 2: GALERİDEN ZORUNLU FOTOĞRAF YÜKLEME EKRANI          */}
        {/* ========================================================= */}
        {step === 'upload' && (
          <div style={{ padding: '28px 20px 24px', textAlign: 'center' }}>
            
            <h2 style={{
              fontSize: '1.4rem',
              fontWeight: '900',
              margin: '0 0 6px',
              color: '#fff'
            }}>
              {t('recruit_upload_title')}
            </h2>

            <p style={{
              color: 'rgba(255, 255, 255, 0.75)',
              fontSize: '0.82rem',
              lineHeight: '1.4',
              margin: '0 0 20px'
            }}>
              {t('recruit_upload_desc')}
            </p>

            {/* Gizli File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {/* Büyük Fotoğraf Yükleme / Önizleme Alanı */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '130px',
                height: '130px',
                margin: '0 auto 16px',
                borderRadius: '50%',
                padding: '4px',
                background: uploadedPhoto 
                  ? 'linear-gradient(135deg, #2ecc71, #ffd700)' 
                  : 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,215,0,0.4))',
                boxShadow: uploadedPhoto 
                  ? '0 0 30px rgba(46, 204, 113, 0.45)' 
                  : '0 0 20px rgba(255, 215, 0, 0.25)',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              {uploadedPhoto ? (
                <>
                  <img
                    src={uploadedPhoto}
                    alt={t('recruit_photo_alt')}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      objectFit: 'cover'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '4px',
                    right: '4px',
                    background: '#2ecc71',
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #110d22',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.6)'
                  }}
                  title={t('recruit_change_photo')}
                  >
                    <Check size={18} color="#fff" strokeWidth={3} />
                  </div>
                </>
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '2px dashed rgba(255, 215, 0, 0.7)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  color: '#ffd700'
                }}>
                  <Camera size={34} />
                  <span style={{ fontSize: '0.70rem', fontWeight: '800' }}>{t('recruit_upload_photo')}</span>
                </div>
              )}
            </div>

            {/* Galeriden Yükle Butonu */}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 20px',
                borderRadius: '20px',
                background: uploadedPhoto ? 'rgba(46, 204, 113, 0.18)' : 'rgba(255, 215, 0, 0.18)',
                border: uploadedPhoto ? '1px solid #2ecc71' : '1px solid #ffd700',
                color: uploadedPhoto ? '#2ecc71' : '#ffd700',
                fontSize: '0.84rem',
                fontWeight: '800',
                cursor: 'pointer',
                marginBottom: '16px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                transition: 'all 0.2s'
              }}
            >
              <Upload size={16} />
              <span>{uploadedPhoto ? t('recruit_photo_selected') : t('recruit_upload_required')}</span>
            </button>

            {uploadError && (
              <div style={{ color: '#ff6b6b', fontSize: '0.78rem', fontWeight: '700', marginBottom: '14px' }}>
                {uploadError}
              </div>
            )}

            {/* ÖNEMLİ GİZLİLİK UYARISI BANNERI */}
            <div style={{
              background: 'rgba(0, 242, 254, 0.08)',
              border: '1px solid rgba(0, 242, 254, 0.35)',
              borderRadius: '16px',
              padding: '12px 14px',
              marginBottom: '22px',
              textAlign: 'left',
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '1.4rem' }}>🔒</span>
              <p style={{
                margin: 0,
                color: '#e0f7fa',
                fontSize: '0.75rem',
                lineHeight: '1.45',
                fontWeight: '600'
              }}>
                {t('streamer_upload_privacy_warning').replace(/^🔒\s*/, '')}
              </p>
            </div>

            {/* TEK ANA BUTON (Geri Tuşu Kaldırıldı, Çarpı Zaten Üstte Var) */}
            <button
              onClick={handleActivateStreamer}
              disabled={isSubmitting || !uploadedPhoto}
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: '18px',
                background: uploadedPhoto 
                  ? 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)' 
                  : 'rgba(255, 255, 255, 0.12)',
                border: 'none',
                color: uploadedPhoto ? '#000' : 'rgba(255,255,255,0.4)',
                fontSize: '0.98rem',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: uploadedPhoto && !isSubmitting ? 'pointer' : 'not-allowed',
                boxShadow: uploadedPhoto ? '0 6px 25px rgba(0, 242, 254, 0.45)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              <Sparkles size={18} />
              <span>
                {!uploadedPhoto 
                  ? t('recruit_upload_first')
                  : (isSubmitting ? t('recruit_saving') : t('streamer_upload_submit'))}
              </span>
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* ADIM 3: TEBRİKLER & KEŞFETTE EN ÜSTTESİN KUTLAMASI         */}
        {/* ========================================================= */}
        {step === 'success' && (
          <div style={{ padding: '36px 22px 28px', textAlign: 'center' }}>
            <div style={{
              width: '75px',
              height: '75px',
              borderRadius: '50%',
              margin: '0 auto 16px',
              background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 30px rgba(46, 204, 113, 0.5)',
              animation: 'bounceIn 0.5s ease'
            }}>
              <Sparkles size={38} color="#fff" />
            </div>

            <h2 style={{
              fontSize: '1.55rem',
              fontWeight: '900',
              margin: '0 0 8px',
              color: '#fff'
            }}>
              {t('streamer_success_title')}
            </h2>

            <p style={{
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: '0.88rem',
              lineHeight: '1.45',
              margin: '0 0 22px',
              padding: '0 6px'
            }}>
              <span dangerouslySetInnerHTML={{ __html: t('recruit_success_desc') }} />
            </p>

            <button
              onClick={handleGoToCockpit}
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, #2ecc71 0%, #11998e 100%)',
                border: 'none',
                color: '#fff',
                fontSize: '1.02rem',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 8px 25px rgba(46, 204, 113, 0.45)'
              }}
            >
              <span>{t('recruit_go_cockpit')}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
