import { useEffect, useState } from 'react';
import { ShieldAlert, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PrivacyShieldProps {
  children?: React.ReactNode;
  activeUserId?: string | null;
  userName?: string | null;
  enabled?: boolean;
  isPrivateCall?: boolean;
}

export default function PrivacyShield({ 
  children, 
  activeUserId,
  userName,
  enabled = true, 
  isPrivateCall = false 
}: PrivacyShieldProps) {
  const { t } = useTranslation();
  const [isPrivacyCurtain, setIsPrivacyCurtain] = useState(false);

  useEffect(() => {
    // Eşleşme ekranında veya koruma devre dışı bırakıldığında hiçbir engelleme yapma
    if (!enabled) {
      setIsPrivacyCurtain(false);
      return;
    }

    // 1. Sekme Değiştirme ve Mobil Arka Plana Atma Tespiti
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPrivacyCurtain(true);
      } else {
        setIsPrivacyCurtain(false);
      }
    };

    // Mobil Safari / Chrome: Denetim Merkezi (Control Center) veya Bildirim Çubuğu çekildiğinde
    const handlePageHide = () => {
      if (isPrivateCall) {
        setIsPrivacyCurtain(true);
      }
    };

    // 2. Özel görüşmelerde pencere odağı kaybolduğunda (harici ekran kaydı/alıntı aracı açıldığında) perdeyi aç
    const handleWindowBlur = () => {
      if (isPrivateCall) {
        setIsPrivacyCurtain(true);
      }
    };

    const handleWindowFocus = () => {
      if (isPrivateCall) {
        setIsPrivacyCurtain(false);
      }
    };

    // 3. Klavye Kısayolları ve PrintScreen Engelleme + Pano Temizleme (Clipboard Wiping)
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen Tuşu
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        setIsPrivacyCurtain(true);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(
            isPrivateCall 
              ? t('shield_clipboard_private')
              : t('shield_clipboard_general')
          ).catch(() => {});
        }
        setTimeout(() => setIsPrivacyCurtain(false), 2500);
        return false;
      }

      // Windows Ekran Alıntısı: Win + Shift + S veya Ctrl + Shift + S
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        setIsPrivacyCurtain(true);
        setTimeout(() => setIsPrivacyCurtain(false), 2500);
        return false;
      }

      // Mac Ekran Görüntüsü: Cmd + Shift + 3 / 4 / 5
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        setIsPrivacyCurtain(true);
        setTimeout(() => setIsPrivacyCurtain(false), 2500);
        return false;
      }

      // Alt + PrintScreen
      if (e.altKey && (e.key === 'PrintScreen' || e.keyCode === 44)) {
        e.preventDefault();
        setIsPrivacyCurtain(true);
        setTimeout(() => setIsPrivacyCurtain(false), 2500);
        return false;
      }

      // Kaynak Kod / DevTools / Sayfa Kaydet: Ctrl+U, F12, Ctrl+Shift+I, Ctrl+S
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c'))
      ) {
        e.preventDefault();
        return false;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('').catch(() => {});
        }
      }
    };

    // 4. Sağ Tık ve Sürükleme Engelleme (Sadece koruma aktifken)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    // 5. Tarayıcı İçi Ekran Paylaşımı / Kaydı API'sini Engelle (getDisplayMedia koruması)
    let originalGetDisplayMedia: any = null;
    if (isPrivateCall && navigator.mediaDevices && (navigator.mediaDevices as any).getDisplayMedia) {
      originalGetDisplayMedia = (navigator.mediaDevices as any).getDisplayMedia;
      (navigator.mediaDevices as any).getDisplayMedia = async () => {
        setIsPrivacyCurtain(true);
        throw new Error('🔒 Pyngoo Özel Görüşme: Ekran kaydı ve ekran paylaşımı kesinlikle yasaktır.');
      };
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);

    if (isPrivateCall) {
      window.addEventListener('blur', handleWindowBlur);
      window.addEventListener('focus', handleWindowFocus);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);

      if (isPrivateCall) {
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
        if (originalGetDisplayMedia && navigator.mediaDevices) {
          (navigator.mediaDevices as any).getDisplayMedia = originalGetDisplayMedia;
        }
      }
    };
  }, [enabled, isPrivateCall]);

  if (!enabled) {
    return <>{children}</>;
  }

  const userIdentifier = userName ? `@${userName}` : (activeUserId ? `ID: ${activeUserId.slice(0, 8)}` : 'Pyngoo User');

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', userSelect: 'none', WebkitUserSelect: 'none' }}>
      {children}

      {/* 🛡️ ADLİ GİZLİLİK FİLİGRANI (Forensic Watermark - Sadece Özel Görüşmede) */}
      {isPrivateCall && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 40,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '16px',
            opacity: 0.22,
            mixBlendMode: 'difference'
          }}
        >
          {/* Üst Kayan Filigran */}
          <div style={{
            fontSize: '0.70rem',
            fontWeight: '800',
            color: '#fff',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%'
          }}>
            <span>{t('shield_wm_private_call')} • {userIdentifier}</span>
            <span>{t('shield_wm_no_recording')}</span>
          </div>

          {/* Orta Çapraz Fligran */}
          <div style={{
            alignSelf: 'center',
            transform: 'rotate(-25deg)',
            fontSize: '1rem',
            fontWeight: '900',
            color: '#fff',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            border: '1px dashed rgba(255,255,255,0.4)',
            padding: '6px 16px',
            borderRadius: '8px'
          }}>
            {t('shield_wm_secret_call')} • {userIdentifier}
          </div>

          {/* Alt Kayan Filigran */}
          <div style={{
            fontSize: '0.68rem',
            fontWeight: '700',
            color: '#fff',
            letterSpacing: '1px',
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%'
          }}>
            <span>ID: {activeUserId ? activeUserId.slice(0, 12) : 'SECURE'}</span>
            <span>{t('shield_wm_detected')}</span>
          </div>
        </div>
      )}

      {/* 🔒 GİZLİLİK PERDESİ (Ekran Alıntısı Aracı Açıldığında, Sekme Değiştiğinde veya Özel Aramada Odağı Kaybettiğinde Görüntüyü Karartır) */}
      {isPrivacyCurtain && (
        <div
          onClick={() => setIsPrivacyCurtain(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#0a0a14',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            padding: '24px',
            textAlign: 'center',
            cursor: 'pointer'
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: isPrivateCall ? 'rgba(255, 45, 85, 0.2)' : 'rgba(255, 45, 85, 0.15)',
              border: '2px solid #ff2d55',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              boxShadow: isPrivateCall ? '0 0 35px rgba(255, 45, 85, 0.5)' : 'none'
            }}
          >
            {isPrivateCall ? <Lock size={42} color="#ff2d55" /> : <ShieldAlert size={44} color="#ff2d55" />}
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '10px' }}>
            {isPrivateCall 
              ? t('privacy_shield_private_title', '🔒 Özel Görüşme Gizlilik Koruması')
              : t('privacy_shield_title', 'Gizlilik & Güvenlik Koruması Aktif')
            }
          </h2>
          <p style={{ maxWidth: '440px', color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', lineHeight: '1.5' }}>
            {isPrivateCall
              ? t(
                  'privacy_shield_private_desc',
                  'Bu görüşme özel ve gizlidir. Karşı tarafın mahremiyetini korumak amacıyla ekran görüntüsü alma veya ekran kaydı başlatma kesinlikle engellenmiştir.'
                )
              : t(
                  'privacy_shield_desc',
                  'Kullanıcı gizliliğini korumak amacıyla ekran görüntüsü alma veya harici kayıt araçları algılandığında görüntü geçici olarak karartılır.'
                )
            }
          </p>
          <span style={{ marginTop: '24px', fontSize: '0.85rem', color: '#00f2fe', fontWeight: '700' }}>
            {t('privacy_shield_return', 'Devam etmek için ekrana dokunun veya tıklayın.')}
          </span>
        </div>
      )}
    </div>
  );
}
