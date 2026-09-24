import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import { Gift, Check, Coins, Gem, UserPlus, Clock, X, Sparkles } from 'lucide-react';
import { logTransaction } from '../utils/transactionService';

interface DailyRewardsProps {
  profile: any;
  onClose: () => void;
  onClaimSuccess: (newProfileData: any) => void;
}

export const REWARDS = [
  { day: 1, gold: 10, diamond: 0, friend: 0, extend: 0 },
  { day: 2, gold: 20, diamond: 0, friend: 0, extend: 0 },
  { day: 3, gold: 30, diamond: 0, friend: 1, extend: 0 },
  { day: 4, gold: 40, diamond: 0, friend: 0, extend: 0 },
  { day: 5, gold: 50, diamond: 0, friend: 0, extend: 1 },
  { day: 6, gold: 80, diamond: 0, friend: 0, extend: 0 },
  { day: 7, gold: 150, diamond: 1, friend: 2, extend: 2 },
];

export default function DailyRewards({ profile, onClose, onClaimSuccess }: DailyRewardsProps) {
  const { t } = useTranslation();
  const [claiming, setClaiming] = useState(false);
  const [streak, setStreak] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isClaimedToday, setIsClaimedToday] = useState(false);

  useEffect(() => {
    let currentStreak = profile.login_streak || 0;
    const lastReward = profile.last_reward_date ? new Date(profile.last_reward_date) : null;
    const today = new Date();
    const now = Date.now();
    const lastTime = lastReward ? lastReward.getTime() : 0;
    
    const claimedToday = Boolean(lastReward && (
      lastReward.toDateString() === today.toDateString() ||
      (now - lastTime < 20 * 60 * 60 * 1000)
    ));
    setIsClaimedToday(claimedToday);

    if (lastReward) {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      
      if (lastReward.toDateString() === yesterday.toDateString()) {
        currentStreak = (currentStreak % 7);
      } else if (claimedToday) {
        // Bugün zaten alınmış, seri korunur
        currentStreak = (currentStreak > 0 ? (currentStreak - 1) % 7 + 1 : 1);
      } else {
        currentStreak = 0; // Seri bozuldu
      }
    }
    setStreak(currentStreak);
  }, [profile]);

  const handleClaim = async () => {
    if (claiming || isClaimedToday) return;
    setClaiming(true);

    try {
      let data: any = null;
      let addedGold = 0;

      const { data: res, error } = await supabase.rpc('claim_daily_reward');

      if (!error && res?.success) {
        data = res.profile;
        addedGold = res.gold_added ?? 0;
      } else if (res?.error === 'already_claimed') {
        setIsClaimedToday(true);
        return;
      } else {
        // RPC henüz veritabanında oluşturulmamışsa güvenli istemci fallback'i
        console.warn('claim_daily_reward RPC henüz hazır değil, fallback uygulanıyor:', error || res?.error);
        const { data: freshProfile } = await supabase
          .from('profiles')
          .select('total_gold, total_diamonds, free_friend_adds, free_extensions, last_reward_date, login_streak')
          .eq('id', profile.id)
          .single();

        if (freshProfile?.last_reward_date) {
          const lastDateObj = new Date(freshProfile.last_reward_date);
          const now = Date.now();
          const today = new Date();
          if (lastDateObj.toDateString() === today.toDateString() || (now - lastDateObj.getTime() < 20 * 60 * 60 * 1000)) {
            setIsClaimedToday(true);
            setClaiming(false);
            return;
          }
        }

        const rewardIndex = Math.min(streak, 6);
        const reward = REWARDS[rewardIndex];
        const newStreak = streak + 1;
        const currentGold = freshProfile?.total_gold ?? profile.total_gold ?? 0;
        const newGold = currentGold + reward.gold;
        addedGold = reward.gold;

        const updateRes = await supabase.from('profiles').update({
          total_gold: newGold,
          total_diamonds: (freshProfile?.total_diamonds ?? profile.total_diamonds ?? 0) + reward.diamond,
          free_friend_adds: (freshProfile?.free_friend_adds ?? profile.free_friend_adds ?? 0) + reward.friend,
          free_extensions: (freshProfile?.free_extensions ?? profile.free_extensions ?? 0) + reward.extend,
          login_streak: newStreak,
          last_reward_date: new Date().toISOString()
        }).eq('id', profile.id).select().single();

        data = updateRes.data;
      }

      if (data) {
        const newStreak = data?.login_streak ?? streak + 1;
        logTransaction(profile.id, addedGold, 'daily_reward', { details: `Gün ${newStreak} Giriş Bonusu` });
        setIsClaimedToday(true);
        setTimeout(() => {
          onClaimSuccess(data);
        }, 350);
      }
    } catch (err: any) {
      console.error('Ödül alma hatası:', err);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 5, 15, 0.88)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
      animation: 'fadeIn 0.3s ease'
    }}>
      <div style={{
        background: 'linear-gradient(180deg, #1b132e 0%, #0d0a17 100%)',
        border: '1.5px solid rgba(255, 215, 0, 0.35)',
        borderRadius: '28px',
        padding: '28px 20px',
        textAlign: 'center',
        maxWidth: '380px',
        width: '100%',
        position: 'relative',
        boxShadow: '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 35px rgba(255, 215, 0, 0.25)'
      }}>
        
        {/* Kapat Butonu */}
        <button 
          onClick={onClose} 
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            width: '32px', height: '32px', borderRadius: '50%',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
        >
          <X size={18} />
        </button>

        {/* Sandık İkonu */}
        <div style={{
          background: 'linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)',
          width: '68px', height: '68px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
          boxShadow: '0 0 30px rgba(255, 215, 0, 0.55), 0 6px 16px rgba(0,0,0,0.4)',
          border: '2px solid rgba(255, 255, 255, 0.6)'
        }}>
          <Gift size={34} color="#0d0a17" strokeWidth={2.4} />
        </div>
        
        <h2 style={{
          color: '#fff',
          margin: '0 0 6px',
          fontSize: '1.45rem',
          fontWeight: '900',
          letterSpacing: '-0.3px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
        }}>
          {t('daily_reward_title', 'Günlük Giriş Ödülleri 🎁')}
        </h2>
        
        <p style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: '0.84rem',
          margin: '0 0 20px',
          lineHeight: '1.45'
        }}>
          {isClaimedToday ? t('daily_reward_come_back_tomorrow', 'Yarın yeni ödül için tekrar gel!') : t('daily_reward_desc')}
        </p>

        {/* 7 Günlük Ödül Grid'i */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
          {REWARDS.map((rew, idx) => {
            const isClaimed = isClaimedToday ? idx <= (streak - 1) : idx < streak;
            const isToday = !isClaimedToday && idx === streak;
            const isFuture = isClaimedToday ? idx > (streak - 1) : idx > streak;
            
            let bg = 'rgba(255,255,255,0.04)';
            let border = '1px solid rgba(255,255,255,0.08)';
            
            if (isClaimed) {
              bg = 'rgba(46, 204, 113, 0.15)';
              border = '1px solid rgba(46, 204, 113, 0.5)';
            } else if (isToday) {
              bg = 'rgba(255, 215, 0, 0.18)';
              border = '1.5px solid #FFD700';
            }

            const isBig = idx === 6;

            return (
              <div 
                key={idx} 
                onClick={() => setSelectedDay(idx)}
                style={{ 
                  background: bg, border, borderRadius: '14px', padding: '10px 4px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gridColumn: isBig ? 'span 2' : 'span 1',
                  opacity: isFuture ? 0.45 : 1,
                  transform: (isToday || selectedDay === idx) ? 'scale(1.04)' : 'scale(1)',
                  transition: 'all 0.25s',
                  boxShadow: isToday ? '0 0 18px rgba(255,215,0,0.35)' : 'none',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <span style={{
                  fontSize: '0.72rem',
                  color: isToday ? '#FFD700' : 'rgba(255,255,255,0.85)',
                  marginBottom: '5px',
                  fontWeight: isToday ? '900' : '700'
                }}>
                  {t('daily_reward_day', { day: rew.day })}
                </span>
                
                {isClaimed ? (
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'rgba(46, 204, 113, 0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '3px 0'
                  }}>
                    <Check size={16} color="#2ecc71" strokeWidth={3} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', minHeight: '24px' }}>
                    {rew.gold > 0 && <Coins size={isBig ? 18 : 15} color="#FFD700" />}
                    {rew.diamond > 0 && <Gem size={15} color="#00f2fe" />}
                    {rew.friend > 0 && <UserPlus size={15} color="#ff416c" />}
                    {rew.extend > 0 && <Clock size={15} color="#2ecc71" />}
                  </div>
                )}
                
                <span style={{
                  fontSize: '0.70rem',
                  color: isClaimed ? '#2ecc71' : '#FFD700',
                  marginTop: '4px',
                  fontWeight: '800'
                }}>
                  {isClaimed ? t('daily_reward_claimed', 'Alındı') : `${rew.gold}G ${rew.diamond > 0 ? `+${rew.diamond}D` : ''}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Seçilen Günün Detaylı Açıklaması */}
        {selectedDay !== null && (
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            padding: '10px 14px',
            borderRadius: '14px',
            marginBottom: '18px',
            border: '1px solid rgba(255,215,0,0.2)',
            animation: 'fadeIn 0.2s ease'
          }}>
            <h4 style={{ color: '#FFD700', margin: '0 0 4px 0', fontSize: '0.86rem', fontWeight: '800' }}>
              {t('daily_reward_day', { day: REWARDS[selectedDay].day })} {t('reward_title', 'Ödülü')}:
            </h4>
            <div style={{ color: '#fff', fontSize: '0.82rem', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {REWARDS[selectedDay].gold > 0 && <span>💰 {t('reward_gold', { amount: REWARDS[selectedDay].gold })}</span>}
              {REWARDS[selectedDay].diamond > 0 && <span>💎 {t('reward_diamond', { amount: REWARDS[selectedDay].diamond })}</span>}
              {REWARDS[selectedDay].friend > 0 && <span>👤 {t('reward_friend', { amount: REWARDS[selectedDay].friend })}</span>}
              {REWARDS[selectedDay].extend > 0 && <span>⏳ {t('reward_extend', { amount: REWARDS[selectedDay].extend })}</span>}
            </div>
          </div>
        )}

        {/* Aksiyon Butonu */}
        {isClaimedToday ? (
          <button 
            disabled={true}
            style={{
              width: '100%', padding: '14px', borderRadius: '16px',
              background: 'rgba(46, 204, 113, 0.15)',
              border: '1px solid rgba(46, 204, 113, 0.4)',
              color: '#2ecc71', fontWeight: '800', fontSize: '0.96rem',
              display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center',
              cursor: 'default'
            }}
          >
            <Check size={20} color="#2ecc71" strokeWidth={2.5} />
            <span>{t('daily_reward_already_claimed', 'Bugünün Ödülü Alındı')}</span>
          </button>
        ) : (
          <button 
            onClick={handleClaim}
            disabled={claiming}
            style={{
              width: '100%', padding: '14px', borderRadius: '16px',
              background: 'linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)',
              color: '#0d0a17', border: 'none', fontWeight: '900', fontSize: '1.02rem',
              cursor: claiming ? 'not-allowed' : 'pointer',
              display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center',
              boxShadow: '0 8px 24px rgba(255, 215, 0, 0.45)',
              opacity: claiming ? 0.75 : 1,
              transition: 'all 0.2s'
            }}
          >
            <Sparkles size={20} color="#0d0a17" />
            <span>{claiming ? '...' : t('daily_reward_claim', 'Ödülü Al')}</span>
          </button>
        )}

      </div>
    </div>
  );
}
