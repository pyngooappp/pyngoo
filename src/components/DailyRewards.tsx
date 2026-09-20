import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import { Gift, Check, Coins, Gem, UserPlus, Clock, X } from 'lucide-react';
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

  useEffect(() => {
    let currentStreak = profile.login_streak || 0;
    const lastReward = profile.last_reward_date ? new Date(profile.last_reward_date) : null;
    const today = new Date();
    
    if (lastReward) {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      
      if (lastReward.toDateString() === yesterday.toDateString()) {
        currentStreak = (currentStreak % 7); // 7. günden sonra tekrar 0'a döner
      } else if (lastReward.toDateString() === today.toDateString()) {
        // Bugün zaten alınmış, normalde bu ekran açılmamalı ama açılırsa streak aynı kalır
      } else {
        currentStreak = 0; // Seri bozuldu
      }
    }
    setStreak(currentStreak);
  }, [profile]);

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);

    try {
      // 1. Veritabanından en güncel son ödül tarihini doğrula (Çift talep ve hile engelleme)
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('total_gold, total_diamonds, free_friend_adds, free_extensions, last_reward_date, login_streak')
        .eq('id', profile.id)
        .single();

      if (freshProfile?.last_reward_date) {
        const lastDateObj = new Date(freshProfile.last_reward_date);
        const lastTimestamp = lastDateObj.getTime();
        const now = Date.now();
        const today = new Date();

        // Hem takvim günü hem de en az 20 saat (72.000.000 ms) geçme şartı (Saat/tarih değiştirme hilesini engeller)
        if (lastDateObj.toDateString() === today.toDateString() || (now - lastTimestamp < 20 * 60 * 60 * 1000)) {
          alert("Günün ödülünü zaten aldınız! Lütfen yarın tekrar gelin.");
          setClaiming(false);
          onClose();
          return;
        }
      }

      const rewardIndex = streak; // 0 to 6
      const reward = REWARDS[rewardIndex];
      
      const newStreak = streak + 1;
      const currentGold = freshProfile?.total_gold ?? profile.total_gold ?? 0;
      const currentDiamonds = freshProfile?.total_diamonds ?? profile.total_diamonds ?? 0;
      const currentFriends = freshProfile?.free_friend_adds ?? profile.free_friend_adds ?? 0;
      const currentExtensions = freshProfile?.free_extensions ?? profile.free_extensions ?? 0;

      const newGold = currentGold + reward.gold;
      const newDiamond = currentDiamonds + reward.diamond;
      const newFriend = currentFriends + reward.friend;
      const newExtend = currentExtensions + reward.extend;

      const { data, error } = await supabase.from('profiles').update({
        total_gold: newGold,
        total_diamonds: newDiamond,
        free_friend_adds: newFriend,
        free_extensions: newExtend,
        login_streak: newStreak,
        last_reward_date: new Date().toISOString()
      }).eq('id', profile.id).select().single();
      
      if (error) {
        alert("Hata oluştu: " + error.message);
      } else {
        logTransaction(profile.id, reward.gold, 'daily_reward', { details: `Gün ${newStreak} Giriş Bonusu` });
        onClaimSuccess(data);
      }
    } catch (err: any) {
      alert("Hata oluştu: " + err.message);
      console.error(err);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease' }}>
      <div className="glassmorphism" style={{ background: '#1a1a2e', padding: '30px 20px', borderRadius: '24px', textAlign: 'center', maxWidth: '350px', width: '90%', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
          <X size={24} />
        </button>

        <div style={{ background: 'linear-gradient(135deg, #FFD700, #F7971E)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px', boxShadow: '0 0 20px rgba(255, 215, 0, 0.4)' }}>
          <Gift size={32} color="white" />
        </div>
        
        <h2 style={{ color: 'white', marginBottom: '10px', fontSize: '1.5rem', fontWeight: 'bold' }}>
          {t('daily_reward_title')}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '25px', lineHeight: '1.4' }}>
          {t('daily_reward_desc')}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '25px' }}>
          {REWARDS.map((rew, idx) => {
            const isClaimed = idx < streak;
            const isToday = idx === streak;
            const isFuture = idx > streak;
            
            let bg = 'rgba(255,255,255,0.05)';
            let border = '1px solid rgba(255,255,255,0.1)';
            
            if (isClaimed) {
              bg = 'rgba(46, 204, 113, 0.2)';
              border = '1px solid #2ecc71';
            } else if (isToday) {
              bg = 'rgba(255, 215, 0, 0.2)';
              border = '1px solid #FFD700';
            }

            // 7th day is special (spans 2 columns if we want, or just larger)
            const isBig = idx === 6;

            return (
              <div 
                key={idx} 
                onClick={() => setSelectedDay(idx)}
                style={{ 
                  background: bg, border, borderRadius: '12px', padding: '10px 5px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gridColumn: isBig ? 'span 2' : 'span 1',
                  opacity: isFuture ? 0.5 : 1,
                  transform: (isToday || selectedDay === idx) ? 'scale(1.05)' : 'scale(1)',
                  transition: '0.3s',
                  boxShadow: (isToday || selectedDay === idx) ? '0 0 15px rgba(255,215,0,0.3)' : 'none',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginBottom: '5px', fontWeight: 'bold' }}>
                  {t('daily_reward_day', { day: rew.day })}
                </span>
                
                {isClaimed ? (
                  <Check size={20} color="#2ecc71" />
                ) : (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {rew.gold > 0 && <Coins size={isBig ? 20 : 16} color="#FFD700" />}
                    {rew.diamond > 0 && <Gem size={16} color="#00f2fe" />}
                    {rew.friend > 0 && <UserPlus size={16} color="#ff416c" />}
                    {rew.extend > 0 && <Clock size={16} color="#2ecc71" />}
                  </div>
                )}
                
                {!isClaimed && (
                  <span style={{ fontSize: '0.7rem', color: '#FFD700', marginTop: '5px', fontWeight: 'bold' }}>
                    {rew.gold}G {rew.diamond > 0 && `+${rew.diamond}D`}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Seçilen Günün Detaylı Ödül Açıklaması */}
        {selectedDay !== null && (
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '10px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.1)', animation: 'fadeIn 0.2s ease' }}>
            <h4 style={{ color: '#FFD700', margin: '0 0 5px 0', fontSize: '0.9rem' }}>
              {t('daily_reward_day', { day: REWARDS[selectedDay].day })} {t('reward_title')}:
            </h4>
            <p style={{ color: 'white', margin: 0, fontSize: '0.85rem', lineHeight: '1.5' }}>
              {REWARDS[selectedDay].gold > 0 && <span>💰 {t('reward_gold', { amount: REWARDS[selectedDay].gold })} <br/></span>}
              {REWARDS[selectedDay].diamond > 0 && <span>💎 {t('reward_diamond', { amount: REWARDS[selectedDay].diamond })} <br/></span>}
              {REWARDS[selectedDay].friend > 0 && <span>👤 {t('reward_friend', { amount: REWARDS[selectedDay].friend })} <br/></span>}
              {REWARDS[selectedDay].extend > 0 && <span>⏳ {t('reward_extend', { amount: REWARDS[selectedDay].extend })}</span>}
            </p>
          </div>
        )}

        <button 
          onClick={handleClaim}
          disabled={claiming}
          className="pulse-animation"
          style={{ width: '100%', padding: '15px', borderRadius: '15px', background: 'linear-gradient(135deg, #FFD700, #F7971E)', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}
        >
          {claiming ? '...' : t('daily_reward_claim')}
        </button>

      </div>
    </div>
  );
}
