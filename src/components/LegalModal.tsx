import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, FileText, Lock, Cookie, AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getLegalContent } from './legalContent';

export type LegalModalType = 'terms' | 'privacy' | 'kvkk' | 'cookies' | 'refund' | null;

interface LegalModalProps {
  type: LegalModalType;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<NonNullable<LegalModalType>>(type || 'terms');

  useEffect(() => {
    if (type) setActiveTab(type);
  }, [type]);

  if (!type) return null;

  const content = getLegalContent(i18n.language);

  const getTitle = () => {
    switch (activeTab) {
      case 'terms':
        return t('legal_terms_title', content.tabs.terms);
      case 'privacy':
        return t('legal_privacy_title', content.tabs.privacy);
      case 'refund':
        return t('legal_refund_title', content.tabs.refund);
      case 'kvkk':
        return t('legal_kvkk_title', content.tabs.kvkk);
      case 'cookies':
        return t('legal_cookies_title', content.tabs.cookies);
      default:
        return '';
    }
  };

  const getIcon = () => {
    switch (activeTab) {
      case 'terms':
        return <FileText size={20} color="#00f2fe" />;
      case 'privacy':
        return <Lock size={20} color="#2ecc71" />;
      case 'refund':
        return <RefreshCw size={20} color="#ffd700" />;
      case 'kvkk':
        return <ShieldCheck size={20} color="#f39c12" />;
      case 'cookies':
        return <Cookie size={20} color="#9b59b6" />;
      default:
        return null;
    }
  };

  const tabs: Array<{ id: NonNullable<LegalModalType>; label: string; color: string }> = [
    { id: 'terms', label: content.tabs.terms, color: '#00f2fe' },
    { id: 'privacy', label: content.tabs.privacy, color: '#2ecc71' },
    { id: 'refund', label: content.tabs.refund, color: '#ffd700' },
    { id: 'kvkk', label: content.tabs.kvkk, color: '#f39c12' },
    { id: 'cookies', label: content.tabs.cookies, color: '#9b59b6' },
  ];

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        dir={content.isRtl ? 'rtl' : 'ltr'}
        style={{
          background: 'linear-gradient(180deg, #16182c 0%, #0d0e1b 100%)',
          border: '1.5px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '24px',
          width: '100%', maxWidth: '680px', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 70px rgba(0,0,0,0.9)',
          overflow: 'hidden',
          textAlign: content.isRtl ? 'right' : 'left'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px 14px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {getIcon()}
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>
              {getTitle()}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: '#fff', width: '32px', height: '32px', borderRadius: '50%',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Bar (Sekmeler) */}
        <div style={{
          display: 'flex', gap: '6px', overflowX: 'auto', padding: '10px 20px',
          background: 'rgba(0, 0, 0, 0.25)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                  border: isSelected ? `1px solid ${tab.color}` : '1px solid transparent',
                  color: isSelected ? tab.color : 'rgba(255, 255, 255, 0.65)',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  fontWeight: isSelected ? '800' : '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div style={{
          padding: '22px 24px',
          overflowY: 'auto',
          fontSize: '0.86rem',
          lineHeight: '1.65',
          color: 'rgba(255, 255, 255, 0.82)'
        }}>
          {activeTab === 'terms' && (
            <div>
              {/* Apple Guideline 1.2 Zero Tolerance Alert */}
              <div style={{
                background: 'rgba(255, 45, 85, 0.12)',
                border: '1.5px solid #ff2d55',
                borderRadius: '16px',
                padding: '14px 16px',
                marginBottom: '20px',
                display: 'flex', gap: '12px', alignItems: 'flex-start'
              }}>
                <AlertTriangle size={24} color="#ff2d55" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: '800', color: '#ff2d55', fontSize: '0.92rem', marginBottom: '4px' }}>
                    {content.zeroTolerance.title}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#fff', lineHeight: '1.4' }}>
                    {content.zeroTolerance.desc}
                  </div>
                </div>
              </div>

              <h4 style={{ color: '#00f2fe', margin: '14px 0 6px 0' }}>{content.terms.ageTitle}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.terms.ageDesc}</p>

