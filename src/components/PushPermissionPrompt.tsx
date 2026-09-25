import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff } from 'lucide-react';
import { getPushPermission, requestPushPermission, registerPushToken } from '../utils/pushService';

interface Props {
  userId: string;
}

const SESSION_KEY = 'pyngoo_push_prompt_seen';
const DENIED_KEY = 'pyngoo_push_denied_hint_at';
const DENIED_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Bildirim izni ön ekranı.
 * - İzin henüz sorulmadıysa: uygulamaya her girişte (oturum başına 1 kez) açıklamalı ekran gösterilir.
 * - İzin reddedildiyse: haftada en fazla 1 kez, ayarlardan nasıl açılacağı anlatılır.
 * - İzin varsa: cihaz anahtarı sessizce yenilenir.
 */
export default function PushPermissionPrompt({ userId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'hidden' | 'ask' | 'denied'>('hidden');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const path = (e as CustomEvent).detail?.path;
      if (path) navigate(path);
    };
    window.addEventListener('pyngoo_push_open', onOpen);
    return () => window.removeEventListener('pyngoo_push_open', onOpen);
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const perm = await getPushPermission();
      if (cancelled) return;
      if (perm === 'granted') {
        registerPushToken();
        return;
      }
      let seen = false;
      try { seen = sessionStorage.getItem(SESSION_KEY) === '1'; } catch (_) {}
      if (seen) return;

      if (perm === 'prompt') {
        setMode('ask');
      } else if (perm === 'denied') {
        let last = 0;
        try { last = Number(localStorage.getItem(DENIED_KEY) || 0); } catch (_) {}
        if (Date.now() - last > DENIED_INTERVAL_MS) {
          try { localStorage.setItem(DENIED_KEY, String(Date.now())); } catch (_) {}
          setMode('denied');
        }
      }
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (_) {}
    }, 3500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [userId]);

  if (mode === 'hidden') return null;

  const handleAllow = async () => {
    setBusy(true);
    await requestPushPermission();
    setBusy(false);
    setMode('hidden');
  };

  const isAsk = mode === 'ask';

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 99990,
        background: 'rgba(5, 3, 20, 0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: '380px',
          background: 'linear-gradient(160deg, #1c1745 0%, #0f0c29 100%)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px',
          padding: '28px 22px 20px', color: '#fff', textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isAsk ? 'linear-gradient(135deg, #00f2fe 0%, #7b2ff7 100%)' : 'rgba(255,255,255,0.08)',
            boxShadow: isAsk ? '0 0 30px rgba(0, 242, 254, 0.35)' : 'none',
          }}
        >
          {isAsk ? <Bell size={34} color="#fff" /> : <BellOff size={34} color="#bdbdbd" />}
        </div>

        <h2 style={{ margin: '0 0 10px', fontSize: '1.3rem', fontWeight: 800 }}>
          {isAsk ? t('push_prompt_title') : t('push_denied_title')}
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.95rem', lineHeight: 1.5, color: 'rgba(255,255,255,0.85)' }}>
          {isAsk ? t('push_prompt_body') : t('push_denied_body')}
        </p>

        {isAsk && (
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {[t('push_prompt_point_online'), t('push_prompt_point_live')].map((line) => (
              <div
                key={line}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, padding: '10px 12px', fontSize: '0.9rem',
                }}
              >
                {line}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={isAsk ? handleAllow : () => setMode('hidden')}
          disabled={busy}
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer',
            fontWeight: 800, fontSize: '1rem', color: '#fff',
            background: isAsk ? 'linear-gradient(135deg, #00c6ff 0%, #7b2ff7 100%)' : 'rgba(255,255,255,0.12)',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {isAsk ? t('push_prompt_allow') : t('push_denied_ok')}
        </button>

        {isAsk && (
          <button
            onClick={() => setMode('hidden')}
            style={{
              width: '100%', marginTop: 8, padding: '12px', borderRadius: 14, border: 'none',
              background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
            }}
          >
            {t('push_prompt_later')}
          </button>
        )}

        <p style={{ margin: '14px 0 0', fontSize: '0.72rem', lineHeight: 1.45, color: 'rgba(255,255,255,0.45)' }}>
          {t('push_prompt_legal')}
        </p>
      </div>
    </div>
  );
}
