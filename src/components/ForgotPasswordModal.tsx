import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  initialEmail?: string;
  onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_SECONDS = 60;

/**
 * Şifremi unuttum: e-postaya 6 haneli kod gönderilir, kod + yeni şifre uygulama içinde girilir.
 * - Kayıtlı olsun olmasın aynı mesaj gösterilir (e-posta sorgulama engeli).
 * - Şifre değişince diğer cihazlardaki oturumlar kapatılır.
 */
export default function ForgotPasswordModal({ initialEmail = '', onClose }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = useState(initialEmail.trim());
  const [code, setCode] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      setError(t('fp_err_email'));
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (err && /rate|limit|seconds/i.test(err.message)) {
        setError(t('fp_err_rate'));
        setBusy(false);
        return;
      }
      // Diğer hatalarda da aynı mesaj: e-postanın kayıtlı olup olmadığı dışarı sızmasın.
    } catch (_) { /* aynı mesaj */ }
    setEmail(cleanEmail);
    setStep('code');
    setCooldown(RESEND_SECONDS);
    setBusy(false);
  };

  const saveNewPassword = async () => {
    setError(null);
    const token = code.replace(/\D/g, '');
    if (token.length !== 6) {
      setError(t('fp_err_code'));
      return;
    }
    if (pw1.length < 6) {
      setError(t('fp_err_password'));
      return;
    }
    if (pw1 !== pw2) {
      setError(t('fp_err_mismatch'));
      return;
    }
    setBusy(true);
    try {
      const { data, error: vErr } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
      if (vErr || !data?.session) {
        setError(/rate|limit/i.test(vErr?.message || '') ? t('fp_err_rate') : t('fp_err_code'));
        setBusy(false);
        return;
      }
      const { error: uErr } = await supabase.auth.updateUser({ password: pw1 });
      if (uErr) {
        setError(t('fp_err_generic'));
        setBusy(false);
        return;
      }
      // Güvenlik: bu cihaz dışındaki tüm oturumları kapat
      try { await supabase.auth.signOut({ scope: 'others' }); } catch (_) {}
      setStep('done');
    } catch (_) {
      setError(t('fp_err_generic'));
    }
    setBusy(false);
  };

  const inputStyle: CSSProperties = {
    width: '100%', padding: '13px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
  };
  const primaryBtn: CSSProperties = {
    width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
    background: 'linear-gradient(135deg, #00f2fe, #4facfe)', color: '#050510',
    fontSize: '1rem', fontWeight: 900, cursor: 'pointer', opacity: busy ? 0.7 : 1,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 99995, background: 'rgba(5,3,20,0.75)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <div
        style={{
          position: 'relative', width: '100%', maxWidth: '380px',
          background: 'linear-gradient(160deg, #1c1745 0%, #0f0c29 100%)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '22px',
          padding: '26px 20px 20px', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('fp_back')}
          style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', margin: '0 auto 10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #00f2fe 0%, #7b2ff7 100%)',
          }}>
            <KeyRound size={26} color="#fff" />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>{t('fp_title')}</h2>
        </div>

        {step === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.45, color: 'rgba(255,255,255,0.85)' }}>{t('fp_email_desc')}</p>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={t('fp_email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            <button type="button" onClick={sendCode} disabled={busy} style={primaryBtn}>{t('fp_send_code')}</button>
          </div>
        )}

        {step === 'code' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.45, color: '#00f2fe' }}>{t('fp_sent_info')}</p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder={t('fp_code_placeholder')}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ ...inputStyle, textAlign: 'center', letterSpacing: '8px', fontSize: '1.3rem', fontWeight: 800 }}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder={t('fp_new_password')}
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder={t('fp_new_password_repeat')}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              style={inputStyle}
            />
            <button type="button" onClick={saveNewPassword} disabled={busy} style={primaryBtn}>{t('fp_save')}</button>
            <button
              type="button"
              onClick={sendCode}
              disabled={busy || cooldown > 0}
              style={{ background: 'transparent', border: 'none', color: cooldown > 0 ? 'rgba(255,255,255,0.4)' : '#00f2fe', fontSize: '0.85rem', cursor: cooldown > 0 ? 'default' : 'pointer' }}
            >
              {cooldown > 0 ? t('fp_resend_wait', { sec: cooldown }) : t('fp_resend')}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5, color: '#00e676', fontWeight: 700 }}>{t('fp_success')}</p>
            <button type="button" onClick={onClose} style={primaryBtn}>{t('fp_continue')}</button>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 12, color: '#ff4b72', fontSize: '0.85rem', textAlign: 'center', fontWeight: 700,
            background: 'rgba(255,75,114,0.12)', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,75,114,0.35)',
          }}>
            {error}
          </div>
        )}

        {step !== 'done' && (
          <p style={{ margin: '14px 0 0', fontSize: '0.75rem', lineHeight: 1.45, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
            {t('fp_social_note')}
          </p>
        )}
      </div>
    </div>
  );
}