              <h4 style={{ color: '#00f2fe', margin: '14px 0 6px 0' }}>{content.terms.modTitle}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.terms.modDesc}</p>

              <h4 style={{ color: '#00f2fe', margin: '14px 0 6px 0' }}>{content.terms.blockTitle}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.terms.blockDesc}</p>

              <h4 style={{ color: '#00f2fe', margin: '14px 0 6px 0' }}>{content.terms.coinsTitle}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.terms.coinsDesc}</p>

              <h4 style={{ color: '#00f2fe', margin: '14px 0 6px 0' }}>{content.terms.deleteTitle}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.terms.deleteDesc}</p>
            </div>
          )}

          {activeTab === 'refund' && (
            <div>
              {/* Güvence Rozeti */}
              <div style={{
                background: 'rgba(255, 215, 0, 0.08)',
                border: '1.5px solid rgba(255, 215, 0, 0.4)',
                borderRadius: '16px',
                padding: '14px 16px',
                marginBottom: '18px',
                display: 'flex', gap: '12px', alignItems: 'center'
              }}>
                <RefreshCw size={26} color="#ffd700" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: '800', color: '#ffd700', fontSize: '0.90rem' }}>
                    {content.refund.badgeTitle}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', marginTop: '3px' }}>
                    {content.refund.badgeDesc}
                  </div>
                </div>
              </div>

              <h4 style={{ color: '#ffd700', margin: '12px 0 6px 0' }}>{content.refund.sec1Title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.refund.sec1Desc}</p>

              <h4 style={{ color: '#ffd700', margin: '14px 0 6px 0' }}>{content.refund.sec2Title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.refund.sec2Desc}</p>

              <h4 style={{ color: '#ffd700', margin: '14px 0 6px 0' }}>{content.refund.sec3Title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.refund.sec3Desc}</p>

              <h4 style={{ color: '#ffd700', margin: '14px 0 6px 0' }}>{content.refund.sec4Title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.refund.sec4Desc}</p>

              <h4 style={{ color: '#ffd700', margin: '14px 0 6px 0' }}>{content.refund.sec5Title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.refund.sec5Desc}</p>

              <h4 style={{ color: '#ffd700', margin: '14px 0 6px 0' }}>{content.refund.sec6Title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.refund.sec6Desc}</p>

              <h4 style={{ color: '#ffd700', margin: '14px 0 6px 0' }}>{content.refund.sec7Title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.refund.sec7Desc}</p>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div>
              <h4 style={{ color: '#2ecc71', margin: '0 0 6px 0' }}>{content.privacy.sec1Title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.privacy.sec1Desc}</p>

              <h4 style={{ color: '#2ecc71', margin: '14px 0 6px 0' }}>{content.privacy.sec2Title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.privacy.sec2Desc}</p>

              <h4 style={{ color: '#2ecc71', margin: '14px 0 6px 0' }}>{content.privacy.sec3Title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.privacy.sec3Desc}</p>

              <h4 style={{ color: '#2ecc71', margin: '14px 0 6px 0' }}>{content.privacy.sec4Title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.privacy.sec4Desc}</p>
            </div>
          )}

          {activeTab === 'kvkk' && (
            <div>
              <h4 style={{ color: '#f39c12', margin: '0 0 6px 0' }}>{content.kvkk.sec1Title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.kvkk.sec1Desc}</p>

              <h4 style={{ color: '#f39c12', margin: '14px 0 6px 0' }}>{content.kvkk.sec2Title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.kvkk.sec2Desc}</p>

              <h4 style={{ color: '#f39c12', margin: '14px 0 6px 0' }}>{content.kvkk.sec3Title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.kvkk.sec3Desc}</p>
            </div>
          )}

          {activeTab === 'cookies' && (
            <div>
              <h4 style={{ color: '#9b59b6', margin: '0 0 6px 0' }}>{content.cookies.title}</h4>
              <p style={{ margin: '0 0 12px 0' }}>{content.cookies.desc}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', justifyContent: 'flex-end',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              border: 'none', color: '#000', fontWeight: '800', fontSize: '0.90rem',
              cursor: 'pointer'
            }}
          >
            {t('legal_modal_close', 'Anladım & Kapat')}
          </button>
        </div>
      </div>
    </div>
  );
};
export default LegalModal;
