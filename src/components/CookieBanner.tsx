import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Info, X, Check } from 'lucide-react';

interface CookieBannerProps {
  forceOpenModal?: boolean;
  onCloseModal?: () => void;
}

export default function CookieBanner({ forceOpenModal, onCloseModal }: CookieBannerProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('pyngoo_cookie_consent');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (forceOpenModal) {
      setShowModal(true);
    }
  }, [forceOpenModal]);

  const handleAcceptAll = () => {
    localStorage.setItem('pyngoo_cookie_consent', 'all');
    setIsVisible(false);
  };

  const handleEssentialOnly = () => {
    localStorage.setItem('pyngoo_cookie_consent', 'essential');
    setIsVisible(false);
  };

  const handleClosePolicyModal = () => {
    setShowModal(false);
    if (onCloseModal) onCloseModal();
  };

  return (
    <>
      {/* 1. ALT ÇEREZ BİLDİRİM BARI (BANNER) */}
      {isVisible && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 40px)',
            maxWidth: '920px',
            zIndex: 9999,
            background: 'rgba(12, 13, 28, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 242, 254, 0.35)',
            borderRadius: '20px',
            padding: '18px 24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 242, 254, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            flexWrap: 'wrap'
          }}
        >
          {/* Sol: İkon & Açıklama */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: '1 1 450px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(0, 242, 254, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <ShieldCheck size={24} color="#00f2fe" />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>
                {t('cookie_title')}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: '1.45' }}>
                {t('cookie_desc')}{' '}
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#00f2fe',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '0.82rem',
                    fontWeight: '600'
                  }}
                >
                  {t('cookie_details_btn')}
                </button>
              </div>
            </div>
          </div>

          {/* Sağ: Aksiyon Butonları */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleEssentialOnly}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'rgba(255, 255, 255, 0.85)',
                padding: '9px 18px',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
              onMouseOut={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
            >
              {t('cookie_essential')}
            </button>

            <button
              type="button"
              onClick={handleAcceptAll}
              style={{
                background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                border: 'none',
                color: '#050510',
                padding: '9px 22px',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 0 15px rgba(0, 242, 254, 0.35)',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.03)')}
              onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <Check size={16} /> {t('cookie_accept')}
            </button>
          </div>
        </div>
      )}

      {/* 2. ÇEREZ POLİTİKASI DETAY MODALI */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={handleClosePolicyModal}
        >
          <div
            style={{
              background: '#0d0e20',
              border: '1px solid rgba(0, 242, 254, 0.3)',
              borderRadius: '24px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              color: '#fff',
              position: 'relative',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 242, 254, 0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Kapat Butonu */}
            <button
              type="button"
              onClick={handleClosePolicyModal}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#fff',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Info size={24} color="#00f2fe" />
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>
                {t('cookie_modal_title')}
              </h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.5', marginBottom: '20px' }}>
              {t('cookie_modal_intro')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '14px 16px', borderRadius: '14px' }}>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#00f2fe', marginBottom: '4px' }}>
                  {t('cookie_item_1_title')}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.45' }}>
                  {t('cookie_item_1_desc')}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '14px 16px', borderRadius: '14px' }}>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#ff416c', marginBottom: '4px' }}>
                  {t('cookie_item_2_title')}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.45' }}>
                  {t('cookie_item_2_desc')}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '14px 16px', borderRadius: '14px' }}>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#ffd700', marginBottom: '4px' }}>
                  {t('cookie_item_3_title')}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.45' }}>
                  {t('cookie_item_3_desc')}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClosePolicyModal}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                border: 'none',
                color: '#050510',
                padding: '12px',
                borderRadius: '16px',
                fontWeight: '700',
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              {t('cookie_modal_close')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
