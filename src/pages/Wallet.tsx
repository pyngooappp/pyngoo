import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Gem, CreditCard, CheckCircle2, TrendingUp, History, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { sendTelegramAlert } from '../utils/telegramAlert';
import { logTransaction } from '../utils/transactionService';

const Wallet = () => {
  const { t, i18n } = useTranslation();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [iban, setIban] = useState('');
  const [fullName, setFullName] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [withdrawalHistory, setWithdrawalHistory] = useState<any[]>([]);
  
  const isTr = i18n.language?.startsWith('tr') || false;
  const exchangeRate = isTr ? 0.1 : 0.003;

  const gifts = [
    { emoji: '🌹', name: t('gift_rose'), cost: 10, reward: 3, color: '#ff2d55' },
    { emoji: '☕', name: t('gift_coffee'), cost: 20, reward: 6, color: '#bcaaa4' },
    { emoji: '🍦', name: t('gift_icecream'), cost: 35, reward: 10, color: '#ff80ab' },
    { emoji: '🍫', name: t('gift_chocolate'), cost: 50, reward: 15, color: '#d7ccc8' },
    { emoji: '🧸', name: t('gift_bear'), cost: 100, reward: 30, color: '#ffb74d' },
    { emoji: '💐', name: t('gift_bouquet'), cost: 200, reward: 60, color: '#ba68c8' },
    { emoji: '💍', name: t('gift_diamond_ring'), cost: 350, reward: 105, color: '#4fc3f7' },
    { emoji: '👑', name: t('gift_crown'), cost: 500, reward: 150, color: '#ffd54f' },
    { emoji: '🏎️', name: t('gift_sportscar'), cost: 1000, reward: 300, color: '#ff1744' },
    { emoji: '🛥️', name: t('gift_yacht'), cost: 2000, reward: 600, color: '#00e5ff' },
    { emoji: '🚀', name: t('gift_rocket'), cost: 3000, reward: 900, color: '#7c4dff' },
    { emoji: '🏰', name: t('gift_castle'), cost: 5000, reward: 1500, color: '#ffab00' },
  ];

  const fetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (data) setProfile(data);
    }
    setLoading(false);
  };

  const fetchWithdrawalHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (data) setWithdrawalHistory(data);
    } catch (_) {}
  };

  useEffect(() => {
    fetchProfile();
    fetchWithdrawalHistory();
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase.channel(`wallet_user_${profile.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'withdrawal_requests',
        filter: `user_id=eq.${profile.id}`
      }, () => {
        fetchWithdrawalHistory();
        fetchProfile();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!profile) return;
    
    const withdrawAmount = Number(amount);
    
    if (withdrawAmount < 500) {
      setErrorMessage(t('wallet_min_amount_err'));
      return;
    }
    
    if (submitting) return;

    if (withdrawAmount > (profile.total_diamonds || 0)) {
      setErrorMessage(t('wallet_insufficient_err'));
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSubmitting(false);
        return;
      }

      // 1. Bekleyen aktif talep kontrolü (Çift harcama ve spam talepleri engeller)
      const { data: pendingRequests } = await supabase
        .from('withdrawal_requests')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('status', 'pending')
        .limit(1);

      if (pendingRequests && pendingRequests.length > 0) {
        setErrorMessage(isTr
          ? 'Zaten onay bekleyen aktif bir para çekim talebiniz bulunmaktadır. Lütfen önceki talebinizin tamamlanmasını bekleyiniz.'
          : 'You already have an active pending withdrawal request. Please wait for it to be processed.');
        setSubmitting(false);
        return;
      }

      // 2. Anlık veritabanı bakiyesini doğrula (İstemci state manipülasyonunu engeller)
      const { data: freshProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('total_diamonds')
        .eq('id', session.user.id)
        .single();

      if (profileErr || !freshProfile) {
        throw new Error(isTr ? 'Kullanıcı profili doğrulanamadı.' : 'User profile could not be verified.');
      }

      const freshDiamonds = freshProfile.total_diamonds || 0;
      if (freshDiamonds < withdrawAmount) {
        setErrorMessage(t('wallet_insufficient_err'));
        setProfile({ ...profile, total_diamonds: freshDiamonds });
        setSubmitting(false);
        return;
      }

      const moneyAmount = withdrawAmount * exchangeRate;
      const newDiamondBalance = freshDiamonds - withdrawAmount;

      // 3. Önce elmas bakiyesini düşür (Race-condition / Çift harcama koruması)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ total_diamonds: newDiamondBalance })
        .eq('id', session.user.id)
        .gte('total_diamonds', withdrawAmount);

      if (updateError) {
        throw new Error(isTr ? 'Bakiye düşürme işlemi başarısız oldu.' : 'Failed to deduct balance.');
      }

      // 4. Talebi veritabanına ekle (Başlangıç Durumu: pending / İşleme Alındı)
      const { error: insertError } = await supabase.from('withdrawal_requests').insert([{
        user_id: session.user.id,
        amount_diamonds: withdrawAmount,
        amount_currency: moneyAmount,
        iban: iban.trim(),
        full_name: fullName.trim(),
        status: 'pending'
      }]);

      if (insertError) {
        // Hata durumunda düşülen bakiyeyi kullanıcıya iade et (Rollback)
        await supabase
          .from('profiles')
          .update({ total_diamonds: freshDiamonds })
          .eq('id', session.user.id);
        throw insertError;
      }

      setProfile({ ...profile, total_diamonds: newDiamondBalance });
      logTransaction(session.user.id, -withdrawAmount, 'withdraw_request', {
        iban: iban.trim(),
        fullName: fullName.trim(),
        currencyAmount: moneyAmount
      });

      // Telegram moderasyon botuna anlık bildirim düşür
      try {
        const dateStr = new Date().toLocaleDateString('tr-TR');
        const timeStr = new Date().toLocaleTimeString('tr-TR');
        const tgMsg = `
💸 <b>YENİ PARA ÇEKİM TALEBİ!</b> 💎

👤 <b>Yayıncı:</b> ${fullName.trim()} (@${profile.display_name || 'Kullanıcı'})
💎 <b>Çekilen Elmas:</b> ${withdrawAmount.toLocaleString()} 💎
💵 <b>Ödenecek Tutar:</b> ${isTr ? '' : '$'}${moneyAmount.toFixed(2)}${isTr ? ' ₺' : ''}
🏦 <b>IBAN:</b> <code>${iban.trim()}</code>
✍️ <b>Hesap Sahibi:</b> ${fullName.trim()}
📅 <b>Tarih:</b> ${dateStr} • ${timeStr}
⏳ <b>Durum:</b> 🟡 İşleme Alındı (Moderatör Onayı Bekliyor)

<i>Moderatör panelinden 'Para Çekim Talepleri' sekmesinden kontrol edip onaylayabilirsiniz.</i>
        `.trim();
        sendTelegramAlert(tgMsg).catch(() => {});
      } catch (_) {}

      setSuccessMessage(t('wallet_request_success_with_tracking', { amount: `${isTr ? '' : '$'}${moneyAmount.toFixed(2)}${isTr ? ' ₺' : ''}` }));
      setAmount('');
      fetchWithdrawalHistory();
    } catch (error: any) {
      setErrorMessage(error.message || 'Error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>{t('wallet_loading')}</div>;
  }

  // Erkek kullanıcılar bu sayfaya girememeli (İsteğe bağlı güvenlik)
  if (profile?.gender === 'erkek') {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'white', paddingTop: '100px' }}>
        <h2>{t('wallet_creators_only')}</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', paddingBottom: '140px', color: 'white', maxWidth: '500px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', fontWeight: '800', background: 'linear-gradient(to right, #e0c3fc 0%, #8ec5fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        {t('wallet_title')}
      </h1>

      {/* Bakiye Kartı */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1f1c2c 0%, #928DAB 100%)', 
        borderRadius: '20px', 
        padding: '30px', 
        textAlign: 'center',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        marginBottom: '30px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.1 }}>
          <Gem size={150} />
        </div>
        <p style={{ margin: 0, fontSize: '1rem', color: 'rgba(255,255,255,0.8)' }}>{t('wallet_balance')}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '10px' }}>
          <Gem size={36} color="#00f2fe" />
          <h2 style={{ margin: 0, fontSize: '3.5rem', fontWeight: 'bold' }}>
            {profile?.total_diamonds || 0}
          </h2>
        </div>
        <div style={{ marginTop: '20px', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '12px', display: 'inline-block' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4caf50' }}>
            ≈ {isTr ? '' : '$'}{((profile?.total_diamonds || 0) * exchangeRate).toFixed(2)} {isTr ? '₺' : 'USD'}
          </span>
        </div>
      </div>

      {/* Para Çekme Formu */}
      <div style={{ background: '#1a1a2e', padding: '24px 20px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', marginBottom: '25px' }}>
        <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem' }}>
          <CreditCard size={20} color="#ff416c" />
          {t('wallet_withdraw_btn')}
        </h3>
        
        {/* Çekim Koşulu / Limit Durumu */}
        {(profile?.total_diamonds || 0) >= 500 ? (
          <div style={{
            background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.12) 0%, rgba(0, 242, 254, 0.08) 100%)',
            border: '1px solid rgba(46, 204, 113, 0.35)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>✅</span>
            <div style={{ fontSize: '0.82rem', lineHeight: '1.4', color: '#d4f8e8' }}>
              <strong style={{ color: '#2ecc71', display: 'block', marginBottom: '2px' }}>
                {isTr ? 'Para Çekme Koşulunu Karşılıyorsunuz' : 'Withdrawal Requirement Met'}
              </strong>
              {t('wallet_threshold_reached')}
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255, 193, 7, 0.08)',
            border: '1px solid rgba(255, 193, 7, 0.3)',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.8rem',
            color: '#ffeaa7'
          }}>
            <span style={{ fontSize: '1.1rem' }}>⏳</span>
            <span>{t('wallet_threshold_not_reached', { current: profile?.total_diamonds || 0 })}</span>
          </div>
        )}

        {successMessage && (
          <div style={{ background: 'rgba(46, 204, 113, 0.12)', padding: '14px', borderRadius: '12px', border: '1px solid #2ecc71', marginBottom: '18px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <CheckCircle2 color="#2ecc71" size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ color: '#2ecc71', margin: 0, fontWeight: '600', fontSize: '0.86rem', lineHeight: '1.4' }}>{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div style={{ background: 'rgba(255, 107, 107, 0.1)', padding: '14px', borderRadius: '12px', border: '1px solid #ff6b6b', marginBottom: '18px' }}>
            <p style={{ color: '#ff6b6b', margin: 0, fontSize: '0.86rem' }}>{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleWithdrawal} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>{t('wallet_name')}</label>
            <input 
              type="text" 
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full Name"
              style={{ width: '100%', padding: '12px 15px', borderRadius: '10px', border: 'none', background: '#0f0f1a', color: 'white', boxSizing: 'border-box', fontSize: '0.9rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>{t('wallet_iban')}</label>
            <input 
              type="text" 
              required
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="TR00 0000..."
              style={{ width: '100%', padding: '12px 15px', borderRadius: '10px', border: 'none', background: '#0f0f1a', color: 'white', boxSizing: 'border-box', fontSize: '0.9rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>{t('wallet_amount')}</label>
            <input 
              type="number" 
              required
              min="500"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Min. 500"
              style={{ width: '100%', padding: '12px 15px', borderRadius: '10px', border: 'none', background: '#0f0f1a', color: 'white', boxSizing: 'border-box', fontSize: '0.9rem' }}
            />
          </div>
          
          <button 
            type="submit"
            disabled={submitting}
            style={{
              background: submitting ? 'rgba(255,255,255,0.2)' : 'linear-gradient(to right, #ff416c, #ff4b2b)',
              color: 'white', border: 'none', padding: '14px', borderRadius: '10px',
              fontWeight: 'bold', fontSize: '1.05rem', cursor: submitting ? 'not-allowed' : 'pointer', marginTop: '6px',
              boxShadow: '0 4px 15px rgba(255, 65, 108, 0.4)'
            }}
          >
            {submitting ? '...' : t('wallet_submit')}
          </button>

          {/* Çekim Takip Bilgilendirme Notu */}
          <div style={{
            marginTop: '4px',
            background: 'rgba(0, 242, 254, 0.06)',
            border: '1px dashed rgba(0, 242, 254, 0.25)',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.78rem',
            color: '#a0e7ff',
            lineHeight: '1.35'
          }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>ℹ️</span>
            <span>{t('wallet_withdraw_track_hint')}</span>
          </div>
        </form>
      </div>

      {/* Kazanç Tablosu (12 Hediye Birebir Tam Liste - Kompakt Tasarım) */}
      <div style={{ background: '#1a1a2e', padding: '16px 14px', borderRadius: '18px', marginBottom: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '1rem' }}>🎁</span>
            <h4 style={{ margin: 0, color: 'white', fontSize: '0.92rem', fontWeight: 'bold' }}>
              {t('wallet_gift_earnings')}
            </h4>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '8px' }}>
            12 {isTr ? 'Hediye' : 'Gifts'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {gifts.map((g, i) => (
            <div 
              key={i} 
              style={{ 
                background: 'rgba(255,255,255,0.035)', 
                padding: '8px 3px', 
                borderRadius: '10px', 
                textAlign: 'center',
                border: `1px solid ${g.color ? g.color + '25' : 'rgba(255,255,255,0.08)'}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 0
              }}
            >
              <div style={{ fontSize: '1.25rem', marginBottom: '2px', lineHeight: 1 }}>{g.emoji}</div>
              <div style={{ color: 'white', fontWeight: '600', fontSize: '0.70rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', padding: '0 2px' }}>
                {g.name}
              </div>
              <div style={{ color: '#00f2fe', fontSize: '0.74rem', fontWeight: 'bold', marginTop: '2px' }}>
                +{g.reward} 💎
              </div>
              <div style={{ color: 'rgba(255, 215, 0, 0.75)', fontSize: '0.62rem', marginTop: '1px' }}>
                {g.cost} {t('gold_currency_label')}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '10px', background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.2)', padding: '8px 10px', borderRadius: '10px', textAlign: 'center', color: '#4caf50', fontSize: '0.75rem', lineHeight: '1.35' }}>
          <strong>💡 {t('wallet_info_rate')}</strong>
        </div>
      </div>

      {/* 📊 Çekim Taleplerim ve Canlı Süreç Takibi */}
      <div style={{ marginTop: '30px', background: '#1a1a2e', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#fff' }}>
            <Clock size={20} color="#00f2fe" />
            {t('wallet_history_title')}
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', padding: '3px 10px', borderRadius: '10px' }}>
            {withdrawalHistory.length} {isTr ? 'Talep' : 'Requests'}
          </span>
        </div>

        {withdrawalHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '25px 10px', color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
            <Gem size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
            <p style={{ margin: 0 }}>{t('wallet_no_history')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {withdrawalHistory.map((item) => {
              const status = item.status || 'pending';
              const isPending = status === 'pending';
              const isApproved = status === 'approved';
              const isCompleted = status === 'completed';
              const isRejected = status === 'rejected';

              const statusBadgeConfig = isPending
                ? { bg: 'rgba(241, 196, 15, 0.15)', border: '#f1c40f', color: '#f1c40f', text: t('wallet_status_pending'), desc: t('wallet_status_pending_desc'), icon: '⏳' }
                : isApproved
                ? { bg: 'rgba(52, 152, 219, 0.15)', border: '#3498db', color: '#3498db', text: t('wallet_status_approved'), desc: t('wallet_status_approved_desc'), icon: '🔄' }
                : isCompleted
                ? { bg: 'rgba(46, 204, 113, 0.15)', border: '#2ecc71', color: '#2ecc71', text: t('wallet_status_completed'), desc: t('wallet_status_completed_desc'), icon: '✅' }
                : { bg: 'rgba(231, 76, 60, 0.15)', border: '#e74c3c', color: '#e74c3c', text: t('wallet_status_rejected'), desc: t('wallet_status_rejected_desc'), icon: '❌' };

              const createdDate = new Date(item.created_at).toLocaleDateString(isTr ? 'tr-TR' : 'en-US');
              const createdTime = new Date(item.created_at).toLocaleTimeString(isTr ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={item.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isCompleted ? 'rgba(46,204,113,0.35)' : isApproved ? 'rgba(52,152,219,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '16px',
                    padding: '16px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
                      📅 {createdDate} • {createdTime}
                    </div>
                    <div style={{
                      background: statusBadgeConfig.bg,
                      border: `1px solid ${statusBadgeConfig.border}`,
                      color: statusBadgeConfig.color,
                      fontSize: '0.76rem',
                      fontWeight: '800',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <span>{statusBadgeConfig.icon}</span>
                      <span>{statusBadgeConfig.text}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#fff' }}>
                        {isTr ? '' : '$'}{Number(item.amount_currency).toFixed(2)}{isTr ? ' ₺' : ''}
                      </span>
                      <span style={{ fontSize: '0.84rem', color: '#00f2fe', marginLeft: '8px', fontWeight: '700' }}>
                        ({item.amount_diamonds} 💎)
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
                    🏦 <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>{item.full_name}</span> • <code>{item.iban}</code>
                  </div>

                  {/* 3 Aşamalı Canlı Süreç Takip Çubuğu */}
                  {!isRejected ? (
                    <div style={{ marginTop: '10px', background: 'rgba(0,0,0,0.25)', padding: '12px 14px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: '8px' }}>
                        <div style={{ position: 'absolute', top: '10px', left: '20px', right: '20px', height: '2px', background: 'rgba(255,255,255,0.1)', zIndex: 0 }} />
                        <div style={{
                          position: 'absolute', top: '10px', left: '20px',
                          width: isCompleted ? 'calc(100% - 40px)' : isApproved ? 'calc(50% - 20px)' : '0%',
                          height: '2px',
                          background: isCompleted ? '#2ecc71' : '#3498db',
                          transition: 'width 0.4s ease',
                          zIndex: 1
                        }} />

                        {/* 1. Aşama */}
                        <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f1c40f', color: '#000', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>✓</div>
                          <span style={{ fontSize: '0.70rem', color: '#f1c40f', fontWeight: '700', marginTop: '4px' }}>1. İşleme Alındı</span>
                        </div>

                        {/* 2. Aşama */}
                        <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: isApproved || isCompleted ? '#3498db' : 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {isApproved || isCompleted ? '✓' : '2'}
                          </div>
                          <span style={{ fontSize: '0.70rem', color: isApproved || isCompleted ? '#3498db' : 'rgba(255,255,255,0.4)', fontWeight: '700', marginTop: '4px' }}>2. Onaylandı</span>
                        </div>

                        {/* 3. Aşama */}
                        <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: isCompleted ? '#2ecc71' : 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {isCompleted ? '✓' : '3'}
                          </div>
                          <span style={{ fontSize: '0.70rem', color: isCompleted ? '#2ecc71' : 'rgba(255,255,255,0.4)', fontWeight: '700', marginTop: '4px' }}>3. Yatırıldı</span>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.76rem', color: statusBadgeConfig.color, textAlign: 'center', marginTop: '6px', fontWeight: '600' }}>
                        {statusBadgeConfig.desc}
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(231, 76, 60, 0.12)', border: '1px solid rgba(231, 76, 60, 0.3)', padding: '10px 14px', borderRadius: '12px', color: '#e74c3c', fontSize: '0.78rem' }}>
                      {statusBadgeConfig.desc}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bilgilendirme */}
      <div style={{ marginTop: '30px', display: 'flex', gap: '15px', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '15px' }}>
          <TrendingUp size={24} color="#00f2fe" />
          <div>
            <h4 style={{ margin: '0 0 5px 0', color: 'white' }}>{t('wallet_how_title')}</h4>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: '1.4' }}>
              {t('wallet_how_desc')}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '15px' }}>
          <History size={24} color="#ffb75e" />
          <div>
            <h4 style={{ margin: '0 0 5px 0', color: 'white' }}>{t('wallet_process_title')}</h4>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: '1.4' }}>
              {t('wallet_process_desc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wallet;
