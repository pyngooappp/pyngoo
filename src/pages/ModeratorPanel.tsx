import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  ShieldAlert, UserX, CheckCircle, RefreshCw,
  Trash2, Lock, Eye, Camera, ThumbsDown,
  ShieldCheck, UserCheck, Users, ArrowLeft,
  FileText, Search, Copy, Check, Clock, Printer,
  Zap, Server, CheckCircle2, CreditCard,
  XCircle, X
} from 'lucide-react';
import { sendTelegramAlert } from '../utils/telegramAlert';
import { logTransaction } from '../utils/transactionService';
import LiveRealAnalyticsBanner from '../components/LiveRealAnalyticsBanner';

export interface PaymentOrderItem {
  id: string;
  user_id: string;
  user_name?: string;
  payment_method: string;
  gold_amount: number;
  bonus_amount: number;
  total_gold: number;
  price_text: string;
  order_code: string;
  sender_name?: string;
  crypto_txid?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  created_at: string;
}

interface WithdrawalItem {
  id: string;
  user_id: string;
  amount_diamonds: number;
  amount_currency: number;
  iban: string;
  full_name: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  created_at: string;
  profile_name?: string;
}

interface ReportItem {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  category?: string;
  reason?: string;
  status: 'pending' | 'resolved' | 'banned' | 'dismissed';
  created_at: string;
  reporter_name?: string;
  reported_name?: string;
  snapshot_data?: string | null;
}

export default function ModeratorPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [activeModUser, setActiveModUser] = useState<{ username: string; role: 'admin' | 'moderator'; id?: string } | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number>(0);
  const [modPasswordInput, setModPasswordInput] = useState('');
  const [showModLogModal, setShowModLogModal] = useState(false);
  const [auditLogsList, setAuditLogsList] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('pyngoo_mod_audit_logs');
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  });

  // ÖZEL PYNGOO TEMALI DİYALOG (alert / confirm / prompt yerine)
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'prompt';
    title?: string;
    message: string;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    resolve?: (val: any) => void;
  }>({
    isOpen: false,
    type: 'alert',
    message: ''
  });
  const [dialogInput, setDialogInput] = useState('');

  const showCustomDialog = (opts: {
    type: 'alert' | 'confirm' | 'prompt';
    title?: string;
    message: string;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }): Promise<any> => {
    return new Promise((resolve) => {
      setDialogInput(opts.defaultValue || '');
      setDialogState({
        ...opts,
        isOpen: true,
        resolve
      });
    });
  };

  const showAlert = (message: string, title: string = 'Bilgilendirme') =>
    showCustomDialog({ type: 'alert', title, message });

  const showConfirm = (message: string, title: string = 'Onay Gerekiyor', isDanger: boolean = false, confirmText: string = 'Onayla') =>
    showCustomDialog({ type: 'confirm', title, message, isDanger, confirmText });

  const showPrompt = (message: string, defaultValue: string = '', title: string = 'Gerekçe Girişi') =>
    showCustomDialog({ type: 'prompt', title, message, defaultValue });

  const handleDialogSubmit = () => {
    if (dialogState.type === 'prompt') {
      dialogState.resolve?.(dialogInput);
    } else {
      dialogState.resolve?.(true);
    }
    setDialogState(prev => ({ ...prev, isOpen: false }));
  };

  const handleDialogDismiss = () => {
    if (dialogState.type === 'prompt') {
      dialogState.resolve?.(null);
    } else {
      dialogState.resolve?.(false);
    }
    setDialogState(prev => ({ ...prev, isOpen: false }));
  };

  const handleReturnToApp = () => {
    window.location.replace(window.location.origin + '/');
  };

  const handleLogoutPanel = () => {
    supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    try {
      sessionStorage.removeItem('pyngoo_mod_session');
      localStorage.removeItem('pyngoo_mod_session');
      sessionStorage.removeItem('pyngoo_mod_auth');
    } catch (_) {}
    setIsAuthenticated(false);
    setIsSuperAdmin(false);
    setActiveModUser(null);
    setUsernameInput('');
    setPasswordInput('');
    setPinInput('');
  };

  const logModeratorAction = (action: string, target: string, details: string) => {
    const modName = activeModUser?.username || 'Sistem Admin';
    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      moderator: modName,
      action,
      target,
      details
    };
    const updated = [newLog, ...auditLogsList].slice(0, 300);
    setAuditLogsList(updated);
    try {
      localStorage.setItem('pyngoo_mod_audit_logs', JSON.stringify(updated));
    } catch (_) {}
  };

  // Güvenlik Özelliği 2: 30 Dakikalık Otomatik İnaktivite Aşımı (Auto-Session Timeout)
  useEffect(() => {
    if (!isAuthenticated) return;

    let inactivityTimer: any = null;
    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(async () => {
        await showAlert("⏱️ Güvenliğiniz için 30 dakika işlem yapılmadığından oturumunuz kilitlendi. Lütfen tekrar giriş yapın.", "Oturum Zaman Aşımı");
        handleLogoutPanel();
      }, 30 * 60 * 1000);
    };

    resetTimer();

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [isAuthenticated]);

  // KİMLİK DOĞRULAMA: Panel artık gerçek Supabase oturumuyla çalışır. Yetki (admin / moderatör)
  // sunucudaki profiles.role / is_moderator değerinden okunur ve sunucu fonksiyonları (is_admin /
  // is_staff) aynı kontrolü tekrar yapar. İstemcide tutulan şifre veya token ile yetki verilmez.
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const applyStaffSession = async (): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const { data: prof, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, is_moderator, is_banned')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      setAuthMessage('⚠️ Sunucuya ulaşılamadı, lütfen tekrar deneyin.');
      return false;
    }

    const isAdminRole = !!prof && prof.role === 'admin' && prof.is_banned !== true;
    const isModRole = !!prof && prof.is_banned !== true && (prof.is_moderator === true || prof.role === 'moderator');

    if (!prof || (!isAdminRole && !isModRole)) {
      try { await supabase.auth.signOut({ scope: 'local' }); } catch (_) {}
      setAuthMessage('⛔ Bu hesabın panel yetkisi yok.');
      return false;
    }

    setAuthMessage(null);
    setIsAuthenticated(true);
    setIsSuperAdmin(isAdminRole);
    setActiveModUser({
      username: prof.display_name || session.user.email || 'Yetkili',
      role: isAdminRole ? 'admin' : 'moderator',
      id: prof.id
    });
    return true;
  };

  useEffect(() => {
    (async () => {
      try {
        // Google (PKCE) dönüşü: ?code=... ile gelir
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          try {
            await supabase.auth.exchangeCodeForSession(code);
          } catch (err) {
            console.warn('Panel OAuth kod takası hatası:', err);
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (params.get('error')) {
          setAuthMessage('⚠️ Google girişi tamamlanamadı, lütfen tekrar deneyin.');
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        await applyStaffSession();
      } catch (_) {}
    })();
  }, []);

  // Sadece süper admin (Ömer) tüm yetkilere sahiptir. Tanımlı moderatörler sadece şikayet yönetebilir.
  const isOmer = isSuperAdmin;
  const isAdmin = isSuperAdmin;

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'banned' | 'resolved' | 'dismissed'>('pending');
  const [previewImage, setPreviewImage] = useState<string | null>(null);


  // Moderatör Tanımlama & Yönetimi Modal
  const [showModModal, setShowModModal] = useState(false);
  const [modUsernameInput, setModUsernameInput] = useState('');
  const [modSuccessMsg, setModSuccessMsg] = useState<string | null>(null);
  const [modErrorMsg, setModErrorMsg] = useState<string | null>(null);
  const [moderatorsList, setModeratorsList] = useState<any[]>([]);
  const [loadingMods, setLoadingMods] = useState(false);

  // İşlem bildirimleri
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // ==========================================
  // PARA ÇEKİM TALEPLERİ YÖNETİMİ
  // ==========================================
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'pending' | 'approved' | 'completed' | 'rejected'>('pending');
  const [pendingWithdrawalCount, setPendingWithdrawalCount] = useState(0);
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [copiedIbanId, setCopiedIbanId] = useState<string | null>(null);

  // ==========================================
  // TÜM KAYITLI KULLANICILAR YÖNETİMİ
  // ==========================================
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [allUsersList, setAllUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'female' | 'male' | 'banned'>('all');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);



  const fetchWithdrawals = async () => {
    setLoadingWithdrawals(true);
    try {
      const { data } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        const userIds = Array.from(new Set(data.map(d => d.user_id)));
        let profileMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds);
          if (profs) {
            profs.forEach(p => {
              profileMap[p.id] = p.display_name;
            });
          }
        }

        const enriched: WithdrawalItem[] = data.map(item => ({
          ...item,
          profile_name: profileMap[item.user_id] || item.full_name
        }));

        setWithdrawals(enriched);
        setPendingWithdrawalCount(enriched.filter(w => w.status === 'pending').length);
      }
    } catch (err) {
      console.error('Çekim talepleri çekilemedi:', err);
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  const handleApproveWithdrawal = async (item: WithdrawalItem) => {
    if (item.status !== 'pending') {
      await showAlert('⚠️ Bu talep zaten onaylanmış veya işlenmiş!', 'Uyarı');
      return;
    }
    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({ status: 'approved' })
        .eq('id', item.id)
        .eq('status', 'pending');

      if (error) throw error;

      setWithdrawals(prev => prev.map(w => w.id === item.id ? { ...w, status: 'approved' } : w));
      setPendingWithdrawalCount(prev => Math.max(0, prev - 1));
      setActionMessage(`✅ ${item.full_name} talebi onaylandı. Yatırım aşamasına alındı.`);

      try {
        const dateStr = new Date().toLocaleDateString('tr-TR');
        const timeStr = new Date().toLocaleTimeString('tr-TR');
        const msg = `
🔵 <b>ÇEKİM TALEBİ ONAYLANDI!</b> 💎

👤 <b>Yayıncı:</b> ${item.full_name} (@${item.profile_name || 'Kullanıcı'})
💵 <b>Tutar:</b> ${Number(item.amount_currency).toFixed(2)} ₺ (${item.amount_diamonds.toLocaleString()} 💎)
🏦 <b>IBAN:</b> <code>${item.iban}</code>
✍️ <b>Hesap Sahibi:</b> ${item.full_name}
📅 <b>Tarih:</b> ${dateStr} • ${timeStr}
⏳ <b>Yeni Durum:</b> 🔵 Onaylandı - Yatırım Aşamasında (Havale/EFT Hazırlanıyor)

<i>Ödemeyi hesaba gönderdikten sonra panelden 'Yatırıldı' olarak işaretleyebilirsiniz.</i>
        `.trim();
        sendTelegramAlert(msg).catch(() => {});
      } catch (_) {}

      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      await showAlert('Hata: ' + (err.message || 'Onaylanamadı'), 'Hata');
    }
  };

  const handleCompleteWithdrawal = async (item: WithdrawalItem) => {
    if (item.status === 'completed') {
      await showAlert('⚠️ Bu ödeme zaten yatırıldı olarak tamamlanmış!', 'Uyarı');
      return;
    }
    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({ status: 'completed' })
        .eq('id', item.id)
        .neq('status', 'completed');

      if (error) throw error;

      setWithdrawals(prev => prev.map(w => w.id === item.id ? { ...w, status: 'completed' } : w));
      setActionMessage(`💰 ${item.full_name} ödemesi tamamlandı ve Yatırıldı olarak kaydedildi!`);

      try {
        const dateStr = new Date().toLocaleDateString('tr-TR');
        const timeStr = new Date().toLocaleTimeString('tr-TR');
        const msg = `
🟢 <b>ÖDEME BAŞARIYLA YATIRILDI!</b> 💸

👤 <b>Yayıncı:</b> ${item.full_name} (@${item.profile_name || 'Kullanıcı'})
💵 <b>Yatırılan Tutar:</b> ${Number(item.amount_currency).toFixed(2)} ₺ (${item.amount_diamonds.toLocaleString()} 💎)
🏦 <b>IBAN:</b> <code>${item.iban}</code>
✍️ <b>Hesap Sahibi:</b> ${item.full_name}
📅 <b>Tarih:</b> ${dateStr} • ${timeStr}
✅ <b>Durum:</b> 🟢 Yatırıldı (İşlem Tamamlandı)
        `.trim();
        sendTelegramAlert(msg).catch(() => {});
      } catch (_) {}

      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      await showAlert('Hata: ' + (err.message || 'Kaydedilemedi'), 'Hata');
    }
  };

  const handleRejectWithdrawal = async (item: WithdrawalItem) => {
    if (item.status === 'rejected' || item.status === 'completed') {
      await showAlert('⚠️ Bu çekim talebi zaten sonuçlandırılmış!', 'Uyarı');
      return;
    }

    const reason = await showPrompt(
      `${item.full_name} kullanıcısının ${item.amount_diamonds} elmaslık çekim talebini reddetmek ve elmaslarını hesabına iade etmek üzeresiniz.\n\nRed gerekçesi (isteğe bağlı):`,
      'Hatalı veya uyuşmayan IBAN bilgisi',
      'Çekim Talebi Reddi'
    );
    if (reason === null) return;

    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({ status: 'rejected' })
        .eq('id', item.id)
        .in('status', ['pending', 'approved']);

      if (error) throw error;

      const { data: userProf } = await supabase
        .from('profiles')
        .select('total_diamonds')
        .eq('id', item.user_id)
        .single();

      const currentDiamonds = userProf?.total_diamonds || 0;
      const refundedDiamonds = currentDiamonds + item.amount_diamonds;

      await supabase
        .from('profiles')
        .update({ total_diamonds: refundedDiamonds })
        .eq('id', item.user_id);

      setWithdrawals(prev => prev.map(w => w.id === item.id ? { ...w, status: 'rejected' } : w));
      if (item.status === 'pending') {
        setPendingWithdrawalCount(prev => Math.max(0, prev - 1));
      }
      setActionMessage(`❌ ${item.full_name} talebi reddedildi ve ${item.amount_diamonds} elmas iade edildi.`);

      try {
        const dateStr = new Date().toLocaleDateString('tr-TR');
        const timeStr = new Date().toLocaleTimeString('tr-TR');
        const msg = `
🔴 <b>ÇEKİM TALEBİ REDDEDİLDİ!</b> 💎

👤 <b>Yayıncı:</b> ${item.full_name} (@${item.profile_name || 'Kullanıcı'})
💎 <b>İade Edilen Elmas:</b> ${item.amount_diamonds.toLocaleString()} 💎
💵 <b>Talep Edilen Tutar:</b> ${Number(item.amount_currency).toFixed(2)} ₺
📝 <b>Sebep:</b> ${reason || 'Belirtilmedi'}
📅 <b>Tarih:</b> ${dateStr} • ${timeStr}
↩️ <b>Sonuç:</b> Elmaslar kullanıcının hesabına eksiksiz iade edildi.
        `.trim();
        sendTelegramAlert(msg).catch(() => {});
      } catch (_) {}

      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      await showAlert('Hata: ' + (err.message || 'İşlem başarısız'), 'Hata');
    }
  };

  const copyIban = (iban: string, id: string) => {
    navigator.clipboard.writeText(iban);
    setCopiedIbanId(id);
    setTimeout(() => setCopiedIbanId(null), 2500);
  };

  // ==========================================
  // ALTIN ÖDEME BİLDİRİMLERİ (HAVALE/FAST & KRİPTO)
  // ==========================================
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrders, setPaymentOrders] = useState<PaymentOrderItem[]>([]);
  const [loadingPaymentOrders, setLoadingPaymentOrders] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [pendingPaymentCount, setPendingPaymentCount] = useState(0);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [copiedPaymentId, setCopiedPaymentId] = useState<string | null>(null);

  const fetchPaymentOrders = async () => {
    setLoadingPaymentOrders(true);
    try {
      // 1. Supabase tablosundan çek
      const { data, error } = await supabase
        .from('payment_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      let orders: PaymentOrderItem[] = [];
      if (!error && data) {
        orders = data as PaymentOrderItem[];
      }

      // 2. LocalStorage yedeğini de birleştir
      try {
        const local = JSON.parse(localStorage.getItem('pyngoo_local_payment_notifications') || '[]');
        if (Array.isArray(local)) {
          const existingIds = new Set(orders.map(o => o.id));
          const existingCodes = new Set(orders.map(o => o.order_code));
          for (const loc of local) {
            if (!existingIds.has(loc.id) && !existingCodes.has(loc.order_code)) {
              orders.push(loc);
            }
          }
        }
      } catch (_) {}

      orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPaymentOrders(orders);
      const pending = orders.filter(o => o.status === 'pending').length;
      setPendingPaymentCount(pending);
    } catch (err) {
      console.error('fetchPaymentOrders hatası:', err);
    } finally {
      setLoadingPaymentOrders(false);
    }
  };

  const handleApprovePaymentOrder = async (order: PaymentOrderItem) => {
    if (processingOrderId) return;
    if (order.status !== 'pending') {
      await showAlert('⚠️ Bu sipariş bildirimi zaten onaylanmış veya işlenmiş!', 'Uyarı');
      return;
    }
    const confirmApprove = await showConfirm(
      `🪙 ÖDEME ONAYI:\n\n` +
      `Kullanıcı: ${order.user_name || 'Kullanıcı'} (${order.user_id})\n` +
      `Eklenecek Altın: +${order.total_gold.toLocaleString()} Altın\n` +
      `Ödeme Tipi: ${order.payment_method === 'crypto' ? 'Kripto (USDT)' : 'Havale / FAST'}\n` +
      `Tutar: ${order.price_text}\n` +
      `Sipariş Kodu: ${order.order_code}\n\n` +
      `Banka / Kripto hesabınızı kontrol ettiniz ve paranın geldiğini teyit ediyor musunuz?\nAltın derhal kullanıcının hesabına yüklenecektir.`,
      'Ödeme Onayı'
    );
    if (!confirmApprove) return;

    setProcessingOrderId(order.id);
    try {
      // 1. Güvenli RPC dene: approve_payment_order
      let rpcSuccess = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('approve_payment_order', {
          p_order_id: order.id
        });
        if (!rpcErr && rpcRes && rpcRes.success) {
          rpcSuccess = true;
        }
      } catch (_) {}

      // 2. RPC yoksa doğrudan Supabase profiles ve payment_notifications güncelle
      if (!rpcSuccess) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('total_gold')
          .eq('id', order.user_id)
          .maybeSingle();

        const currentGold = prof?.total_gold || 0;
        const newGold = currentGold + order.total_gold;

        try {
          await supabase
            .from('profiles')
            .update({ total_gold: newGold })
            .eq('id', order.user_id);
        } catch (_) {}

        await supabase
          .from('payment_notifications')
          .update({ status: 'approved', admin_notes: 'Yönetici tarafından onaylandı' })
          .eq('id', order.id);
      }

      // 3. LocalStorage yedeğini güncelle
      try {
        const local = JSON.parse(localStorage.getItem('pyngoo_local_payment_notifications') || '[]');
        const updatedLocal = local.map((l: any) => (l.id === order.id || l.order_code === order.order_code) ? { ...l, status: 'approved' } : l);
        localStorage.setItem('pyngoo_local_payment_notifications', JSON.stringify(updatedLocal));
      } catch (_) {}

      // 4. Hedef Kullanıcının Cihazına Anında Realtime Bildirim ve Yükleme Emri Gönder
      try {
        const userPayChannel = supabase.channel(`user_payment_channel_${order.user_id}`);
        userPayChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            userPayChannel.send({
              type: 'broadcast',
              event: 'payment_approved',
              payload: {
                orderId: order.id,
                orderCode: order.order_code,
                goldAdded: order.total_gold
              }
            });
          }
        });
      } catch (_) {}

      // 5. Cihazda varsa hedef kullanıcının yerel önbelleğini de doğrudan güncelle
      try {
        const cachedProfStr = localStorage.getItem(`pyngoo_user_profile_${order.user_id}`);
        if (cachedProfStr) {
          const cachedProf = JSON.parse(cachedProfStr);
          cachedProf.total_gold = (cachedProf.total_gold || 0) + order.total_gold;
          localStorage.setItem(`pyngoo_user_profile_${order.user_id}`, JSON.stringify(cachedProf));
        }
      } catch (_) {}

      setPaymentOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'approved' } : o));
      setPendingPaymentCount(prev => Math.max(0, prev - 1));

      // 4. İşlem hareketini logla
      await logTransaction(
        order.user_id,
        order.total_gold,
        'purchase_gold',
        { details: `${order.price_text} - ${order.order_code} nolu ödeme admin onayı ile yüklendi` }
      );

      // 5. Telegram Bildirimi Gönder
      try {
        const msg = `
✅ <b>ALTIN ÖDEMESİ ONAYLANDI & YÜKLENDİ!</b> 🪙

👤 <b>Kullanıcı:</b> ${order.user_name || 'Kullanıcı'} (<code>${order.user_id.slice(0, 8)}</code>)
🪙 <b>Yüklenen Altın:</b> +${order.total_gold.toLocaleString()} Altın
💵 <b>Tutar:</b> ${order.price_text}
💳 <b>Yöntem:</b> ${order.payment_method === 'crypto' ? '🪙 Kripto (USDT TRC-20)' : '🏦 Havale / FAST'}
🏷️ <b>Sipariş Kodu:</b> <code>${order.order_code}</code>
${order.sender_name ? `✍️ <b>Gönderen:</b> ${order.sender_name}\n` : ''}${order.crypto_txid ? `🔗 <b>TXID/Cüzdan:</b> <code>${order.crypto_txid}</code>\n` : ''}📅 <b>Tarih:</b> ${new Date().toLocaleDateString('tr-TR')} • ${new Date().toLocaleTimeString('tr-TR')}
⚡ <b>Sonuç:</b> Altınlar anında hesaba aktarıldı.
        `.trim();
        sendTelegramAlert(msg).catch(() => {});
      } catch (_) {}

      setActionMessage(`✅ ${order.user_name || 'Kullanıcı'} hesabına +${order.total_gold.toLocaleString()} altın başarıyla yüklendi!`);
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      console.error('Ödeme onaylama hatası:', err);
      await showAlert('Hata: ' + (err.message || 'Ödeme onaylanamadı'), 'Hata');
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleRejectPaymentOrder = async (order: PaymentOrderItem) => {
    if (processingOrderId) return;
    const reason = await showPrompt(
      `❌ ÖDEME REDDİ:\n\n${order.user_name || 'Kullanıcı'} adlı kişinin ${order.price_text} tutarındaki bildirimini reddetmek üzeresiniz.\n\nRed gerekçesi:`,
      'Banka / Cüzdan hesabında ödeme tespit edilemedi',
      'Ödeme Reddi'
    );
    if (reason === null) return;

    setProcessingOrderId(order.id);
    try {
      await supabase
        .from('payment_notifications')
        .update({ status: 'rejected', admin_notes: reason })
        .eq('id', order.id);

      try {
        const local = JSON.parse(localStorage.getItem('pyngoo_local_payment_notifications') || '[]');
        const updatedLocal = local.map((l: any) => (l.id === order.id || l.order_code === order.order_code) ? { ...l, status: 'rejected', admin_notes: reason } : l);
        localStorage.setItem('pyngoo_local_payment_notifications', JSON.stringify(updatedLocal));
      } catch (_) {}

      setPaymentOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'rejected', admin_notes: reason } : o));
      setPendingPaymentCount(prev => Math.max(0, prev - 1));

      try {
        const msg = `
🔴 <b>ALTIN ÖDEMESİ REDDEDİLDİ!</b> ❌

👤 <b>Kullanıcı:</b> ${order.user_name || 'Kullanıcı'}
🪙 <b>Talep Edilen:</b> ${order.total_gold.toLocaleString()} Altın
💵 <b>Tutar:</b> ${order.price_text}
🏷️ <b>Sipariş Kodu:</b> <code>${order.order_code}</code>
📝 <b>Gerekçe:</b> ${reason || 'Ödeme tespit edilemedi'}
📅 <b>Tarih:</b> ${new Date().toLocaleDateString('tr-TR')} • ${new Date().toLocaleTimeString('tr-TR')}
        `.trim();
        sendTelegramAlert(msg).catch(() => {});
      } catch (_) {}

      setActionMessage(`❌ ${order.order_code} nolu sipariş bildirimi reddedildi.`);
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      console.error('Ödeme reddetme hatası:', err);
      await showAlert('Hata: ' + (err.message || 'İşlem başarısız'), 'Hata');
    } finally {
      setProcessingOrderId(null);
    }
  };

  const copyPaymentField = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPaymentId(id);
    setTimeout(() => setCopiedPaymentId(null), 2500);
  };

  // ==========================================
  // ALTYAPI & KOTA TAKİBİ (SADECE ÖMER İÇİN: SUPABASE, AGORA, VERCEL)
  // ==========================================
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaMetrics, setQuotaMetrics] = useState<any | null>(null);
  const [vercelTokenInput, setVercelTokenInput] = useState<string>(() => localStorage.getItem('pyngoo_vercel_token') || '');
  const [showVercelInput, setShowVercelInput] = useState(false);
  const [saveVercelSuccess, setSaveVercelSuccess] = useState(false);
  const [agoraAudioInput, setAgoraAudioInput] = useState<string>(() => localStorage.getItem('pyngoo_agora_audio_mins') || '22');
  const [agoraVideoInput, setAgoraVideoInput] = useState<string>(() => localStorage.getItem('pyngoo_agora_video_mins') || '68');
  const [showAgoraEdit, setShowAgoraEdit] = useState(false);
  const [vercelBandwidthMb, setVercelBandwidthMb] = useState<string>(() => localStorage.getItem('pyngoo_vercel_bw_mb') || '513.8');
  const [showVercelEdit, setShowVercelEdit] = useState(false);

  const handleFetchQuotaMetrics = async () => {
    setQuotaLoading(true);
    try {
      const pingStart = performance.now();
      
      // 1. Supabase canlı tablo satır sayıları
      const [
        { count: profilesCount },
        { count: messagesCount },
        { count: matchesCount },
        { count: txCount },
        { count: reportsCount }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('match_history').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true })
      ]);
      const pingMs = Math.round(performance.now() - pingStart);

      // 2. Agora RTC Dakika Hesabı (Sesli & Görüntülü Ayrı Kırılım)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const { data: monthCalls } = await supabase
        .from('match_history')
        .select('duration_sec, started_at')
        .gte('started_at', startOfMonth.toISOString());

      let totalSecondsMonth = 0;
      (monthCalls || []).forEach(c => {
        totalSecondsMonth += (c.duration_sec || 60);
      });
      const dbMinutesMonth = Math.ceil(totalSecondsMonth / 60);

      // Agora Konsol Verileriyle Kalibrasyon (Sesli: 22 dk, Video HD: 68 dk)
      const savedAudioMins = parseInt(localStorage.getItem('pyngoo_agora_audio_mins') || '22', 10);
      const savedVideoMins = parseInt(localStorage.getItem('pyngoo_agora_video_mins') || '68', 10);
      const extraMinutes = Math.max(0, dbMinutesMonth - 64);
      const audioMinutes = savedAudioMins + Math.round(extraMinutes * 0.25);
      const videoMinutes = savedVideoMins + Math.round(extraMinutes * 0.75);
      const totalMinutesMonth = audioMinutes + videoMinutes;

      const freeLimitMinutes = 10000;
      const remainingMinutes = Math.max(0, freeLimitMinutes - totalMinutesMonth);
      const agoraPercent = Math.min(100, Math.round((totalMinutesMonth / freeLimitMinutes) * 100 * 10) / 10);

      // 3. Vercel API Entegrasyonu (Eğer token tanımlıysa canlı çeker)
      const savedBwMb = parseFloat(localStorage.getItem('pyngoo_vercel_bw_mb') || '513.83');
      const bwLimitGb = 100;
      const bwUsedGb = Math.round((savedBwMb / 1024) * 100) / 100;
      const bwRemainingGb = Math.max(0, Math.round((bwLimitGb - bwUsedGb) * 100) / 100);
      const bwPercent = Math.min(100, Math.round((savedBwMb / (bwLimitGb * 1024)) * 100 * 100) / 100);

      let vercelData: any = {
        deploymentsToday: 2,
        deployLimitDay: 100,
        bandwidthLimitGb: bwLimitGb,
        bandwidthMb: savedBwMb,
        bandwidthUsedGb: bwUsedGb,
        bandwidthRemainingGb: bwRemainingGb,
        bandwidthPercent: bwPercent,
        inboundMb: 3.15,
        outboundMb: 510.68,
        buildMinutesLimit: 6000,
        latestDeploy: null,
        hasCustomToken: false
      };

      const tokenToUse = (vercelTokenInput || localStorage.getItem('pyngoo_vercel_token') || '').trim();
      if (tokenToUse) {
        try {
          const resp = await fetch('https://api.vercel.com/v6/deployments?limit=10', {
            headers: { Authorization: `Bearer ${tokenToUse}` }
          });
          if (resp.ok) {
            const vJson = await resp.json();
            const deployments = vJson.deployments || [];
            const todayIso = new Date().toISOString().split('T')[0];
            const todayDeploys = deployments.filter((d: any) => d.created && new Date(d.created).toISOString().split('T')[0] === todayIso);
            const latest = deployments[0];
            vercelData = {
              ...vercelData,
              deploymentsToday: Math.max(2, todayDeploys.length),
              hasCustomToken: true,
              latestDeploy: latest ? {
                name: latest.name,
                url: latest.url,
                state: latest.state,
                created: latest.created
              } : null
            };
          }
        } catch (vErr) {
          console.warn('Vercel API fetch note:', vErr);
        }
      }

      const pCount = profilesCount || 0;
      const mCount = messagesCount || 0;
      const matchC = matchesCount || 0;
      const tCount = txCount || 0;
      const rCount = reportsCount || 0;

      const dbEstimateMb = Math.round(((pCount * 1.8 + mCount * 0.9 + matchC * 0.6 + tCount * 0.5 + 35) / 1024) * 100) / 100;
      const mauLimit = 50000;
      const mauPercent = Math.round((pCount / mauLimit) * 100 * 100) / 100;

      setQuotaMetrics({
        supabase: {
          profiles: pCount,
          messages: mCount,
          matches: matchC,
          transactions: tCount,
          reports: rCount,
          pingMs,
          mauLimit,
          mauPercent,
          dbSizeEstimateMb: dbEstimateMb,
          dbLimitMb: 500
        },
        agora: {
          totalSecondsMonth,
          totalMinutesMonth,
          audioMinutes,
          videoMinutes,
          totalCallsMonth: (monthCalls || []).length,
          freeLimitMinutes,
          remainingMinutes,
          percentUsed: agoraPercent
        },
        vercel: vercelData,
        lastChecked: new Date().toLocaleTimeString('tr-TR')
      });

    } catch (err) {
      console.error('Quota fetch error:', err);
    } finally {
      setQuotaLoading(false);
    }
  };

  const handleSaveVercelToken = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('pyngoo_vercel_token', vercelTokenInput.trim());
    setSaveVercelSuccess(true);
    setTimeout(() => setSaveVercelSuccess(false), 3000);
    handleFetchQuotaMetrics();
  };

  // ==========================================
  // KULLANICI ALTIN & AKTİVİTE DENETİM RAPORU (HESAP EKSTRESİ)
  // ==========================================

  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditQuery, setAuditQuery] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditUser, setAuditUser] = useState<any | null>(null);
  const [auditItems, setAuditItems] = useState<any[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Tarih Önayarı Seçimi
  const handleAuditDatePreset = (preset: 'today' | 'week' | 'month' | 'all') => {
    const now = new Date();
    const pad = (n: number) => n < 10 ? '0' + n : n;
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
      const todayStr = toYMD(now);
      setAuditStartDate(todayStr);
      setAuditEndDate(todayStr);
    } else if (preset === 'week') {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      setAuditStartDate(toYMD(past));
      setAuditEndDate(toYMD(now));
    } else if (preset === 'month') {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      setAuditStartDate(toYMD(past));
      setAuditEndDate(toYMD(now));
    } else {
      setAuditStartDate('');
      setAuditEndDate('');
    }
  };

  // Denetim Raporunu Supabase'den Çek
  const handleFetchAuditReport = async (overrideQuery?: string) => {
    const query = (overrideQuery !== undefined ? overrideQuery : auditQuery).trim();
    if (!query) {
      setAuditError('Lütfen aramak istediğiniz kullanıcı adını veya UUID kodunu girin.');
      return;
    }
    setAuditLoading(true);
    setAuditError(null);
    setCopySuccess(false);

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
      let uQuery = supabase.from('profiles').select('*');
      if (isUuid) {
        uQuery = uQuery.eq('id', query);
      } else {
        uQuery = uQuery.ilike('display_name', query);
      }

      const { data: targetProfile, error: profileErr } = await uQuery.limit(1).maybeSingle();

      if (profileErr) {
        setAuditError(`Profil arama hatası: ${profileErr.message}`);
        setAuditLoading(false);
        return;
      }

      if (!targetProfile) {
        setAuditError(`"${query}" kullanıcı adına sahip profil bulunamadı.`);
        setAuditUser(null);
        setAuditItems([]);
        setAuditLoading(false);
        return;
      }

      setAuditUser(targetProfile);

      // Tarih filtreleri
      const startIso = auditStartDate ? new Date(auditStartDate + 'T00:00:00').toISOString() : null;
      const endIso = auditEndDate ? new Date(auditEndDate + 'T23:59:59.999').toISOString() : null;

      // 1. Transactions tablosu
      let tQuery = supabase.from('transactions').select('*').eq('user_id', targetProfile.id);
      if (startIso) tQuery = tQuery.gte('created_at', startIso);
      if (endIso) tQuery = tQuery.lte('created_at', endIso);
      const { data: txRecords } = await tQuery.order('created_at', { ascending: false });

      // 2. Messages tablosu (hediyeler & arama duyuruları)
      let mQuery = supabase.from('messages')
        .select('*')
        .or(`sender_id.eq.${targetProfile.id},receiver_id.eq.${targetProfile.id}`);
      if (startIso) mQuery = mQuery.gte('created_at', startIso);
      if (endIso) mQuery = mQuery.lte('created_at', endIso);
      const { data: msgRecords } = await mQuery.order('created_at', { ascending: false });

      // 3. Match History tablosu (özel aramalar)
      let matchQuery = supabase.from('match_history')
        .select('*')
        .or(`caller_id.eq.${targetProfile.id},receiver_id.eq.${targetProfile.id}`);
      if (startIso) matchQuery = matchQuery.gte('started_at', startIso);
      if (endIso) matchQuery = matchQuery.lte('started_at', endIso);
      const { data: matchRecords } = await matchQuery.order('started_at', { ascending: false });

      // 4. Partner kullanıcı isimlerini topla
      const partnerIdSet = new Set<string>();
      (msgRecords || []).forEach(m => {
        if (m.sender_id && m.sender_id !== targetProfile.id) partnerIdSet.add(m.sender_id);
        if (m.receiver_id && m.receiver_id !== targetProfile.id) partnerIdSet.add(m.receiver_id);
      });
      (matchRecords || []).forEach(m => {
        if (m.caller_id && m.caller_id !== targetProfile.id) partnerIdSet.add(m.caller_id);
        if (m.receiver_id && m.receiver_id !== targetProfile.id) partnerIdSet.add(m.receiver_id);
      });

      const partnerNameMap: Record<string, string> = {};
      if (partnerIdSet.size > 0) {
        const { data: partnerList } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', Array.from(partnerIdSet));
        partnerList?.forEach(p => {
          partnerNameMap[p.id] = p.display_name;
        });
      }

      // Hediye bilgileri sözlüğü
      const giftCostMap: Record<string, { cost: number; reward: number; name: string }> = {
        '🌹': { cost: 10, reward: 3, name: 'Gül' },
        '☕': { cost: 20, reward: 6, name: 'Kahve' },
        '🍦': { cost: 35, reward: 10, name: 'Dondurma' },
        '🍫': { cost: 50, reward: 15, name: 'Çikolata' },
        '🧸': { cost: 100, reward: 30, name: 'Oyuncak Ayı' },
        '💐': { cost: 200, reward: 60, name: 'Çiçek Buketi' },
        '💍': { cost: 350, reward: 105, name: 'Tektaş Yüzük' },
        '👑': { cost: 500, reward: 150, name: 'Kraliyet Tacı' },
        '🏎️': { cost: 1000, reward: 300, name: 'Spor Araba' },
        '🛥️': { cost: 2000, reward: 600, name: 'Lüks Yat' },
        '🚀': { cost: 3000, reward: 900, name: 'Uzay Roketi' },
        '🏰': { cost: 5000, reward: 1500, name: 'Masal Şatosu' },
      };

      const combinedLedger: any[] = [];

      // A) Transactions tablosundaki resmi kayıtlar
      (txRecords || []).forEach(tx => {
        let label = 'İşlem';
        let icon = '🪙';
        let typeCategory: 'in' | 'out' = tx.amount >= 0 ? 'in' : 'out';
        let desc = 'Sistem Hareketi';

        if (tx.transaction_type === 'purchase_gold') {
          label = 'Altın Yükleme';
          icon = '💳';
          desc = `Market Satın Alımı (+${tx.amount} 🪙)`;
        } else if (tx.transaction_type === 'gift_sent') {
          label = 'Hediye Gönderildi';
          icon = '🎁';
          desc = `Kullanıcıya hediye harcaması (${Math.abs(tx.amount)} 🪙)`;
        } else if (tx.transaction_type === 'gift_received') {
          label = 'Hediye Alındı';
          icon = '💎';
          desc = `Hediyeden elmas kazancı (+${tx.amount} 💎)`;
        } else if (tx.transaction_type === 'call_cost') {
          label = 'Özel Görüşme Harcaması';
          icon = '📞';
          desc = `Arama görüşme bedeli (${tx.amount} 🪙)`;
        } else if (tx.transaction_type === 'call_earning') {
          label = 'Arama Kazancı';
          icon = '💎';
          desc = `Görüşme kadın elmas payı (+${tx.amount} 💎)`;
        } else if (tx.transaction_type === 'daily_reward') {
          label = 'Günlük Giriş Bonusu';
          icon = '🎁';
          desc = `Günlük ödül (+${tx.amount} 🪙)`;
        } else if (tx.transaction_type === 'ad_reward') {
          label = 'Reklam Bonusu';
          icon = '🎬';
          desc = `Reklam izleme ödülü (+${tx.amount} 🪙)`;
        }

        combinedLedger.push({
          id: tx.transaction_id,
          timestamp: new Date(tx.created_at).getTime(),
          createdAtStr: tx.created_at,
          type: tx.transaction_type,
          label,
          icon,
          category: typeCategory,
          partnerName: 'Pyngoo Sistem',
          details: desc,
          amount: tx.amount,
          source: 'transactions'
        });
      });

      // B) Messages tablosundan hediye ve arama analizleri
      (msgRecords || []).forEach(msg => {
        const isSender = msg.sender_id === targetProfile.id;
        const partnerId = isSender ? msg.receiver_id : msg.sender_id;
        const partnerName = partnerNameMap[partnerId] || 'Kullanıcı';

        let detectedEmoji = msg.gift_emoji;
        if (!detectedEmoji) {
          for (const emoji of Object.keys(giftCostMap)) {
            if (msg.content && msg.content.includes(emoji)) {
              detectedEmoji = emoji;
              break;
            }
          }
        }

        if (detectedEmoji && giftCostMap[detectedEmoji]) {
          const giftInfo = giftCostMap[detectedEmoji];
          const msgTime = new Date(msg.created_at).getTime();
          const alreadyInTx = combinedLedger.some(item => 
            item.source === 'transactions' && 
            Math.abs(item.timestamp - msgTime) < 5000 &&
            (item.type === 'gift_sent' || item.type === 'gift_received')
          );

          if (!alreadyInTx) {
            if (isSender) {
              combinedLedger.push({
                id: msg.id,
                timestamp: msgTime,
                createdAtStr: msg.created_at,
                type: 'gift_sent',
                label: 'Hediye Gönderildi',
                icon: '🎁',
                category: 'out',
                partnerName,
                details: `${detectedEmoji} ${giftInfo.name} Hediyesi`,
                amount: -giftInfo.cost,
                source: 'messages'
              });
            } else {
              combinedLedger.push({
                id: msg.id,
                timestamp: msgTime,
                createdAtStr: msg.created_at,
                type: 'gift_received',
                label: 'Hediye Alındı',
                icon: '💎',
                category: 'in',
                partnerName,
                details: `${detectedEmoji} ${giftInfo.name} Hediyesi (+${giftInfo.reward} 💎)`,
                amount: giftInfo.reward,
                source: 'messages'
              });
            }
          }
        } else if (msg.content && msg.content.includes('📞') && msg.content.includes('arama')) {
          const msgTime = new Date(msg.created_at).getTime();
          const alreadyInTx = combinedLedger.some(item => 
            Math.abs(item.timestamp - msgTime) < 5000 &&
            item.type === 'call_cost'
          );
          if (!alreadyInTx && isSender) {
            combinedLedger.push({
              id: msg.id,
              timestamp: msgTime,
              createdAtStr: msg.created_at,
              type: 'call_cost',
              label: 'Özel Görüşme Başlatıldı',
              icon: '📞',
              category: 'out',
              partnerName,
              details: '60 sn Özel Görüşme (120 Altın/dk)',
              amount: -120,
              source: 'messages'
            });
          }
        }
      });

      // C) Match History görüşmeleri
      (matchRecords || []).forEach(match => {
        const isCaller = match.caller_id === targetProfile.id;
        const partnerId = isCaller ? match.receiver_id : match.caller_id;
        const partnerName = partnerNameMap[partnerId] || 'Kullanıcı';
        const duration = match.duration_sec || 60;
        const minutes = Math.max(1, Math.ceil(duration / 60));
        const matchTime = new Date(match.started_at).getTime();

        const alreadyLogged = combinedLedger.some(item => 
          item.type === 'call_cost' &&
          Math.abs(item.timestamp - matchTime) < 15000
        );

        if (!alreadyLogged && isCaller) {
          combinedLedger.push({
            id: match.match_id,
            timestamp: matchTime,
            createdAtStr: match.started_at,
            type: 'call_cost',
            label: 'Özel Sesli/Görüntülü Arama',
            icon: '📞',
            category: 'out',
            partnerName,
            details: `${duration} sn görüşme (${minutes} dk x 120 Altın)`,
            amount: -(minutes * 120),
            source: 'match_history'
          });
        }
      });

      // Kronolojik sıralama: En yeniden eskiye
      combinedLedger.sort((a, b) => b.timestamp - a.timestamp);
      setAuditItems(combinedLedger);

    } catch (err: any) {
      console.error('Audit fetch error:', err);
      setAuditError(`Rapor hazırlanırken hata oluştu: ${err.message || err}`);
    } finally {
      setAuditLoading(false);
    }
  };

  // İtiraz Yanıt Metnini Panoya Kopyalama
  const handleCopyAuditStatement = () => {
    if (!auditUser) return;
    const formatDate = (iso: string) => {
      try {
        const d = new Date(iso);
        return `${d.toLocaleDateString('tr-TR')} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
      } catch (_) {
        return iso;
      }
    };

    const totalIn = auditItems.filter(i => i.amount > 0).reduce((sum, i) => sum + i.amount, 0);
    const totalOut = auditItems.filter(i => i.amount < 0).reduce((sum, i) => sum + Math.abs(i.amount), 0);
    const totalCalls = auditItems.filter(i => i.type === 'call_cost').length;
    const totalGifts = auditItems.filter(i => i.type === 'gift_sent').length;

    const dateRangeStr = (auditStartDate || auditEndDate) 
      ? `${auditStartDate || 'İlk Kayıt'} - ${auditEndDate || 'Günümüz'}`
      : 'Tüm Kayıtlar';

    let text = `📋 PYNGOO KULLANICI HESAP & ALTIN EKSTRESİ DENETİM RAPORU\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Sayın ${auditUser.display_name},\n\n`;
    text += `Uygulamamızdaki altın bakiyesi ve harcama itirazınız sistem loglarımız ve sunucu kayıtlarımız üzerinden incelenmiştir.\n\n`;
    text += `🗓️ İncelenen Tarih Aralığı: ${dateRangeStr}\n`;
    text += `👤 Kullanıcı: ${auditUser.display_name} (ID: ${auditUser.id})\n`;
    text += `💰 Güncel Bakiyeniz: ${auditUser.total_gold || 0} Altın 🪙, ${auditUser.total_diamonds || 0} Elmas 💎\n\n`;
    text += `📊 DÖNEM ÖZETİ:\n`;
    text += `• Toplam Yüklenen / Alınan Altın: +${totalIn} 🪙\n`;
    text += `• Toplam Harcanan Altın: -${totalOut} 🪙\n`;
    text += `• Yapılan Özel Görüşme Sayısı: ${totalCalls} adet\n`;
    text += `• Gönderilen Hediye Sayısı: ${totalGifts} adet\n\n`;
    text += `📝 AYRINTILI İŞLEM HAREKETLERİ DÖKÜMÜ:\n`;

    if (auditItems.length === 0) {
      text += `(Seçilen tarih aralığında altın veya hediye hareketi bulunmamaktadır.)\n`;
    } else {
      auditItems.forEach((item, index) => {
        const sign = item.amount > 0 ? `+${item.amount}` : `${item.amount}`;
        text += `${index + 1}) ${formatDate(item.createdAtStr)} | [${item.label}] ${sign} 🪙\n`;
        text += `   Hedef: ${item.partnerName} | Detay: ${item.details}\n`;
      });
    }

    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Altınlarınız ve tüm hareketleriniz sunucu kayıtlarımızda anlık olarak tutulmakta olup yukarıda belirtilen görüşme ve hediye gönderimlerinde bizzat harcanmıştır.\n`;
    text += `Ek bir sorunuz veya desteğe ihtiyacınız olursa bize dilediğiniz an ulaşabilirsiniz.\n`;
    text += `İyi sohbetler dileriz.\n`;
    text += `Pyngoo Müşteri Memnuniyeti & Güvenlik Birimi`;

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3500);
  };

  // Kartlardan veya arama butonundan hızlı açma
  const handleOpenAuditForUser = (target: string) => {
    setAuditQuery(target);
    setShowAuditModal(true);
    handleFetchAuditReport(target);
  };


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(false);
    setAuthMessage(null);
    if (lockoutTime > Date.now()) {
      const remainingMin = Math.ceil((lockoutTime - Date.now()) / 60000);
      await showAlert(`⚠️ Güvenlik Uyarısı: 5 defa hatalı deneme yapıldığı için giriş 15 dakika dondurulmuştur. Lütfen ${remainingMin} dakika sonra tekrar deneyin.`, 'Güvenlik Uyarısı');
      return;
    }

    const email = (usernameInput || pinInput).trim();
    const pass = passwordInput.trim();
    if (!email || !pass) {
      setPinError(true);
      return;
    }

    try {
      // Pyngoo hesabının e-posta + şifresiyle gerçek Supabase girişi
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (!signErr) {
        const ok = await applyStaffSession();
        if (ok) {
          setFailedAttempts(0);
          logModeratorAction('mod_login', 'Sistem Paneli', `${email} panele giriş yaptı.`);
        }
        return; // Yetkisiz hesapsa mesaj applyStaffSession içinde gösterilir
      }

      // Hatalı şifre/kullanıcı adı
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      setPinError(true);

      if (nextFailed >= 5) {
        const lockUntil = Date.now() + 15 * 60 * 1000;
        setLockoutTime(lockUntil);
        await showAlert('⚠️ Güvenlik Koruması: 5 hatalı şifre denemesi nedeniyle panel 15 dakika boyunca kilitlenmiştir!', 'Güvenlik Koruması');
      }
    } catch (err) {
      console.error('Şifre doğrulama hatası:', err);
      setPinError(true);
    }
  };

  // Google hesabıyla panel girişi (omer hesabı Google'a bağlıdır)
  const handleGoogleLogin = async () => {
    setAuthMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` }
    });
    if (error) setAuthMessage(`⚠️ Google girişi başlatılamadı: ${error.message}`);
  };

  // Yerel depolamayı kalıcı senkronize etme yardımcıları
  const syncLocalReportStatus = (reportId: string, status: 'resolved' | 'dismissed' | 'banned') => {
    try {
      const local: ReportItem[] = JSON.parse(localStorage.getItem('pyngoo_local_reports') || '[]');
      const updated = local.map(r => r.id === reportId ? { ...r, status } : r);
      localStorage.setItem('pyngoo_local_reports', JSON.stringify(updated));
    } catch (_) {}
  };

  const removeLocalReport = (reportId: string) => {
    try {
      const local: ReportItem[] = JSON.parse(localStorage.getItem('pyngoo_local_reports') || '[]');
      const updated = local.filter(r => r.id !== reportId);
      localStorage.setItem('pyngoo_local_reports', JSON.stringify(updated));
    } catch (_) {}
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const localReports: ReportItem[] = JSON.parse(localStorage.getItem('pyngoo_local_reports') || '[]');

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Reports tablosu bulunamadı veya yetki hatası:', error.message);
        setReports(localReports);
      } else {
        const supabaseReports: ReportItem[] = data || [];
        
        const userIds = Array.from(new Set([
          ...supabaseReports.map((r: any) => r.reporter_id), 
          ...supabaseReports.map((r: any) => r.reported_user_id),
          ...localReports.map((r: any) => r.reporter_id),
          ...localReports.map((r: any) => r.reported_user_id)
        ])).filter(Boolean);

        let nameMap = new Map<string, string>();
        if (userIds.length > 0) {
          try {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, display_name')
              .in('id', userIds);
            nameMap = new Map((profiles || []).map((p: any) => [p.id, p.display_name]));
          } catch (_) {}
        }

        const combinedMap = new Map<string, ReportItem>();

        // Sadece admin ise finansal verileri ve ayarları yükle
        if (isAdmin) {
          fetchWithdrawals();
          fetchPaymentOrders();
        }

        // Yerel raporları ekle
        localReports.forEach(r => {
          combinedMap.set(r.id, {
            ...r,
            reporter_name: nameMap.get(r.reporter_id) || r.reporter_name || 'Anonim',
            reported_name: nameMap.get(r.reported_user_id) || r.reported_name || 'Kullanıcı'
          });
        });

        // Supabase raporlarını üzerine yaz
        supabaseReports.forEach((r: any) => {
          combinedMap.set(r.id, {
            ...r,
            reporter_name: nameMap.get(r.reporter_id) || r.reporter_name || 'Anonim',
            reported_name: nameMap.get(r.reported_user_id) || r.reported_name || 'Kullanıcı'
          });
        });

        const allReports = Array.from(combinedMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setReports(allReports);
      }
    } catch (err) {
      console.error('Şikayetler çekilemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchReports();

      // Sadece admin ise finansal verileri ve ayarları yükle
      if (isAdmin) {
        fetchWithdrawals();
        fetchPaymentOrders();
      }

      // Canlı Supabase Realtime Takibi (Şikayetler - Hem Admin Hem Moderatör için)
      const channel = supabase
        .channel('moderator_reports_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (payload) => {
          setReports(prev => [payload.new as ReportItem, ...prev]);
          try {
            const audio = new Audio('/pingoo.mp3');
            audio.play().catch(() => {});
          } catch (_) {}
        })
        .subscribe();

      let withdrawalsChannel: any = null;
      let paymentsChannel: any = null;

      // Finansal Realtime Bildirimleri Sadece Admin için dinlenir
      if (isAdmin) {
        // Canlı Supabase Realtime Takibi (Para Çekim Talepleri)
        withdrawalsChannel = supabase
          .channel('moderator_withdrawals_channel')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawal_requests' }, () => {
            fetchWithdrawals();
            try {
              const audio = new Audio('/pingoo.mp3');
              audio.play().catch(() => {});
            } catch (_) {}
          })
          .subscribe();

        // Canlı Supabase Realtime Takibi (Altın Ödeme Bildirimleri)
        paymentsChannel = supabase
          .channel('moderator_payments_channel')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_notifications' }, () => {
            fetchPaymentOrders();
            try {
              const audio = new Audio('/pingoo.mp3');
              audio.play().catch(() => {});
            } catch (_) {}
          })
          .subscribe();
      }

      return () => {
        supabase.removeChannel(channel);
        if (withdrawalsChannel) supabase.removeChannel(withdrawalsChannel);
        if (paymentsChannel) supabase.removeChannel(paymentsChannel);
      };
    }
  }, [isAuthenticated, isAdmin]);

  // Kullanıcıyı Yasakla (Ban)
  const handleBanUser = async (report: ReportItem) => {
    const ok = await showConfirm(
      `"${report.reported_name || 'Bu kullanıcı'}" adlı kullanıcıyı kalıcı olarak YASAKLAMAK istediğinize emin misiniz?`,
      'Kullanıcıyı Yasakla',
      true,
      'Yasakla'
    );
    if (!ok) return;

    try {
      syncLocalReportStatus(report.id, 'banned');

      // 1. Profil tablosunda is_banned = true yap
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_banned: true })
        .eq('id', report.reported_user_id);

      if (profileError) {
        console.error('Ban hatası:', profileError);
      }

      // 2. Şikayeti banned olarak işaretle
      try {
        await supabase
          .from('reports')
          .update({ status: 'banned' })
          .eq('id', report.id);
      } catch (_) {}

      setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'banned' } : r));
      setActionMessage(`🚫 ${report.reported_name || 'Kullanıcı'} başarıyla yasaklandı.`);
      setTimeout(() => setActionMessage(null), 4000);

      // Telegrama bildir
      sendTelegramAlert(`🔨 <b>KULLANICI YASAKLANDI!</b>\n👤 <b>Yasaklanan:</b> ${report.reported_name || 'Kullanıcı'} (<code>${report.reported_user_id.slice(0, 8)}</code>)\n⚠️ <b>Sebep:</b> ${report.category || report.reason}\n🛡️ <b>Moderatör:</b> Panelden yasaklandı.`);
    } catch (err) {
      console.error(err);
      await showAlert('İşlem sırasında hata oluştu.', 'Hata');
    }
  };

  // Şikayeti Kapat (Dismiss / Resolve)
  const handleResolveReport = async (reportId: string) => {
    try {
      syncLocalReportStatus(reportId, 'resolved');
      try {
        await supabase
          .from('reports')
          .update({ status: 'resolved' })
          .eq('id', reportId);
      } catch (_) {}

      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
      setActionMessage('✅ Şikayet incelendi ve kalıcı olarak kapatıldı.');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Şikayeti Asılsız Olarak İşaretle (Dismiss)
  const handleDismissReport = async (reportId: string) => {
    try {
      syncLocalReportStatus(reportId, 'dismissed');
      try {
        await supabase
          .from('reports')
          .update({ status: 'dismissed' })
          .eq('id', reportId);
      } catch (_) {}

      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'dismissed' } : r));
      setActionMessage('🛡️ Şikayet "Asılsız / Masum" olarak arşivlendi.');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'dismissed' } : r));
    }
  };

  // Şikayeti Kalıcı Olarak Sil (Sadece Admin)
  const handleDeleteReport = async (reportId: string) => {
    if (!isAdmin) {
      await showAlert('Şikayet kaydını kalıcı olarak silme yetkisi yalnızca sistem yöneticisine (Admin) aittir. Moderatörler şikayeti "Çözüldü" veya "Asılsız" olarak işaretleyebilir.', 'Yetki Yetersiz');
      return;
    }
    const ok = await showConfirm('Bu şikayet kaydını kalıcı olarak silmek istediğinize emin misiniz?', 'Şikayeti Sil', true, 'Sil');
    if (!ok) return;
    try {
      removeLocalReport(reportId);
      try {
        await supabase.from('reports').delete().eq('id', reportId);
      } catch (_) {}
      try {
        await supabase.rpc('delete_report', { p_report_id: reportId });
      } catch (_) {}
      setReports(prev => prev.filter(r => r.id !== reportId));
      setActionMessage('🗑️ Şikayet kaydı kalıcı olarak silindi.');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Tüm Şikayetleri Temizle (Sadece Admin)
  const handleClearAllReports = async () => {
    if (!isAdmin) {
      await showAlert('Tüm şikayet kayıtlarını temizleme yetkisi yalnızca sistem yöneticisine (Admin) aittir.', 'Yetki Yetersiz');
      return;
    }
    const ok = await showConfirm('Tüm şikayet kayıtlarını kalıcı olarak temizlemek istediğinize emin misiniz? Bu işlem geri alınamaz.', 'Tüm Şikayetleri Temizle', true, 'Tümünü Temizle');
    if (!ok) return;
    try {
      localStorage.removeItem('pyngoo_local_reports');
      try {
        await supabase.from('reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (_) {}
      setReports([]);
      setActionMessage('🗑️ Tüm şikayet kayıtları kalıcı olarak temizlendi.');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Tüm Kayıtlı Kullanıcıları Çek
  const fetchAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'deleted')
        .not('display_name', 'ilike', '%silinmiş%')
        .not('display_name', 'ilike', '%silinmis%')
        .order('created_at', { ascending: false });

      if (data) {
        setAllUsersList(data);
      }
    } catch (err) {
      console.error('Kullanıcılar çekilemedi:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Kullanıcıyı Yasakla / Yasağı Kaldır
  const handleToggleBanUser = async (user: any) => {
    const newStatus = !user.is_banned;
    const msg = newStatus 
      ? `"${user.display_name}" adlı kullanıcıyı YASAKLAMAK istediğinize emin misiniz?` 
      : `"${user.display_name}" kullanıcısının yasağını KALDIRMAK istediğinize emin misiniz?`;
    const ok = await showConfirm(msg, newStatus ? 'Kullanıcıyı Yasakla' : 'Yasağı Kaldır', newStatus, newStatus ? 'Yasakla' : 'Yasağı Kaldır');
    if (!ok) return;

    try {
      await supabase.from('profiles').update({ is_banned: newStatus }).eq('id', user.id);
      setAllUsersList(prev => prev.map(u => u.id === user.id ? { ...u, is_banned: newStatus } : u));
      setActionMessage(newStatus ? `🚫 "${user.display_name}" başarıyla yasaklandı.` : `✅ "${user.display_name}" yasağı kaldırıldı.`);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Kullanıcı Profilini Kalıcı Sil (Kullanıcı Adını Boşa Çıkar)
  const handleDeleteUserProfile = async (user: any) => {
    const ok = await showConfirm(
      `"${user.display_name}" adlı kullanıcı profilini kalıcı olarak silmek ve "${user.display_name}" kullanıcı adını tamamen boşa çıkarmak istediğinize emin misiniz?\n\nBu işlem "${user.display_name}" kullanıcı adını tekrar kayıt olunabilir hale getirir.`,
      'Profili Kalıcı Sil',
      true,
      'Kalıcı Olarak Sil'
    );
    if (!ok) return;

    setDeletingUserId(user.id);
    try {
      try {
        await supabase.rpc('admin_delete_profile', { p_user_id: user.id });
      } catch (_) {}

      await supabase.from('profiles').delete().eq('id', user.id);
      try { await supabase.from('waiting_room').delete().eq('user_id', user.id); } catch (_) {}
      try { await supabase.from('reports').delete().or(`reporter_id.eq.${user.id},reported_user_id.eq.${user.id}`); } catch (_) {}

      setAllUsersList(prev => prev.filter(u => u.id !== user.id));
      setActionMessage(`🗑️ "${user.display_name}" profili silindi ve kullanıcı adı boşa çıkarıldı!`);
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      console.error('Profil silme hatası:', err);
      await showAlert('Silme sırasında hata: ' + (err.message || 'Bilinmiyor'), 'Hata');
    } finally {
      setDeletingUserId(null);
    }
  };

  // Moderatör Listesini Çek
  const fetchModerators = async () => {
    setLoadingMods(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, gender, total_gold, is_moderator, role')
        .or('is_moderator.eq.true,role.eq.moderator,role.eq.admin');
      
      let mods: any[] = data || [];

      // Karaliste / Yetkisi kaldırılanlar listesini al
      let revokedMods: string[] = [];
      try {
        revokedMods = JSON.parse(localStorage.getItem('pyngoo_revoked_moderators') || '[]');
      } catch (_) {}

      // Yetkisi kaldırılan kullanıcıları filtreden geçir
      mods = mods.filter(m => {
        const nameKey = (m.display_name || '').toLowerCase();
        if (revokedMods.includes(nameKey) || (m.id && revokedMods.includes(m.id))) {
          return false;
        }
        return true;
      });

      // Ömer listede yoksa manuel ekle
      const hasOmerInList = mods.some(m => (m.display_name || '').toLowerCase() === 'omer' || m.id === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b');
      if (!hasOmerInList) {
        mods.unshift({
          id: 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b',
          display_name: 'omer',
          role: 'admin',
          is_moderator: true
        });
      }

      let modPasswordMap: Record<string, string> = {};
      try {
        modPasswordMap = JSON.parse(localStorage.getItem('pyngoo_moderator_passwords') || '{}');
      } catch (_) {}

      // SADECE ÖMER ADMİN OLACAK. Diğer herkes (Apoo ve yeni eklenenler dahil) Moderatör olacak!
      const enriched = mods.map(m => {
        const nameKey = (m.display_name || '').toLowerCase();
        const isSuperAdmin = nameKey === 'omer' || m.id === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b';
        return {
          ...m,
          role: isSuperAdmin ? 'admin' : 'moderator',
          assignedPassword: isSuperAdmin ? 'Süper Admin' : (modPasswordMap[nameKey] || 'Tanımlı')
        };
      });

      setModeratorsList(enriched);
    } catch (e) {
      console.error('Moderator list error:', e);
    } finally {
      setLoadingMods(false);
    }
  };

  // Kullanıcıya Moderatör Yetkisi ve Özel Şifre Ver
  const handleAssignModerator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setModErrorMsg('Moderatör yetkisi tanımlama yalnızca sistem yöneticisine (Admin) aittir.');
      return;
    }
    const query = modUsernameInput.trim();
    const pass = modPasswordInput.trim();

    if (!query) {
      setModErrorMsg('Lütfen kullanıcı adını girin!');
      return;
    }
    if (!pass || pass.length < 4) {
      setModErrorMsg('Lütfen bu moderatör için en az 4 karakterli özel bir şifre belirleyin!');
      return;
    }

    setModSuccessMsg(null);
    setModErrorMsg(null);

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
      let userQuery = supabase.from('profiles').select('*');
      if (isUuid) {
        userQuery = userQuery.eq('id', query);
      } else {
        userQuery = userQuery.ilike('display_name', query);
      }
      
      const { data: userRecord, error: searchError } = await userQuery.limit(1).maybeSingle();

      if (searchError) {
        setModErrorMsg(`Arama hatası: ${searchError.message}`);
        return;
      }

      if (!userRecord) {
        setModErrorMsg(`"${query}" kullanıcı adına sahip bir profil bulunamadı.`);
        return;
      }

      const isFemale = userRecord.gender === 'kadin' || userRecord.role === 'streamer';
      const targetRole = isFemale ? 'streamer' : 'moderator';

      // 1. Güvenli RPC dene: admin_set_moderator_status
      let rpcSuccess = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_set_moderator_status', {
          p_target: userRecord.id,
          p_is_moderator: true,
          p_role: targetRole
        });
        if (!rpcErr && rpcRes && rpcRes.success) {
          rpcSuccess = true;
        }
      } catch (_) {}

      // 2. Doğrudan güncelleme dene
      if (!rpcSuccess) {
        await supabase
          .from('profiles')
          .update({ is_moderator: true, role: targetRole })
          .eq('id', userRecord.id);
      }

      // Moderatör şifresini kaydet ve revoked listesinden temizle
      const cleanName = userRecord.display_name.toLowerCase();
      try {
        const modPasswordMap = JSON.parse(localStorage.getItem('pyngoo_moderator_passwords') || '{}');
        modPasswordMap[cleanName] = pass;
        localStorage.setItem('pyngoo_moderator_passwords', JSON.stringify(modPasswordMap));

        const revokedMods: string[] = JSON.parse(localStorage.getItem('pyngoo_revoked_moderators') || '[]');
        const updatedRevoked = revokedMods.filter(r => r !== cleanName && r !== userRecord.id);
        localStorage.setItem('pyngoo_revoked_moderators', JSON.stringify(updatedRevoked));
      } catch (_) {}

      setModSuccessMsg(`✅ "${userRecord.display_name}" kullanıcısına şifresi (${pass}) ile başarıyla Moderatör yetkisi tanımlandı!`);
      setModUsernameInput('');
      setModPasswordInput('');
      fetchModerators();

      logModeratorAction('mod_assign', userRecord.display_name, `Yeni moderatör tanımlandı: ${userRecord.display_name}`);
    } catch (err: any) {
      setModErrorMsg(`Hata: ${err.message || 'Bilinmeyen hata'}`);
    }
  };

  // Moderatör Yetkisini Kaldır (Sadece Ömer yapabilir)
  const handleRevokeModerator = async (targetId: string, targetName: string) => {
    if (!isOmer) {
      await showAlert('Moderatörlük yetkisini sadece yönetici Ömer kaldırabilir.', 'Yetki Yetersiz');
      return;
    }
    const cleanTargetName = (targetName || '').trim().toLowerCase();
    if (cleanTargetName === 'omer' || targetId === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b') {
      await showAlert('Ana Yönetici (Ömer) hesabının yetkisi kaldırılamaz!', 'İşlem Engellendi');
      return;
    }
    const ok = await showConfirm(
      `"${targetName}" kullanıcısının moderatör yetkisini geri almak istediğinize emin misiniz?`,
      'Moderatör Yetkisi Kaldırma',
      true,
      'Yetkiyi Kaldır'
    );
    if (!ok) return;

    try {
      // 1. Güvenli RPC dene: admin_set_moderator_status
      let rpcSuccess = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_set_moderator_status', {
          p_target: targetId || targetName,
          p_is_moderator: false,
          p_role: 'user'
        });
        if (!rpcErr && rpcRes && rpcRes.success) {
          rpcSuccess = true;
        }
      } catch (_) {}

      // 2. Doğrudan güncelleme dene
      if (!rpcSuccess) {
        if (targetId) {
          await supabase
            .from('profiles')
            .update({ is_moderator: false, role: 'user' })
            .eq('id', targetId);
        }
        if (targetName) {
          await supabase
            .from('profiles')
            .update({ is_moderator: false, role: 'user' })
            .ilike('display_name', targetName);
        }
      }

      // 3. LocalStorage yedeğini temizle ve karaliste (revoked) verisine ekle
      try {
        const modPasswordMap = JSON.parse(localStorage.getItem('pyngoo_moderator_passwords') || '{}');
        delete modPasswordMap[cleanTargetName];
        localStorage.setItem('pyngoo_moderator_passwords', JSON.stringify(modPasswordMap));

        const revokedMods: string[] = JSON.parse(localStorage.getItem('pyngoo_revoked_moderators') || '[]');
        if (cleanTargetName && !revokedMods.includes(cleanTargetName)) {
          revokedMods.push(cleanTargetName);
        }
        if (targetId && !revokedMods.includes(targetId)) {
          revokedMods.push(targetId);
        }
        localStorage.setItem('pyngoo_revoked_moderators', JSON.stringify(revokedMods));
        if (targetId) localStorage.removeItem(`pyngoo_role_${targetId}`);
      } catch (_) {}

      // 4. UI durumunu anında güncelle
      setModeratorsList(prev => prev.filter(m => 
        m.id !== targetId && (m.display_name || '').toLowerCase() !== cleanTargetName
      ));
      setModSuccessMsg(`"${targetName}" kullanıcısının yetkisi başarıyla kaldırıldı.`);
      
      // 5. Yeniden senkronize et (fetchModerators da revoked listesini kontrol eder)
      setTimeout(() => {
        fetchModerators();
      }, 400);

      logModeratorAction('mod_revoke', targetName, `${targetName} kullanıcısının moderatör yetkisi kaldırıldı.`);
    } catch (err: any) {
      console.error('Yetki kaldırma hatası:', err);
      await showAlert('Hata: ' + (err.message || 'Yetki kaldırılamadı'), 'Hata');
    }
  };

  const filteredReports = reports.filter(r => {
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'banned') return r.status === 'banned';
    if (filter === 'resolved') return r.status === 'resolved';
    if (filter === 'dismissed') return r.status === 'dismissed';
    return true;
  });

  // Giriş Yapılmadıysa Kullanıcı Adı & Şifre Ekranı
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0b16',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: '#fff'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.12)',
          padding: '36px 28px',
          textAlign: 'center',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}>
          <div style={{
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            background: 'rgba(0, 242, 254, 0.15)',
            border: '2px solid #00f2fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto'
          }}>
            <Lock size={34} color="#00f2fe" />
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px' }}>
            Pyngoo Moderasyon & Yönetim Paneli
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '22px' }}>
            Yetkili Pyngoo hesabınızla (Google veya e-posta) giriş yapın.
          </p>

          {lockoutTime > Date.now() ? (
            <div style={{ background: 'rgba(255,45,85,0.15)', border: '1.5px solid #ff2d55', borderRadius: '16px', padding: '16px', marginBottom: '16px', color: '#ff6b8b', fontSize: '0.88rem' }}>
              ⚠️ Güvenlik Uyarısı: 5 defa hatalı deneme yapıldığı için giriş 15 dakika dondurulmuştur. Lütfen daha sonra tekrar deneyin.
            </div>
          ) : (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '14px', textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', marginBottom: '6px', fontWeight: '700' }}>
                  E-posta:
                </label>
                <input
                  type="email"
                  placeholder="ornek@mail.com"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '13px 16px',
                    borderRadius: '14px',
                    background: 'rgba(0,0,0,0.5)',
                    border: pinError ? '2px solid #ff2d55' : '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: '0.95rem',
                    outline: 'none'
                  }}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '18px', textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', marginBottom: '6px', fontWeight: '700' }}>
                  Şifre:
                </label>
                <input
                  type="password"
                  placeholder="Şifreniz..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '13px 16px',
                    borderRadius: '14px',
                    background: 'rgba(0,0,0,0.5)',
                    border: pinError ? '2px solid #ff2d55' : '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: '0.95rem',
                    outline: 'none'
                  }}
                />
              </div>

              {pinError && (
                <p style={{ color: '#ff2d55', fontSize: '0.82rem', marginBottom: '14px', fontWeight: '700' }}>
                  ⚠️ Hatalı E-posta veya Şifre! (Deneme: {failedAttempts}/5)
                </p>
              )}

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                  border: 'none',
                  color: '#000',
                  fontWeight: '800',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  boxShadow: '0 8px 25px rgba(0, 242, 254, 0.35)'
                }}
              >
                Panele Giriş Yap 🚀
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '13px',
              borderRadius: '16px',
              background: '#fff',
              border: 'none',
              color: '#111',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer'
            }}
          >
            Google ile Giriş Yap
          </button>

          {authMessage && (
            <p style={{ color: '#ff6b8b', fontSize: '0.82rem', marginTop: '14px', fontWeight: '700' }}>
              {authMessage}
            </p>
          )}

          <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={handleReturnToApp}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ArrowLeft size={15} /> Pyngoo Ana Sayfasına Git
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#090a16', color: '#fff', padding: '24px' }}>
      
      {/* ÜST BİLGİ VE KONTROL ÇUBUĞU */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto 24px auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: 'rgba(255,255,255,0.03)',
        padding: '18px 24px',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        {/* ÜST SATIR: baslik solda, Çikis Yap + Yenile sag ust kösede */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '14px',
            background: isAdmin ? 'rgba(255,45,85,0.2)' : 'rgba(0,242,254,0.15)', 
            border: isAdmin ? '2px solid #ff2d55' : '2px solid #00f2fe',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {isAdmin ? <ShieldAlert size={26} color="#ff2d55" /> : <ShieldCheck size={26} color="#00f2fe" />}
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0 }}>
              Pyngoo {isAdmin ? 'Yönetici & Moderasyon Paneli' : 'Moderatör Paneli'}
            </h1>
            <span style={{ fontSize: '0.8rem', color: isAdmin ? '#ff4d6d' : '#00f2fe' }}>
              {isAdmin ? `👑 Sistem Yöneticisi: ${activeModUser?.username || 'Ömer'}` : `🛡️ Moderatör Yetkili: ${activeModUser?.username || 'Moderatör'}`}
            </span>
          </div>
        </div>

          {/* SAĞ ÜST KÖŞE: Çıkış Yap + Yenile */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={fetchReports}
              style={{
                padding: '10px 16px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', fontWeight: '700', fontSize: '0.85rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <RefreshCw size={16} /> Yenile
            </button>
            <button
              onClick={handleLogoutPanel}
              style={{
                padding: '10px 16px', borderRadius: '12px',
                background: 'rgba(255, 45, 85, 0.15)', border: '1px solid rgba(255, 45, 85, 0.4)',
                color: '#ff6b8b', fontWeight: '800', fontSize: '0.85rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              🚪 Çıkış Yap
            </button>
          </div>
        </div>

        {/* İKİNCİ SATIR: yönetim butonları */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* DENETİM GÜNLÜĞÜ (ADMİN İÇİN) */}
          {isAdmin && (
            <button
              onClick={() => setShowModLogModal(true)}
              style={{
                padding: '10px 16px', borderRadius: '12px',
                background: 'rgba(243, 156, 18, 0.15)', border: '1px solid rgba(243, 156, 18, 0.4)',
                color: '#f39c12', fontWeight: '800', fontSize: '0.85rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              📜 Denetim Günlüğü
            </button>
          )}

          {/* SADECE SİSTEM YÖNETİCİSİ (ADMİN) İÇİN ÖZEL YETKİLER */}
          {isAdmin && (
            <>
              <button
                onClick={() => { setShowWithdrawalModal(true); fetchWithdrawals(); }}
                style={{
                  padding: '10px 16px', borderRadius: '12px',
                  background: pendingWithdrawalCount > 0 
                    ? 'linear-gradient(135deg, rgba(46, 204, 113, 0.25), rgba(0, 242, 254, 0.2))' 
                    : 'rgba(46, 204, 113, 0.15)',
                  border: pendingWithdrawalCount > 0 ? '1.5px solid #2ecc71' : '1px solid rgba(46, 204, 113, 0.4)',
                  color: '#2ecc71', fontWeight: '800', fontSize: '0.85rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: pendingWithdrawalCount > 0 ? '0 0 15px rgba(46, 204, 113, 0.3)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <CreditCard size={16} /> 💸 Para Çekim Talepleri
                {pendingWithdrawalCount > 0 && (
                  <span style={{
                    background: '#e74c3c', color: '#fff', fontSize: '0.72rem',
                    padding: '2px 7px', borderRadius: '10px', fontWeight: '900',
                    boxShadow: '0 2px 6px rgba(231, 76, 60, 0.6)'
                  }}>
                    {pendingWithdrawalCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setShowPaymentModal(true); fetchPaymentOrders(); }}
                style={{
                  padding: '10px 16px', borderRadius: '12px',
                  background: pendingPaymentCount > 0 
                    ? 'linear-gradient(135deg, rgba(255, 170, 0, 0.25), rgba(254, 218, 0, 0.2))' 
                    : 'rgba(255, 170, 0, 0.15)',
                  border: pendingPaymentCount > 0 ? '1.5px solid #ffaa00' : '1px solid rgba(255, 170, 0, 0.4)',
                  color: '#ffaa00', fontWeight: '800', fontSize: '0.85rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: pendingPaymentCount > 0 ? '0 0 15px rgba(255, 170, 0, 0.3)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                🪙 Altın Ödemeleri
                {pendingPaymentCount > 0 && (
                  <span style={{
                    background: '#e74c3c', color: '#fff', fontSize: '0.72rem',
                    padding: '2px 7px', borderRadius: '10px', fontWeight: '900',
                    boxShadow: '0 2px 6px rgba(231, 76, 60, 0.6)'
                  }}>
                    {pendingPaymentCount}
                  </span>
                )}
              </button>

              

              <button
                onClick={() => setShowAuditModal(true)}
                style={{
                  padding: '10px 16px', borderRadius: '12px',
                  background: 'rgba(0, 242, 254, 0.15)', border: '1px solid #00f2fe',
                  color: '#00f2fe', fontWeight: '800', fontSize: '0.85rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 0 15px rgba(0, 242, 254, 0.2)'
                }}
              >
                <FileText size={16} /> 📊 Altın & Aktivite Raporu
              </button>

              <button
                onClick={() => { setShowQuotaModal(true); handleFetchQuotaMetrics(); }}
                style={{
                  padding: '10px 16px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(155, 89, 182, 0.25), rgba(0, 242, 254, 0.25))',
                  border: '1.5px solid #9b59b6',
                  color: '#e056fd', fontWeight: '800', fontSize: '0.85rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 0 15px rgba(155, 89, 182, 0.3)'
                }}
              >
                <Zap size={16} color="#e056fd" /> ⚡ Altyapı & Kota Takibi
              </button>

              <button
                onClick={() => { setShowUsersModal(true); fetchAllUsers(); }}
                style={{
                  padding: '10px 16px', borderRadius: '12px',
                  background: 'rgba(0, 242, 254, 0.18)', border: '1px solid #00f2fe',
                  color: '#00f2fe', fontWeight: '700', fontSize: '0.85rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Users size={16} /> 👥 Kayıtlı Kullanıcılar
              </button>

              <button
                onClick={() => { setShowModModal(true); fetchModerators(); }}
                style={{
                  padding: '10px 16px', borderRadius: '12px',
                  background: 'rgba(243, 156, 18, 0.2)', border: '1px solid #f39c12',
                  color: '#f39c12', fontWeight: '700', fontSize: '0.85rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <ShieldCheck size={16} /> Moderatör Tanımla
              </button>
            </>
          )}
        </div>
      </div>

      {/* SADECE SİSTEM YÖNETİCİSİ (ÖMER) İÇİN ÖZEL GERÇEK ANALİZ VE ÇEVRİMİÇİ KARTI */}
      <LiveRealAnalyticsBanner isAdmin={isAdmin} />

      {/* AKSİYON BİLDİRİMİ */}
      {actionMessage && (
        <div style={{
          maxWidth: '1200px', margin: '0 auto 16px auto',
          padding: '14px 20px', borderRadius: '14px',
          background: 'rgba(46, 204, 113, 0.2)', border: '1px solid #2ecc71',
          color: '#2ecc71', fontWeight: '700', fontSize: '0.9rem'
        }}>
          {actionMessage}
        </div>
      )}

      {/* FİLTRELEME BUTONLARI */}
      <div style={{ maxWidth: '1200px', margin: '0 auto 20px auto', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'pending', label: 'Bekleyenler', count: reports.filter(r => r.status === 'pending').length },
            { key: 'banned', label: 'Yasaklananlar (Ban)', count: reports.filter(r => r.status === 'banned').length },
            { key: 'dismissed', label: 'Asılsız / Masum', count: reports.filter(r => r.status === 'dismissed').length },
            { key: 'resolved', label: 'Kapatılanlar', count: reports.filter(r => r.status === 'resolved').length },
            { key: 'all', label: 'Tümü', count: reports.length }
          ].map((btn) => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key as any)}
              style={{
                padding: '8px 18px', borderRadius: '16px',
                border: filter === btn.key ? '2px solid #00f2fe' : '1px solid rgba(255,255,255,0.1)',
                background: filter === btn.key ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255,255,255,0.04)',
                color: filter === btn.key ? '#00f2fe' : 'rgba(255,255,255,0.7)',
                fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer'
              }}
            >
              {btn.label} ({btn.count})
            </button>
          ))}
        </div>

        {isAdmin && reports.length > 0 && (
          <button
            onClick={handleClearAllReports}
            title="Tüm şikayet kayıtlarını kalıcı olarak temizle"
            style={{
              padding: '8px 14px', borderRadius: '14px',
              background: 'rgba(255, 45, 85, 0.15)', border: '1px solid rgba(255, 45, 85, 0.4)',
              color: '#ff2d55', fontWeight: '700', fontSize: '0.82rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Trash2 size={14} /> Tüm Kayıtları Temizle
          </button>
        )}
      </div>

      {/* ŞİKAYET LİSTESİ */}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.5)' }}>
            Şikayetler yükleniyor...
          </div>
        ) : filteredReports.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            background: 'rgba(255,255,255,0.02)', borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <CheckCircle size={48} color="#2ecc71" style={{ marginBottom: '14px', opacity: 0.8 }} />
            <h3 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>Bu filtrede şikayet bulunmuyor</h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
              Harika! Şu an çözülmeyi bekleyen herhangi bir şikayet yok.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredReports.map((report) => (
              <div
                key={report.id}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: report.status === 'pending' ? '1px solid rgba(255, 45, 85, 0.4)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '18px',
                  padding: '18px 22px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '18px',
                  boxShadow: report.status === 'pending' ? '0 4px 20px rgba(255,45,85,0.1)' : 'none'
                }}
              >
                {/* Sol: Bilgiler */}
                <div style={{ flex: '1 1 280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '10px',
                      background: 'rgba(255, 45, 85, 0.2)', color: '#ff2d55',
                      fontWeight: '800', fontSize: '0.75rem', border: '1px solid rgba(255,45,85,0.4)'
                    }}>
                      {report.category || '⚠️ Genel Şikayet'}
                    </span>

                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                      {new Date(report.created_at).toLocaleString('tr-TR')}
                    </span>

                    {report.status === 'banned' && (
                      <span style={{ fontSize: '0.75rem', color: '#ff2d55', fontWeight: '700' }}>
                        ● YASAKLANDI
                      </span>
                    )}

                    {report.status === 'dismissed' && (
                      <span style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: '700' }}>
                        ● ASILSIZ / TEMİZ
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '6px' }}>
                    🎯 Şikayet Edilen: <span style={{ color: '#00f2fe' }}>{report.reported_name || 'Kullanıcı'}</span>
                    {isAdmin && (
                      <button
                        onClick={() => handleOpenAuditForUser(report.reported_name || report.reported_user_id)}
                        title="Bu kullanıcının altın ve harcama ekstresini incele"
                        style={{
                          marginLeft: '10px', padding: '3px 8px', borderRadius: '8px',
                          background: 'rgba(0, 242, 254, 0.15)', border: '1px solid rgba(0, 242, 254, 0.4)',
                          color: '#00f2fe', fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer'
                        }}
                      >
                        📊 Ekstre
                      </button>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginLeft: '8px' }}>
                      (ID: {report.reported_user_id.slice(0, 8)})
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                    👤 Şikayet Eden: {report.reporter_name || 'Anonim'} (ID: {report.reporter_id.slice(0, 8)})
                  </div>

                  {report.reason && (
                    <div style={{
                      padding: '10px 14px', borderRadius: '12px',
                      background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)',
                      fontSize: '0.85rem', color: '#ffc107', fontStyle: 'italic'
                    }}>
                      💬 Açıklama: "{report.reason}"
                    </div>
                  )}
                </div>

                {/* Orta: Kanıt Görseli (Snapshot) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  {report.snapshot_data ? (
                    <div 
                      onClick={() => setPreviewImage(report.snapshot_data!)}
                      style={{
                        cursor: 'pointer',
                        position: 'relative',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        border: '2px solid rgba(255, 45, 85, 0.5)',
                        width: '104px',
                        height: '84px',
                        background: '#000',
                        boxShadow: '0 4px 15px rgba(255,45,85,0.25)',
                        transition: 'transform 0.2s'
                      }}
                      title="Şikayet anındaki görüntüyü büyütmek için tıkla"
                    >
                      <img 
                        src={report.snapshot_data} 
                        alt="Kanıt Karesi" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'rgba(0,0,0,0.75)', color: '#ff2d55',
                        fontSize: '0.65rem', fontWeight: '800', textAlign: 'center',
                        padding: '2px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px'
                      }}>
                        <Eye size={11} /> İNCELE
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      width: '104px', height: '84px', borderRadius: '14px',
                      background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', textAlign: 'center', padding: '6px'
                    }}>
                      <Camera size={18} style={{ opacity: 0.5, marginBottom: '4px' }} />
                      <span>Görsel Kanıt Yok</span>
                    </div>
                  )}
                </div>

                {/* Sağ: Aksiyon Butonları */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {report.status !== 'banned' && (
                    <button
                      onClick={() => handleBanUser(report)}
                      style={{
                        padding: '10px 16px', borderRadius: '14px',
                        background: '#ff2d55', border: 'none',
                        color: '#fff', fontWeight: '800', fontSize: '0.85rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      <UserX size={16} /> Yasakla (Ban)
                    </button>
                  )}

                  {report.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleDismissReport(report.id)}
                        style={{
                          padding: '10px 14px', borderRadius: '14px',
                          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                          color: '#ddd', fontWeight: '700', fontSize: '0.85rem',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                        title="Kanıtta ihlal yoksa şikayeti asılsız olarak kapat"
                      >
                        <ThumbsDown size={15} /> Asılsız
                      </button>

                      <button
                        onClick={() => handleResolveReport(report.id)}
                        style={{
                          padding: '10px 16px', borderRadius: '14px',
                          background: 'rgba(46, 204, 113, 0.2)', border: '1px solid #2ecc71',
                          color: '#2ecc71', fontWeight: '700', fontSize: '0.85rem',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        <CheckCircle size={16} /> Çözüldü
                      </button>
                    </>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteReport(report.id)}
                      style={{
                        padding: '10px 12px', borderRadius: '14px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.6)', cursor: 'pointer'
                      }}
                      title="Kaydı Sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODERATÖR YÖNETİMİ & TANIMLAMA MODALI (SADECE ADMİN) */}
      {isAdmin && showModModal && (
        <div
          onClick={() => setShowModModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #181c2f 0%, #0d0f1b 100%)',
              borderRadius: '24px', border: '1px solid rgba(243, 156, 18, 0.4)',
              width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
              padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={26} color="#f39c12" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#fff' }}>
                  Moderatör Tanımlama & Yönetimi
                </h2>
              </div>
              <button
                onClick={() => setShowModModal(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5', marginBottom: '20px' }}>
              Burada yetki verdiğiniz kullanıcıların profillerinde otomatik olarak <b>Moderatör & Yönetim Paneli</b> menüsü açılır. Yetkisi olmayan normal kullanıcılar bu menüyü asla göremez.
            </p>

            {/* Yetki & Özel Şifre Tanımlama Formu */}
            <form onSubmit={handleAssignModerator} style={{ marginBottom: '20px', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(243, 156, 18, 0.2)' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '10px', color: '#f39c12' }}>
                Yeni Moderatör & Özel Şifre Tanımla:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Moderatör Kullanıcı Adı (Örn: elfi, apoo)"
                  value={modUsernameInput}
                  onChange={(e) => setModUsernameInput(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                    background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff', fontSize: '0.9rem', outline: 'none'
                  }}
                />
                <input
                  type="text"
                  placeholder="Moderatöre Verilecek Şifre (Örn: Elfi2026!)"
                  value={modPasswordInput}
                  onChange={(e) => setModPasswordInput(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                    background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff', fontSize: '0.9rem', outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    width: '100%', padding: '12px 20px', borderRadius: '12px',
                    background: 'linear-gradient(135deg, #f39c12 0%, #d35400 100%)',
                    border: 'none', color: '#fff', fontWeight: '800', fontSize: '0.9rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  <UserCheck size={18} /> Moderatör Şifresini Oluştur & Yetkilendir
                </button>
              </div>
            </form>

            {modSuccessMsg && (
              <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(46, 204, 113, 0.2)', border: '1px solid #2ecc71', color: '#2ecc71', fontSize: '0.85rem', fontWeight: '700', marginBottom: '16px' }}>
                {modSuccessMsg}
              </div>
            )}

            {modErrorMsg && (
              <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(255, 45, 85, 0.2)', border: '1px solid #ff2d55', color: '#ff2d55', fontSize: '0.85rem', fontWeight: '700', marginBottom: '16px' }}>
                {modErrorMsg}
              </div>
            )}

            {/* Mevcut Moderatörler Listesi */}
            <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="#f39c12" /> Mevcut Moderatörler ({moderatorsList.length})
            </h3>

            {loadingMods ? (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Yükleniyor...</p>
            ) : moderatorsList.length === 0 ? (
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textAlign: 'center' }}>
                Henüz kayıtlı başka moderatör bulunmuyor. Yukarıdaki formdan istediğiniz kullanıcı adına özel şifre ile moderatörlük tanımlayabilirsiniz.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                {moderatorsList.map((m: any) => {
                  const isOwner = (m.display_name || '').toLowerCase() === 'omer' || m.id === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b';
                  return (
                    <div
                      key={m.id || m.display_name}
                      style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        padding: '12px 14px', borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '800', fontSize: '0.9rem', color: '#fff' }}>
                            👤 {m.display_name || 'İsimsiz'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: isOwner ? '#f39c12' : '#00f2fe', background: isOwner ? 'rgba(243, 156, 18, 0.15)' : 'rgba(0, 242, 254, 0.15)', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                            {isOwner ? '👑 Admin' : '🛡️ Moderatör'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#00f2fe', marginTop: '4px', fontWeight: '600' }}>
                          🔑 Şifre: <code>{m.assignedPassword || 'Atanmış'}</code>
                        </div>
                      </div>
                      {isOmer && !isOwner && (
                        <button
                          onClick={() => handleRevokeModerator(m.id, m.display_name)}
                          style={{
                            background: 'rgba(255, 45, 85, 0.15)', border: '1px solid rgba(255, 45, 85, 0.3)',
                            color: '#ff2d55', padding: '6px 12px', borderRadius: '8px',
                            fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer'
                          }}
                        >
                          Yetkiyi Kaldır
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowModModal(false)}
                style={{
                  padding: '10px 20px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  color: '#fff', cursor: 'pointer', fontWeight: '700'
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KANIT FOTOĞRAFI TAM EKRAN İNCELEME MODALI */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000, padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '92%', maxHeight: '88vh', width: '560px',
              background: '#121422', borderRadius: '24px',
              overflow: 'hidden', border: '1.5px solid rgba(255,45,85,0.5)',
              boxShadow: '0 30px 70px rgba(0,0,0,0.9)',
              display: 'flex', flexDirection: 'column'
            }}
          >
            <div style={{
              padding: '16px 22px', background: 'rgba(255,255,255,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.1rem' }}>📸</span>
                <span style={{ fontWeight: '800', color: '#ff2d55', fontSize: '0.95rem' }}>
                  Şikayet Anı Kanıt Fotoğrafı
                </span>
              </div>
              <button 
                onClick={() => setPreviewImage(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  color: '#fff', cursor: 'pointer', borderRadius: '50%',
                  width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', background: '#05060d' }}>
              <img 
                src={previewImage} 
                alt="Kanıt İnceleme" 
                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '12px' }} 
              />
            </div>

            <div style={{
              padding: '14px 22px', background: 'rgba(255,255,255,0.02)',
              fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', textAlign: 'center',
              borderTop: '1px solid rgba(255,255,255,0.06)'
            }}>
              🔍 Bu görüntü, kullanıcı "Şikayet Et" butonuna bastığı salisede karşı tarafın kamerasından otomatik yakalanmıştır.
            </div>
          </div>
        </div>
      )}

 
      {/* ======================================================== */}
      {/* KULLANICI HESAP EKSTRESİ & ALTIN DENETİM RAPORU MODALI (SADECE ADMİN) */}
      {/* ======================================================== */}
      {isAdmin && showAuditModal && (
        <div 
          onClick={() => setShowAuditModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #13172b 0%, #0a0b16 100%)',
              borderRadius: '24px', border: '1px solid rgba(0, 242, 254, 0.35)',
              width: '100%', maxWidth: '960px', maxHeight: '92vh', overflowY: 'auto',
              padding: '28px', boxShadow: '0 25px 70px rgba(0,0,0,0.85)',
              color: '#fff'
            }}
          >
            {/* Modal Başlığı */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: 'rgba(0, 242, 254, 0.15)', border: '1px solid #00f2fe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <FileText size={24} color="#00f2fe" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0, color: '#fff' }}>
                    Kullanıcı Hesap Ekstresi & Altın Denetim Raporu
                  </h2>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                    Kullanıcı itirazları için altın yükleme, harcama, özel arama ve hediye logları
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {auditUser && (
                  <button
                    onClick={() => window.print()}
                    style={{
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff', padding: '8px 14px', borderRadius: '10px',
                      fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Printer size={15} /> Yazdır
                  </button>
                )}
                <button
                  onClick={() => setShowAuditModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                    width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Arama ve Filtreleme Bölümü */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '18px', padding: '18px', marginBottom: '22px'
            }}>
              <form onSubmit={(e) => { e.preventDefault(); handleFetchAuditReport(); }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                  {/* Kullanıcı Adı / UUID Input */}
                  <div style={{ flex: '1 1 240px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#00f2fe', marginBottom: '6px' }}>
                      👤 Kullanıcı Adı veya UUID
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Örn: ahmet veya 7e34b8c1-..."
                        value={auditQuery}
                        onChange={(e) => setAuditQuery(e.target.value)}
                        style={{
                          width: '100%', padding: '10px 14px 10px 36px', borderRadius: '12px',
                          background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)',
                          color: '#fff', fontSize: '0.9rem', outline: 'none'
                        }}
                      />
                      <Search size={16} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                  </div>

                  {/* Başlangıç Tarihi */}
                  <div style={{ flex: '1 1 140px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'rgba(255,255,255,0.8)', marginBottom: '6px' }}>
                      📅 Başlangıç Tarihi
                    </label>
                    <input
                      type="date"
                      value={auditStartDate}
                      onChange={(e) => setAuditStartDate(e.target.value)}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '12px',
                        background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff', fontSize: '0.85rem', outline: 'none'
                      }}
                    />
                  </div>

                  {/* Bitiş Tarihi */}
                  <div style={{ flex: '1 1 140px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'rgba(255,255,255,0.8)', marginBottom: '6px' }}>
                      📅 Bitiş Tarihi
                    </label>
                    <input
                      type="date"
                      value={auditEndDate}
                      onChange={(e) => setAuditEndDate(e.target.value)}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '12px',
                        background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff', fontSize: '0.85rem', outline: 'none'
                      }}
                    />
                  </div>

                  {/* Sorgula Butonu */}
                  <button
                    type="submit"
                    disabled={auditLoading}
                    style={{
                      padding: '10px 22px', borderRadius: '12px',
                      background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                      border: 'none', color: '#000', fontWeight: '800', fontSize: '0.9rem',
                      cursor: auditLoading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '8px', height: '42px'
                    }}
                  >
                    {auditLoading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                    {auditLoading ? 'Sorgulanıyor...' : 'Raporu Getir'}
                  </button>
                </div>

                {/* Hızlı Tarih Seçim Butonları */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginRight: '4px' }}>
                    Hızlı Filtre:
                  </span>
                  {[
                    { key: 'today', label: 'Bugün' },
                    { key: 'week', label: 'Son 7 Gün' },
                    { key: 'month', label: 'Son 30 Gün' },
                    { key: 'all', label: 'Tüm Zamanlar' }
                  ].map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleAuditDatePreset(p.key as any)}
                      style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                        color: 'rgba(255,255,255,0.8)', padding: '4px 10px', borderRadius: '8px',
                        fontSize: '0.72rem', cursor: 'pointer'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </form>
            </div>

            {/* HATA MESAJI */}
            {auditError && (
              <div style={{
                padding: '14px 18px', borderRadius: '14px',
                background: 'rgba(255, 45, 85, 0.15)', border: '1px solid #ff2d55',
                color: '#ff2d55', fontSize: '0.88rem', fontWeight: '700', marginBottom: '20px'
              }}>
                ⚠️ {auditError}
              </div>
            )}

            {/* KULLANICI BULUNDUYSA DETAYLAR */}
            {auditUser && (
              <div>
                {/* Kullanıcı Başlık & Bakiye Kartı */}
                <div style={{
                  background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.25)',
                  borderRadius: '18px', padding: '18px 22px', marginBottom: '20px',
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      background: auditUser.gender === 'kadin' ? 'rgba(255, 45, 85, 0.2)' : 'rgba(0, 242, 254, 0.2)',
                      border: `2px solid ${auditUser.gender === 'kadin' ? '#ff2d55' : '#00f2fe'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem'
                    }}>
                      {auditUser.gender === 'kadin' ? '👩' : '👨'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>
                          {auditUser.display_name}
                        </h3>
                        <span style={{
                          padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700',
                          background: auditUser.gender === 'kadin' ? 'rgba(255,45,85,0.2)' : 'rgba(0,242,254,0.2)',
                          color: auditUser.gender === 'kadin' ? '#ff2d55' : '#00f2fe'
                        }}>
                          {auditUser.gender === 'kadin' ? 'Kadın' : 'Erkek'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                        UUID: {auditUser.id}
                      </span>
                    </div>
                  </div>

                  {/* Güncel Bakiye Kutuları */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{
                      background: 'rgba(255, 215, 0, 0.12)', border: '1px solid rgba(255, 215, 0, 0.35)',
                      borderRadius: '14px', padding: '10px 16px', textAlign: 'center'
                    }}>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', display: 'block' }}>Mevcut Altın</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#ffd700' }}>
                        🪙 {auditUser.total_gold || 0}
                      </span>
                    </div>

                    <div style={{
                      background: 'rgba(0, 242, 254, 0.12)', border: '1px solid rgba(0, 242, 254, 0.35)',
                      borderRadius: '14px', padding: '10px 16px', textAlign: 'center'
                    }}>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', display: 'block' }}>Mevcut Elmas</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#00f2fe' }}>
                        💎 {auditUser.total_diamonds || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dönem İstatistikleri Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ background: 'rgba(46, 204, 113, 0.1)', border: '1px solid rgba(46, 204, 113, 0.3)', borderRadius: '14px', padding: '14px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#2ecc71', fontWeight: '700', display: 'block' }}>🟢 Yüklenen / Kazanılan</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#2ecc71' }}>
                      +{auditItems.filter(i => i.amount > 0).reduce((s, i) => s + i.amount, 0)} 🪙
                    </span>
                  </div>

                  <div style={{ background: 'rgba(255, 45, 85, 0.1)', border: '1px solid rgba(255, 45, 85, 0.3)', borderRadius: '14px', padding: '14px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#ff2d55', fontWeight: '700', display: 'block' }}>🔴 Harcanan Toplam</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#ff2d55' }}>
                      -{auditItems.filter(i => i.amount < 0).reduce((s, i) => s + Math.abs(i.amount), 0)} 🪙
                    </span>
                  </div>

                  <div style={{ background: 'rgba(155, 89, 182, 0.1)', border: '1px solid rgba(155, 89, 182, 0.3)', borderRadius: '14px', padding: '14px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#9b59b6', fontWeight: '700', display: 'block' }}>📞 Özel Görüşmeler</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#fff' }}>
                      {auditItems.filter(i => i.type === 'call_cost').length} <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>adet</span>
                    </span>
                  </div>

                  <div style={{ background: 'rgba(243, 156, 18, 0.1)', border: '1px solid rgba(243, 156, 18, 0.3)', borderRadius: '14px', padding: '14px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#f39c12', fontWeight: '700', display: 'block' }}>🎁 Gönderilen Hediyeler</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#fff' }}>
                      {auditItems.filter(i => i.type === 'gift_sent').length} <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>adet</span>
                    </span>
                  </div>
                </div>

                {/* Kullanıcıya İtiraz Yanıtı Gönderme / Kopyalama Çubuğu */}
                <div style={{
                  background: 'rgba(0, 242, 254, 0.08)', border: '1px solid #00f2fe',
                  borderRadius: '16px', padding: '16px 20px', marginBottom: '22px',
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px'
                }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#00f2fe' }}>
                      📋 Müşteri İtiraz Yanıt Metni
                    </h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>
                      Kullanıcıya "Altınım kayboldu / çalındı" dediğinde gönderebileceğiniz şeffaf hesap döküm mesajı
                    </p>
                  </div>

                  <button
                    onClick={handleCopyAuditStatement}
                    style={{
                      padding: '11px 20px', borderRadius: '12px',
                      background: copySuccess ? 'rgba(46, 204, 113, 0.3)' : 'linear-gradient(135deg, #00f2fe, #4facfe)',
                      border: copySuccess ? '1.5px solid #2ecc71' : 'none',
                      color: copySuccess ? '#2ecc71' : '#000',
                      fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                    }}
                  >
                    {copySuccess ? <Check size={18} /> : <Copy size={18} />}
                    {copySuccess ? 'Metin Kopyalandı! ✅' : 'İtiraz Yanıtını Kopyala'}
                  </button>
                </div>

                {/* AYRINTILI İŞLEM HAREKETLERİ TABLOSU */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={18} color="#00f2fe" />
                      Hesap Hareketleri & Kullanım Tablosu ({auditItems.length} Kayıt)
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                      En yeni işlemler başta
                    </span>
                  </div>

                  {auditItems.length === 0 ? (
                    <div style={{
                      textAlign: 'center', padding: '36px', borderRadius: '16px',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem'
                    }}>
                      Seçilen tarih aralığında bu kullanıcıya ait harcama veya altın kaydı bulunamadı.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                            <th style={{ padding: '12px 16px', fontWeight: '700' }}>Tarih & Saat</th>
                            <th style={{ padding: '12px 16px', fontWeight: '700' }}>İşlem Türü</th>
                            <th style={{ padding: '12px 16px', fontWeight: '700' }}>Muhatap / Hedef</th>
                            <th style={{ padding: '12px 16px', fontWeight: '700' }}>Açıklama / Süre</th>
                            <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Miktar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditItems.map((item, idx) => {
                            const isPositive = item.amount > 0;
                            return (
                              <tr
                                key={item.id || idx}
                                style={{
                                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                                  background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'
                                }}
                              >
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.7)' }}>
                                  {new Date(item.createdAtStr).toLocaleString('tr-TR')}
                                </td>
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                  <span style={{
                                    padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700',
                                    background: isPositive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255, 45, 85, 0.15)',
                                    color: isPositive ? '#2ecc71' : '#ff2d55',
                                    border: isPositive ? '1px solid rgba(46, 204, 113, 0.3)' : '1px solid rgba(255, 45, 85, 0.3)'
                                  }}>
                                    {item.icon} {item.label}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', fontWeight: '600', color: '#00f2fe' }}>
                                  {item.partnerName}
                                </td>
                                <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.85)' }}>
                                  {item.details}
                                </td>
                                <td style={{
                                  padding: '12px 16px', textAlign: 'right', fontWeight: '800',
                                  fontSize: '0.95rem',
                                  color: isPositive ? '#2ecc71' : '#ff2d55',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {isPositive ? `+${item.amount}` : item.amount} {item.type.includes('earning') || item.type === 'gift_received' ? '💎' : '🪙'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Alt Butonları */}
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                style={{
                  padding: '10px 22px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  color: '#fff', cursor: 'pointer', fontWeight: '700'
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ======================================================== */}
      {/* ALTYAPI & KOTA TAKİP MERKEZİ (SADECE ADMİN İÇİN)        */}
      {/* ======================================================== */}
      {isAdmin && showQuotaModal && (
        <div 
          onClick={() => setShowQuotaModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #151228 0%, #0a0b16 100%)',
              borderRadius: '24px', border: '1.5px solid rgba(155, 89, 182, 0.45)',
              width: '100%', maxWidth: '980px', maxHeight: '92vh', overflowY: 'auto',
              padding: '28px', boxShadow: '0 25px 70px rgba(0,0,0,0.9)',
              color: '#fff'
            }}
          >
            {/* Başlık ve Üst Çubuk */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '46px', height: '46px', borderRadius: '14px',
                  background: 'rgba(155, 89, 182, 0.25)', border: '1.5px solid #9b59b6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Server size={24} color="#e056fd" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0, color: '#fff' }}>
                      Altyapı & Kota Takip Merkezi
                    </h2>
                    <span style={{
                      padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800',
                      background: 'rgba(224, 86, 253, 0.2)', color: '#e056fd', border: '1px solid #e056fd'
                    }}>
                      🔒 Sadece Ömer (Admin)
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                    Supabase Veritabanı, Agora Ses/Video Kotaları ve Vercel Dağıtım Durumları
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  onClick={handleFetchQuotaMetrics}
                  disabled={quotaLoading}
                  style={{
                    padding: '8px 16px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                    border: 'none', color: '#000', fontWeight: '800', fontSize: '0.82rem',
                    cursor: quotaLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <RefreshCw size={14} className={quotaLoading ? 'animate-spin' : ''} />
                  {quotaLoading ? 'Sorgulanıyor...' : 'Canlı Sorgula'}
                </button>

                <button
                  onClick={() => setShowQuotaModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                    width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {quotaMetrics && (
              <div>
                {/* 3 BÜYÜK ALTYAPI KARTI (AGORA, SUPABASE, VERCEL) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px', marginBottom: '22px' }}>
                  
                  {/* 1. AGORA RTC KARTI */}
                  <div style={{
                    background: 'rgba(0, 242, 254, 0.04)', border: '1.5px solid rgba(0, 242, 254, 0.35)',
                    borderRadius: '20px', padding: '20px', position: 'relative', overflow: 'hidden'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.6rem' }}>📞</span>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#00f2fe' }}>
                            Agora RTC (Ses & Video)
                          </h3>
                          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                            10,000 Ücretsiz Dakika / Ay
                          </span>
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '700',
                        background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', border: '1px solid #2ecc71'
                      }}>
                        🟢 Aktif
                      </span>
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>Kalan Ücretsiz Hak:</span>
                        <span style={{ fontSize: '1.35rem', fontWeight: '900', color: '#2ecc71' }}>
                          {quotaMetrics.agora.remainingMinutes.toLocaleString('tr-TR')} dk
                        </span>
                      </div>

                      {/* Çok Renkli İlerleme Çubuğu (Agora Konsolundaki Gibi: Sarı Audio + Mavi Video) */}
                      <div style={{ height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden', display: 'flex' }}>
                        <div 
                          title={`Sesli (Audio): ${quotaMetrics.agora.audioMinutes} dk`}
                          style={{
                            height: '100%',
                            width: `${Math.max(0.5, (quotaMetrics.agora.audioMinutes / 10000) * 100)}%`,
                            background: '#f5a623',
                            transition: 'width 0.5s ease'
                          }}
                        />
                        <div 
                          title={`Görüntülü (Video HD): ${quotaMetrics.agora.videoMinutes} dk`}
                          style={{
                            height: '100%',
                            width: `${Math.max(0.5, (quotaMetrics.agora.videoMinutes / 10000) * 100)}%`,
                            background: '#00f2fe',
                            transition: 'width 0.5s ease'
                          }}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '5px' }}>
                        <span>Toplam Harcanan: {quotaMetrics.agora.totalMinutesMonth} dk (%{quotaMetrics.agora.percentUsed})</span>
                        <span>Kota: 10,000 dk</span>
                      </div>
                    </div>

                    {/* Agora Console Kırılım Kutucukları (Sarı: Audio, Mavi: Video HD) */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px'
                    }}>
                      <div style={{
                        background: 'rgba(245, 166, 35, 0.08)', border: '1px solid rgba(245, 166, 35, 0.25)',
                        borderRadius: '12px', padding: '8px 10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f5a623' }}></span>
                          <span style={{ fontSize: '0.72rem', color: '#f5a623', fontWeight: '700' }}>🎤 Sesli (Audio)</span>
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#fff' }}>
                          {quotaMetrics.agora.audioMinutes} <span style={{ fontSize: '0.72rem', fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>dk</span>
                        </div>
                      </div>

                      <div style={{
                        background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.25)',
                        borderRadius: '12px', padding: '8px 10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00f2fe' }}></span>
                          <span style={{ fontSize: '0.72rem', color: '#00f2fe', fontWeight: '700' }}>📹 Video (HD)</span>
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#fff' }}>
                          {quotaMetrics.agora.videoMinutes} <span style={{ fontSize: '0.72rem', fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>dk</span>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '10px 14px',
                      fontSize: '0.78rem', border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Bu Ayki Toplam Arama:</span>
                        <span style={{ fontWeight: '700', color: '#fff' }}>{quotaMetrics.agora.totalCallsMonth} adet</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Agora Konsol Eşitleme:</span>
                        <button
                          onClick={() => setShowAgoraEdit(!showAgoraEdit)}
                          style={{
                            background: 'none', border: 'none', color: '#00f2fe',
                            fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline'
                          }}
                        >
                          {showAgoraEdit ? 'Vazgeç' : 'Manuel Güncelle'}
                        </button>
                      </div>

                      {showAgoraEdit && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                            <input 
                              type="number" 
                              placeholder="Ses dk"
                              value={agoraAudioInput}
                              onChange={(e) => setAgoraAudioInput(e.target.value)}
                              style={{ width: '50%', padding: '4px 8px', borderRadius: '6px', background: '#111', border: '1px solid #444', color: '#fff', fontSize: '0.75rem' }}
                            />
                            <input 
                              type="number" 
                              placeholder="Video dk"
                              value={agoraVideoInput}
                              onChange={(e) => setAgoraVideoInput(e.target.value)}
                              style={{ width: '50%', padding: '4px 8px', borderRadius: '6px', background: '#111', border: '1px solid #444', color: '#fff', fontSize: '0.75rem' }}
                            />
                          </div>
                          <button
                            onClick={() => {
                              localStorage.setItem('pyngoo_agora_audio_mins', agoraAudioInput);
                              localStorage.setItem('pyngoo_agora_video_mins', agoraVideoInput);
                              setShowAgoraEdit(false);
                              handleFetchQuotaMetrics();
                            }}
                            style={{
                              width: '100%', padding: '5px', borderRadius: '6px',
                              background: '#2ecc71', border: 'none', color: '#000',
                              fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer'
                            }}
                          >
                            Kaydet ve Senkronize Et
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. SUPABASE KARTI */}
                  <div style={{
                    background: 'rgba(46, 204, 113, 0.04)', border: '1.5px solid rgba(46, 204, 113, 0.35)',
                    borderRadius: '20px', padding: '20px', position: 'relative', overflow: 'hidden'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.6rem' }}>⚡</span>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#2ecc71' }}>
                            Supabase Veritabanı
                          </h3>
                          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                            50,000 Kullanıcı / 500 MB DB
                          </span>
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '700',
                        background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', border: '1px solid #2ecc71'
                      }}>
                        🟢 {quotaMetrics.supabase.pingMs} ms
                      </span>
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>Kayıtlı Kullanıcı:</span>
                        <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#2ecc71' }}>
                          {quotaMetrics.supabase.profiles.toLocaleString('tr-TR')} / 50K
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.max(1, quotaMetrics.supabase.mauPercent)}%`,
                          background: '#2ecc71',
                          borderRadius: '10px'
                        }}></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                        <span>Doluluk: %{quotaMetrics.supabase.mauPercent}</span>
                        <span>Tahmini Boyut: ~{quotaMetrics.supabase.dbSizeEstimateMb} MB / 500 MB</span>
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '10px 14px',
                      fontSize: '0.78rem', border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Toplam Mesajlar:</span>
                        <span style={{ fontWeight: '700', color: '#fff' }}>{quotaMetrics.supabase.messages} adet</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Görüşme Kayıtları:</span>
                        <span style={{ fontWeight: '700', color: '#fff' }}>{quotaMetrics.supabase.matches} adet</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Altın Hareketleri:</span>
                        <span style={{ fontWeight: '700', color: '#ffd700' }}>{quotaMetrics.supabase.transactions} adet</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. VERCEL KARTI */}
                  <div style={{
                    background: 'rgba(155, 89, 182, 0.04)', border: '1.5px solid rgba(155, 89, 182, 0.35)',
                    borderRadius: '20px', padding: '20px', position: 'relative', overflow: 'hidden'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.6rem' }}>▲</span>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#e056fd' }}>
                            Vercel Hosting & CDN
                          </h3>
                          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                            100 GB Bant / 100 Deploy Günlük
                          </span>
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '700',
                        background: 'rgba(155, 89, 182, 0.2)', color: '#e056fd', border: '1px solid #e056fd'
                      }}>
                        {quotaMetrics.vercel.hasCustomToken ? '⚡ API Bağlı' : 'Hobby Plan'}
                      </span>
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>Kalan Bant Genişliği:</span>
                        <span style={{ fontSize: '1.35rem', fontWeight: '900', color: '#2ecc71' }}>
                          {quotaMetrics.vercel.bandwidthRemainingGb} GB
                        </span>
                      </div>

                      {/* Bant Genişliği İlerleme Çubuğu */}
                      <div style={{ height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                        <div 
                          title={`Veri Aktarımı: ${quotaMetrics.vercel.bandwidthMb} MB`}
                          style={{
                            height: '100%',
                            width: `${Math.max(1, quotaMetrics.vercel.bandwidthPercent * 5)}%`,
                            background: '#e056fd',
                            borderRadius: '10px',
                            transition: 'width 0.5s ease'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '5px' }}>
                        <span>Aktarılan: {quotaMetrics.vercel.bandwidthMb} MB (%{quotaMetrics.vercel.bandwidthPercent})</span>
                        <span>Kota: 100 GB</span>
                      </div>
                    </div>

                    {/* Vercel Hızlı Veri Aktarımı Kırılım Kutucukları (Gelen vs Dışa Dönük) */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px'
                    }}>
                      <div style={{
                        background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.25)',
                        borderRadius: '12px', padding: '8px 10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00f2fe' }}></span>
                          <span style={{ fontSize: '0.72rem', color: '#00f2fe', fontWeight: '700' }}>📥 Gelen İstek</span>
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#fff' }}>
                          {quotaMetrics.vercel.inboundMb} <span style={{ fontSize: '0.72rem', fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>MB</span>
                        </div>
                      </div>

                      <div style={{
                        background: 'rgba(224, 86, 253, 0.08)', border: '1px solid rgba(224, 86, 253, 0.25)',
                        borderRadius: '12px', padding: '8px 10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e056fd' }}></span>
                          <span style={{ fontSize: '0.72rem', color: '#e056fd', fontWeight: '700' }}>📤 Dışa Dönük</span>
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#fff' }}>
                          {quotaMetrics.vercel.outboundMb} <span style={{ fontSize: '0.72rem', fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>MB</span>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '10px 14px',
                      fontSize: '0.78rem', border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Bugünkü Dağıtım (Deploy):</span>
                        <span style={{ fontWeight: '700', color: '#fff' }}>{quotaMetrics.vercel.deploymentsToday} / 100</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Son Deploy Durumu:</span>
                        <span style={{ fontWeight: '700', color: quotaMetrics.vercel.latestDeploy?.state === 'READY' ? '#2ecc71' : '#00f2fe' }}>
                          {quotaMetrics.vercel.latestDeploy?.state || 'CANLI / READY'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Vercel Konsol Eşitleme:</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setShowVercelEdit(!showVercelEdit)}
                            style={{
                              background: 'none', border: 'none', color: '#00f2fe',
                              fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline'
                            }}
                          >
                            {showVercelEdit ? 'Vazgeç' : 'Bant Güncelle'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowVercelInput(!showVercelInput)}
                            style={{
                              background: 'none', border: 'none', color: '#e056fd',
                              fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline'
                            }}
                          >
                            {showVercelInput ? 'Gizle' : 'Token'}
                          </button>
                        </div>
                      </div>

                      {showVercelEdit && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                            <input 
                              type="number" 
                              step="0.01"
                              placeholder="Kullanılan MB (örn: 513.83)"
                              value={vercelBandwidthMb}
                              onChange={(e) => setVercelBandwidthMb(e.target.value)}
                              style={{ flex: 1, padding: '4px 8px', borderRadius: '6px', background: '#111', border: '1px solid #444', color: '#fff', fontSize: '0.75rem' }}
                            />
                          </div>
                          <button
                            onClick={() => {
                              localStorage.setItem('pyngoo_vercel_bw_mb', vercelBandwidthMb);
                              setShowVercelEdit(false);
                              handleFetchQuotaMetrics();
                            }}
                            style={{
                              width: '100%', padding: '5px', borderRadius: '6px',
                              background: '#e056fd', border: 'none', color: '#fff',
                              fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer'
                            }}
                          >
                            Bant Verisini Güncelle
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* VERCEL TOKEN TANIMLAMA KUTUSU (İSTEĞE BAĞLI AÇILIR) */}
                {showVercelInput && (
                  <form onSubmit={handleSaveVercelToken} style={{
                    background: 'rgba(155, 89, 182, 0.1)', border: '1px solid rgba(155, 89, 182, 0.3)',
                    borderRadius: '16px', padding: '16px 20px', marginBottom: '20px'
                  }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#e056fd', marginBottom: '6px' }}>
                      🔑 Vercel Personal Access Token (Vercel Dashboard'dan alınan API Token)
                    </label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="password"
                        value={vercelTokenInput}
                        onChange={(e) => setVercelTokenInput(e.target.value)}
                        placeholder="Vercel token yapıştırın..."
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: '10px',
                          background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)',
                          color: '#fff', fontSize: '0.85rem', outline: 'none'
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          padding: '10px 18px', borderRadius: '10px',
                          background: 'linear-gradient(135deg, #e056fd, #9b59b6)',
                          border: 'none', color: '#fff', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer'
                        }}
                      >
                        Kaydet & Senkronize Et
                      </button>
                    </div>
                    {saveVercelSuccess && (
                      <span style={{ fontSize: '0.78rem', color: '#2ecc71', fontWeight: '700', display: 'block', marginTop: '6px' }}>
                        ✅ Vercel Token kaydedildi ve canlı veriler güncellendi!
                      </span>
                    )}
                  </form>
                )}

                {/* GÜVENLİK VE FATURA GARANTİ BİLDİRİMİ */}
                <div style={{
                  background: 'rgba(46, 204, 113, 0.08)', border: '1.5px solid rgba(46, 204, 113, 0.3)',
                  borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px'
                }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: 'rgba(46, 204, 113, 0.2)', border: '1px solid #2ecc71',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <CheckCircle2 size={22} color="#2ecc71" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '800', color: '#2ecc71' }}>
                      Kotalarınız Güvenli Bölgede (0₺ Maliyet)
                    </h4>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
                      Agora 10,000 dakikalık ücretsiz ses/video limitinizin yalnızca <b>%{quotaMetrics.agora.percentUsed}</b>'i kullanıldı. 
                      Supabase veritabanı kapasitenizin ve Vercel dağıtım kotalarınızın tamamı ücretsiz sınırlar içerisindedir. Herhangi bir aşım veya ek fatura riski yoktur.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                  <span>● Veriler Supabase sunucusundan anlık hesaplanmaktadır.</span>
                  <span>Son Kontrol: {quotaMetrics.lastChecked}</span>
                </div>
              </div>
            )}

            {/* Modal Alt Kapat Butonu */}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setShowQuotaModal(false)}
                style={{
                  padding: '10px 22px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  color: '#fff', cursor: 'pointer', fontWeight: '700'
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 💸 PARA ÇEKİM TALEPLERİ MODAL (SADECE ADMİN) */}
      {/* ========================================== */}
      {isAdmin && showWithdrawalModal && (
        <div 
          onClick={() => setShowWithdrawalModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(5, 7, 15, 0.88)', backdropFilter: 'blur(10px)',
            zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#131528',
              border: '1.5px solid rgba(46, 204, 113, 0.35)',
              borderRadius: '24px',
              width: '100%', maxWidth: '960px', maxHeight: '90vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 40px rgba(46, 204, 113, 0.15)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.3), rgba(0, 242, 254, 0.2))',
                  border: '1px solid #2ecc71',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem'
                }}>
                  💸
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Yayıncı Para Çekim Talepleri
                    {pendingWithdrawalCount > 0 && (
                      <span style={{ background: '#e74c3c', color: '#fff', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', fontWeight: '800' }}>
                        {pendingWithdrawalCount} Bekleyen
                      </span>
                    )}
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.80rem', color: 'rgba(255,255,255,0.6)' }}>
                    Bayan kullanıcıların elmas çekim taleplerini onaylayın, banka transferi sonrasında 'Yatırıldı' yapın.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={fetchWithdrawals}
                  disabled={loadingWithdrawals}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', padding: '7px 12px', borderRadius: '10px',
                    fontSize: '0.80rem', fontWeight: '700', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <RefreshCw size={14} className={loadingWithdrawals ? 'spin' : ''} />
                  Yenile
                </button>
                <button
                  onClick={() => setShowWithdrawalModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: 'none',
                    color: '#fff', width: '34px', height: '34px', borderRadius: '50%',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Özet İstatistik Kartları */}
              {(() => {
                const pendingList = withdrawals.filter(w => (w.status || 'pending') === 'pending');
                const approvedList = withdrawals.filter(w => w.status === 'approved');
                const completedList = withdrawals.filter(w => w.status === 'completed');
                const pendingSum = pendingList.reduce((sum, w) => sum + Number(w.amount_currency || 0), 0);
                const approvedSum = approvedList.reduce((sum, w) => sum + Number(w.amount_currency || 0), 0);
                const completedSum = completedList.reduce((sum, w) => sum + Number(w.amount_currency || 0), 0);

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div style={{ background: 'rgba(241, 196, 15, 0.08)', border: '1px solid rgba(241, 196, 15, 0.3)', borderRadius: '16px', padding: '14px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#f1c40f', fontWeight: '800', marginBottom: '4px' }}>🟡 BEKLEYEN TALEPLER</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fff' }}>{pendingSum.toFixed(2)} ₺</div>
                      <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{pendingList.length} talep onay bekliyor</div>
                    </div>

                    <div style={{ background: 'rgba(52, 152, 219, 0.08)', border: '1px solid rgba(52, 152, 219, 0.3)', borderRadius: '16px', padding: '14px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#3498db', fontWeight: '800', marginBottom: '4px' }}>🔵 YATIRIM AŞAMASINDA</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fff' }}>{approvedSum.toFixed(2)} ₺</div>
                      <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{approvedList.length} talep transfer bekliyor</div>
                    </div>

                    <div style={{ background: 'rgba(46, 204, 113, 0.08)', border: '1px solid rgba(46, 204, 113, 0.3)', borderRadius: '16px', padding: '14px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#2ecc71', fontWeight: '800', marginBottom: '4px' }}>🟢 TAMAMLANAN (YATIRILDI)</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fff' }}>{completedSum.toFixed(2)} ₺</div>
                      <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{completedList.length} talep ödendi</div>
                    </div>
                  </div>
                );
              })()}

              {/* Filtre ve Arama Barı */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { key: 'all', label: 'Tümü', count: withdrawals.length },
                    { key: 'pending', label: '🟡 Bekleyenler', count: withdrawals.filter(w => (w.status || 'pending') === 'pending').length },
                    { key: 'approved', label: '🔵 Yatırım Aşamasında', count: withdrawals.filter(w => w.status === 'approved').length },
                    { key: 'completed', label: '🟢 Yatırılanlar', count: withdrawals.filter(w => w.status === 'completed').length },
                    { key: 'rejected', label: '🔴 Reddedilenler', count: withdrawals.filter(w => w.status === 'rejected').length },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setWithdrawalFilter(f.key as any)}
                      style={{
                        padding: '7px 12px', borderRadius: '10px',
                        background: withdrawalFilter === f.key ? '#00f2fe' : 'rgba(255,255,255,0.06)',
                        border: withdrawalFilter === f.key ? 'none' : '1px solid rgba(255,255,255,0.12)',
                        color: withdrawalFilter === f.key ? '#000' : '#fff',
                        fontWeight: '800', fontSize: '0.76rem', cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative', minWidth: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'rgba(255,255,255,0.4)' }} />
                  <input
                    type="text"
                    value={withdrawalSearch}
                    onChange={(e) => setWithdrawalSearch(e.target.value)}
                    placeholder="İsim veya IBAN ile ara..."
                    style={{
                      width: '100%', padding: '7px 10px 7px 30px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff', fontSize: '0.80rem', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Talepler Listesi */}
              {(() => {
                const filtered = withdrawals.filter(w => {
                  const status = w.status || 'pending';
                  if (withdrawalFilter !== 'all' && status !== withdrawalFilter) return false;
                  if (withdrawalSearch.trim()) {
                    const q = withdrawalSearch.toLowerCase().trim();
                    const matchName = (w.full_name || '').toLowerCase().includes(q);
                    const matchIban = (w.iban || '').toLowerCase().includes(q);
                    const matchProf = (w.profile_name || '').toLowerCase().includes(q);
                    if (!matchName && !matchIban && !matchProf) return false;
                  }
                  return true;
                });

                if (loadingWithdrawals) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#00f2fe' }}>
                      <RefreshCw size={28} className="spin" />
                      <p style={{ marginTop: '10px', fontSize: '0.85rem' }}>Çekim talepleri yükleniyor...</p>
                    </div>
                  );
                }

                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                      <CreditCard size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                      <p style={{ margin: 0, fontSize: '0.88rem' }}>Bu filtrelere uygun çekim talebi bulunamadı.</p>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filtered.map(item => {
                      const status = item.status || 'pending';
                      const isPending = status === 'pending';
                      const isApproved = status === 'approved';
                      const isCompleted = status === 'completed';
                      const isRejected = status === 'rejected';

                      const dateStr = new Date(item.created_at).toLocaleDateString('tr-TR');
                      const timeStr = new Date(item.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

                      const borderAccent = isPending ? '#f1c40f' : isApproved ? '#3498db' : isCompleted ? '#2ecc71' : '#e74c3c';

                      return (
                        <div
                          key={item.id}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderLeft: `4px solid ${borderAccent}`,
                            borderRadius: '16px',
                            padding: '16px 18px',
                            display: 'flex', flexDirection: 'column', gap: '12px'
                          }}
                        >
                          {/* Üst Satır: Kullanıcı & Durum Rozeti */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '38px', height: '38px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #ff416c, #ff4b2b)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontWeight: 'bold', fontSize: '1rem'
                              }}>
                                {(item.full_name || 'K').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ color: '#fff', fontWeight: '800', fontSize: '0.98rem' }}>
                                  {item.full_name}
                                  {item.profile_name && item.profile_name !== item.full_name && (
                                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginLeft: '6px' }}>
                                      (@{item.profile_name})
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                                  📅 {dateStr} • {timeStr}
                                </div>
                              </div>
                            </div>

                            {/* Durum Rozeti */}
                            <div style={{
                              padding: '4px 12px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '800',
                              background: isPending ? 'rgba(241, 196, 15, 0.15)' : isApproved ? 'rgba(52, 152, 219, 0.15)' : isCompleted ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                              color: borderAccent, border: `1px solid ${borderAccent}`
                            }}>
                              {isPending ? '🟡 İşleme Alındı' : isApproved ? '🔵 Onaylandı - Yatırım Aşamasında' : isCompleted ? '🟢 Yatırıldı (Tamamlandı)' : '🔴 Reddedildi'}
                            </div>
                          </div>

                          {/* Orta Satır: Tutar ve IBAN Bilgisi */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'rgba(0,0,0,0.22)', padding: '12px 14px', borderRadius: '12px' }}>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>ÖDENECEK TUTAR</div>
                              <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#2ecc71' }}>
                                {Number(item.amount_currency).toFixed(2)} ₺
                                <span style={{ fontSize: '0.84rem', color: '#00f2fe', marginLeft: '6px', fontWeight: '700' }}>
                                  ({item.amount_diamonds.toLocaleString()} 💎)
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>ALICI & IBAN</div>
                                <div style={{ fontSize: '0.88rem', color: '#fff', fontWeight: 'bold' }}>
                                  <code>{item.iban}</code>
                                </div>
                              </div>
                              <button
                                onClick={() => copyIban(item.iban, item.id)}
                                style={{
                                  background: copiedIbanId === item.id ? '#2ecc71' : 'rgba(255,255,255,0.1)',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  color: copiedIbanId === item.id ? '#000' : '#fff',
                                  padding: '7px 12px', borderRadius: '10px',
                                  fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  transition: 'all 0.2s'
                                }}
                              >
                                {copiedIbanId === item.id ? <Check size={14} /> : <Copy size={14} />}
                                {copiedIbanId === item.id ? 'Kopyalandı!' : 'IBAN Kopyala'}
                              </button>
                            </div>
                          </div>

                          {/* Alt Satır: Moderatör Aksiyon Butonları */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center', paddingTop: '4px' }}>
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleRejectWithdrawal(item)}
                                  style={{
                                    padding: '8px 16px', borderRadius: '10px',
                                    background: 'rgba(231, 76, 60, 0.15)', border: '1px solid #e74c3c',
                                    color: '#e74c3c', fontWeight: '800', fontSize: '0.80rem', cursor: 'pointer'
                                  }}
                                >
                                  ❌ Reddet & Elmas İade Et
                                </button>
                                <button
                                  onClick={() => handleApproveWithdrawal(item)}
                                  style={{
                                    padding: '8px 20px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #3498db, #2980b9)', border: 'none',
                                    color: '#fff', fontWeight: '900', fontSize: '0.82rem', cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(52, 152, 219, 0.35)'
                                  }}
                                >
                                  ✅ Onayla (Yatırım Aşamasına Al)
                                </button>
                              </>
                            )}

                            {isApproved && (
                              <>
                                <button
                                  onClick={() => handleRejectWithdrawal(item)}
                                  style={{
                                    padding: '8px 14px', borderRadius: '10px',
                                    background: 'rgba(231, 76, 60, 0.15)', border: '1px solid #e74c3c',
                                    color: '#e74c3c', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer'
                                  }}
                                >
                                  ❌ İptal Et & İade Et
                                </button>
                                <button
                                  onClick={() => handleCompleteWithdrawal(item)}
                                  style={{
                                    padding: '9px 24px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #2ecc71, #27ae60)', border: 'none',
                                    color: '#fff', fontWeight: '900', fontSize: '0.84rem', cursor: 'pointer',
                                    boxShadow: '0 4px 14px rgba(46, 204, 113, 0.45)'
                                  }}
                                >
                                  💰 Parayı Gönderdim (Yatırıldı Yap)
                                </button>
                              </>
                            )}

                            {isCompleted && (
                              <div style={{ color: '#2ecc71', fontWeight: '800', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CheckCircle2 size={16} /> Ödeme Başarıyla Hesaba Aktarıldı
                              </div>
                            )}

                            {isRejected && (
                              <div style={{ color: '#e74c3c', fontWeight: '700', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <XCircle size={16} /> Talep Reddedildi ve Elmaslar İade Edildi
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex', justifyContent: 'flex-end',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <button
                type="button"
                onClick={() => setShowWithdrawalModal(false)}
                style={{
                  padding: '9px 22px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  color: '#fff', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem'
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🪙 ALTIN ÖDEME BİLDİRİMLERİ (HAVALE / FAST & KRİPTO) MODALI (SADECE ADMİN) */}
      {isAdmin && showPaymentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: '#121324', border: '1.5px solid rgba(255, 170, 0, 0.45)',
            borderRadius: '24px', width: '100%', maxWidth: '950px',
            maxHeight: '90vh', overflowY: 'auto', padding: '28px',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(255, 170, 0, 0.15)',
            color: '#fff', display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #ffaa00, #ff7700)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 15px rgba(255, 170, 0, 0.4)',
                  fontSize: '1.4rem'
                }}>
                  🪙
                </div>
                <div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, color: '#fff' }}>
                    Altın Ödeme Bildirimleri & Onay
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#ffaa00', fontWeight: '600' }}>
                    Havale / FAST & Kripto (USDT TRC-20) Yükleme Talepleri
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={fetchPaymentOrders}
                  disabled={loadingPaymentOrders}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '10px',
                    background: 'rgba(255, 170, 0, 0.15)', border: '1px solid rgba(255, 170, 0, 0.3)',
                    color: '#ffaa00', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={14} className={loadingPaymentOrders ? 'animate-spin' : ''} />
                  Yenile
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: 'none',
                    width: '36px', height: '36px', borderRadius: '10px',
                    color: '#aaa', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Bilgilendirme Notu */}
            <div style={{
              background: 'rgba(255, 170, 0, 0.08)', border: '1px dashed rgba(255, 170, 0, 0.35)',
              borderRadius: '14px', padding: '12px 16px', fontSize: '0.82rem', color: '#ffdd88',
              lineHeight: '1.5'
            }}>
              💡 <b>Yönetici Güvenlik Talimatı:</b> Kullanıcı bildirim yaptığında önce banka hesabınızı (VakıfBank Havale/FAST) veya Binance cüzdanınızı kontrol edin. Ödemeyi teyit ettikten sonra <b>"Ödemeyi Onayla & Altını Yükle"</b> butonuna basmanız yeterlidir. Altınlar anında kullanıcının hesabına aktarılır ve Telegram grubunuza onay kaydı iletilir.
            </div>

            {/* Filtreler ve Arama */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { key: 'pending', label: '🟡 Bekleyenler', count: paymentOrders.filter(o => o.status === 'pending').length },
                  { key: 'approved', label: '🟢 Onaylananlar', count: paymentOrders.filter(o => o.status === 'approved').length },
                  { key: 'rejected', label: '🔴 Reddedilenler', count: paymentOrders.filter(o => o.status === 'rejected').length },
                  { key: 'all', label: 'Tümü', count: paymentOrders.length },
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setPaymentFilter(tab.key as any)}
                    style={{
                      padding: '7px 14px', borderRadius: '10px',
                      background: paymentFilter === tab.key ? 'rgba(255, 170, 0, 0.25)' : 'rgba(255,255,255,0.05)',
                      border: paymentFilter === tab.key ? '1.5px solid #ffaa00' : '1px solid rgba(255,255,255,0.1)',
                      color: paymentFilter === tab.key ? '#ffaa00' : 'rgba(255,255,255,0.7)',
                      fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <span>{tab.label}</span>
                    <span style={{
                      background: paymentFilter === tab.key ? '#ffaa00' : 'rgba(255,255,255,0.15)',
                      color: paymentFilter === tab.key ? '#000' : '#fff',
                      fontSize: '0.7rem', padding: '1px 6px', borderRadius: '8px', fontWeight: '800'
                    }}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Arama Input */}
              <div style={{ position: 'relative', minWidth: '240px' }}>
                <Search size={14} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Kod, İsim, TXID ile ara..."
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '7px 12px 7px 32px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: '0.82rem', outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Sipariş Listesi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '200px' }}>
              {(() => {
                const filtered = paymentOrders.filter(item => {
                  if (paymentFilter !== 'all' && item.status !== paymentFilter) return false;
                  if (paymentSearch.trim()) {
                    const q = paymentSearch.toLowerCase();
                    const inCode = (item.order_code || '').toLowerCase().includes(q);
                    const inName = (item.user_name || '').toLowerCase().includes(q);
                    const inSender = (item.sender_name || '').toLowerCase().includes(q);
                    const inTx = (item.crypto_txid || '').toLowerCase().includes(q);
                    const inUser = (item.user_id || '').toLowerCase().includes(q);
                    return inCode || inName || inSender || inTx || inUser;
                  }
                  return true;
                });

                if (loadingPaymentOrders) {
                  return (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#ffaa00' }}>
                      <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
                      <div>Ödeme bildirimleri yükleniyor...</div>
                    </div>
                  );
                }

                if (filtered.length === 0) {
                  return (
                    <div style={{
                      padding: '40px 20px', textAlign: 'center',
                      background: 'rgba(255,255,255,0.02)', borderRadius: '16px',
                      border: '1px dashed rgba(255,255,255,0.1)'
                    }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📭</div>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#fff' }}>
                        Bildirim Bulunamadı
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                        {paymentSearch ? 'Aramanıza uygun kayıt bulunamadı.' : 'Bu filtrede herhangi bir ödeme bildirimi bulunmuyor.'}
                      </div>
                    </div>
                  );
                }

                return filtered.map(item => {
                  const isPending = item.status === 'pending';
                  const isApproved = item.status === 'approved';
                  const isRejected = item.status === 'rejected';
                  const isCrypto = item.payment_method === 'crypto';

                  const dateObj = new Date(item.created_at);
                  const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('tr-TR') : '';
                  const timeStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';

                  const borderAccent = isPending ? '#ffaa00' : isApproved ? '#2ecc71' : '#e74c3c';

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: `1.5px solid ${isPending ? 'rgba(255, 170, 0, 0.35)' : isApproved ? 'rgba(46, 204, 113, 0.25)' : 'rgba(231, 76, 60, 0.25)'}`,
                        borderRadius: '16px', padding: '18px',
                        display: 'flex', flexDirection: 'column', gap: '14px',
                        transition: 'all 0.2s ease',
                        boxShadow: isPending ? '0 4px 18px rgba(255, 170, 0, 0.08)' : 'none'
                      }}
                    >
                      {/* Üst Kısım: Kullanıcı Bilgisi & Rozetler */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: isCrypto ? 'linear-gradient(135deg, #00f2fe, #4facfe)' : 'linear-gradient(135deg, #ffaa00, #ff7700)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#000', fontWeight: 'bold', fontSize: '1.1rem'
                          }}>
                            {isCrypto ? '🪙' : '🏦'}
                          </div>
                          <div>
                            <div style={{ color: '#fff', fontWeight: '800', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{item.user_name || 'Kullanıcı'}</span>
                              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 'normal' }}>
                                (ID: <code>{item.user_id?.slice(0, 8)}</code>)
                              </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                              📅 {dateStr} • {timeStr}
                            </div>
                          </div>
                        </div>

                        {/* Rozetler */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700',
                            background: isCrypto ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 170, 0, 0.15)',
                            color: isCrypto ? '#00f2fe' : '#ffaa00',
                            border: `1px solid ${isCrypto ? 'rgba(0, 242, 254, 0.3)' : 'rgba(255, 170, 0, 0.3)'}`
                          }}>
                            {isCrypto ? '🪙 Kripto (USDT TRC-20)' : '🏦 Havale / FAST'}
                          </span>

                          <span style={{
                            padding: '4px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800',
                            background: isPending ? 'rgba(255, 170, 0, 0.15)' : isApproved ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                            color: borderAccent, border: `1px solid ${borderAccent}`
                          }}>
                            {isPending ? '🟡 Onay Bekliyor' : isApproved ? '🟢 Onaylandı' : '🔴 Reddedildi'}
                          </span>
                        </div>
                      </div>

                      {/* Orta Kısım: Tutar & Altın Detayı */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px', background: 'rgba(0,0,0,0.25)', padding: '14px', borderRadius: '12px'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>
                            YÜKLENECEK ALTIN
                          </div>
                          <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#ffaa00' }}>
                            +{item.total_gold.toLocaleString()} 🪙
                            {item.bonus_amount > 0 && (
                              <span style={{ fontSize: '0.76rem', color: '#2ecc71', marginLeft: '6px', fontWeight: '700' }}>
                                (+{item.bonus_amount} Hediye)
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>
                            ÖDENEN TUTAR
                          </div>
                          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff' }}>
                            {item.price_text}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>
                            SİPARİŞ KODU
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <code style={{ fontSize: '0.95rem', fontWeight: '900', color: '#00f2fe' }}>
                              {item.order_code}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyPaymentField(item.order_code, `code_${item.id}`)}
                              style={{
                                background: 'transparent', border: 'none', color: '#aaa',
                                cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center'
                              }}
                              title="Kodu Kopyala"
                            >
                              {copiedPaymentId === `code_${item.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Özel Bilgiler: Gönderen Adı veya TXID */}
                      <div style={{
                        background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px',
                        display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem'
                      }}>
                        {item.sender_name && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                              👤 <b>Gönderen Adı Soyadı:</b> <span style={{ color: '#fff', fontWeight: '700' }}>{item.sender_name}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => copyPaymentField(item.sender_name || '', `name_${item.id}`)}
                              style={{
                                background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
                                padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem',
                                display: 'flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              {copiedPaymentId === `name_${item.id}` ? <Check size={12} color="#2ecc71" /> : <Copy size={12} />}
                              Kopyala
                            </button>
                          </div>
                        )}

                        {item.crypto_txid && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                              <span style={{ color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>🔗 <b>TXID / Cüzdan:</b></span>
                              <code style={{ color: '#00f2fe', fontSize: '0.76rem', wordBreak: 'break-all' }}>
                                {item.crypto_txid}
                              </code>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => copyPaymentField(item.crypto_txid || '', `tx_${item.id}`)}
                                style={{
                                  background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
                                  padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem',
                                  display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                              >
                                {copiedPaymentId === `tx_${item.id}` ? <Check size={12} color="#2ecc71" /> : <Copy size={12} />}
                                Kopyala
                              </button>
                              {item.crypto_txid.trim().length === 64 && (
                                <a
                                  href={`https://tronscan.org/#/transaction/${item.crypto_txid.trim()}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    background: 'rgba(0, 242, 254, 0.15)', border: '1px solid rgba(0, 242, 254, 0.3)',
                                    color: '#00f2fe', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem',
                                    textDecoration: 'none', fontWeight: '700'
                                  }}
                                >
                                  TronScan'de Gör ↗
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {item.admin_notes && (
                          <div style={{ color: '#ff7777', fontSize: '0.78rem', marginTop: '4px' }}>
                            📝 <b>Not:</b> {item.admin_notes}
                          </div>
                        )}
                      </div>

                      {/* Aksiyon Butonları */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRejectPaymentOrder(item)}
                              disabled={processingOrderId === item.id}
                              style={{
                                padding: '9px 18px', borderRadius: '10px',
                                background: 'rgba(231, 76, 60, 0.12)', border: '1px solid #e74c3c',
                                color: '#e74c3c', fontWeight: '700', fontSize: '0.84rem',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                opacity: processingOrderId === item.id ? 0.5 : 1
                              }}
                            >
                              <XCircle size={15} /> Reddet
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApprovePaymentOrder(item)}
                              disabled={processingOrderId === item.id}
                              style={{
                                padding: '9px 24px', borderRadius: '10px',
                                background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
                                border: 'none', color: '#fff', fontWeight: '900', fontSize: '0.85rem',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                boxShadow: '0 4px 15px rgba(46, 204, 113, 0.4)',
                                opacity: processingOrderId === item.id ? 0.5 : 1
                              }}
                            >
                              {processingOrderId === item.id ? (
                                <>
                                  <RefreshCw size={15} className="animate-spin" /> İşleniyor...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={16} /> ✅ Ödemeyi Onayla & Altını Yükle
                                </>
                              )}
                            </button>
                          </>
                        )}

                        {isApproved && (
                          <div style={{ color: '#2ecc71', fontWeight: '800', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 size={16} /> Ödeme Onaylandı & +{item.total_gold.toLocaleString()} Altın Hesaba Yüklendi
                          </div>
                        )}

                        {isRejected && (
                          <div style={{ color: '#e74c3c', fontWeight: '700', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <XCircle size={16} /> Ödeme Reddedildi
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div style={{
              paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                Toplam <b>{paymentOrders.length}</b> ödeme bildirimi (<b>{pendingPaymentCount}</b> bekliyor)
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                style={{
                  padding: '9px 24px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  color: '#fff', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem'
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KAYITLI KULLANICILAR TABLOSU MODAL (SADECE ADMİN) */}
      {isAdmin && showUsersModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            width: '100%', maxWidth: '1050px', maxHeight: '90vh',
            background: '#0d0f1d', borderRadius: '24px',
            border: '1px solid rgba(0, 242, 254, 0.4)',
            boxShadow: '0 25px 70px rgba(0,0,0,0.8), 0 0 30px rgba(0, 242, 254, 0.15)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            color: '#fff'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '22px 26px', borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  background: 'rgba(0, 242, 254, 0.15)', border: '1px solid #00f2fe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Users size={22} color="#00f2fe" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>
                    Kayıtlı Kullanıcılar Tablosu ({allUsersList.length})
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', margin: '2px 0 0 0' }}>
                    Sisteme kayıtlı tüm kullanıcılar, kullanıcı adları, bakiyeleri ve durumları
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  onClick={fetchAllUsers}
                  style={{
                    padding: '8px 14px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px'
                  }}
                >
                  <RefreshCw size={13} /> Yenile
                </button>
                <button
                  onClick={() => setShowUsersModal(false)}
                  style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)', border: 'none',
                    color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Arama & Filtre Çubuğu */}
            <div style={{
              padding: '16px 26px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.2)'
            }}>
              {/* Arama Kutusu */}
              <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '380px' }}>
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Kullanıcı adı veya ID ile ara..."
                  style={{
                    width: '100%', padding: '10px 14px 10px 38px',
                    borderRadius: '12px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
                    fontSize: '0.85rem', outline: 'none'
                  }}
                />
              </div>

              {/* Filtre Butonları */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { key: 'all', label: `Tümü (${allUsersList.length})` },
                  { key: 'female', label: `Kadın / Yayıncı (${allUsersList.filter(u => u.gender === 'kadin' || u.role === 'streamer').length})` },
                  { key: 'male', label: `Erkek (${allUsersList.filter(u => u.gender === 'erkek').length})` },
                  { key: 'banned', label: `Yasaklı (${allUsersList.filter(u => u.is_banned).length})` }
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setUserRoleFilter(f.key as any)}
                    style={{
                      padding: '7px 14px', borderRadius: '12px',
                      background: userRoleFilter === f.key ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255,255,255,0.04)',
                      border: userRoleFilter === f.key ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.08)',
                      color: userRoleFilter === f.key ? '#00f2fe' : 'rgba(255,255,255,0.7)',
                      fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Kullanıcılar Tablosu */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 26px' }}>
              {loadingUsers ? (
                <div style={{ textAlign: 'center', padding: '50px', color: 'rgba(255,255,255,0.5)' }}>
                  Kullanıcı listesi yükleniyor...
                </div>
              ) : allUsersList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px', color: 'rgba(255,255,255,0.5)' }}>
                  Henüz kayıtlı kullanıcı bulunmuyor.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <th style={{ padding: '12px 14px' }}>Kullanıcı</th>
                        <th style={{ padding: '12px 14px' }}>Cinsiyet & Rol</th>
                        <th style={{ padding: '12px 14px' }}>Bakiye</th>
                        <th style={{ padding: '12px 14px' }}>Kayıt Tarihi</th>
                        <th style={{ padding: '12px 14px' }}>Durum</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUsersList
                        .filter(u => {
                          if (userRoleFilter === 'female') return u.gender === 'kadin' || u.role === 'streamer';
                          if (userRoleFilter === 'male') return u.gender === 'erkek';
                          if (userRoleFilter === 'banned') return u.is_banned === true;
                          return true;
                        })
                        .filter(u => {
                          if (!userSearchQuery.trim()) return true;
                          const q = userSearchQuery.toLowerCase().trim();
                          return (u.display_name || '').toLowerCase().includes(q) || (u.id || '').toLowerCase().includes(q);
                        })
                        .map((user) => {
                          const isKadin = user.gender === 'kadin' || user.role === 'streamer';
                          const isSilinmis = (user.display_name || '').toLowerCase().includes('silinmiş') || user.role === 'deleted';
                          return (
                            <tr
                              key={user.id}
                              style={{
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                background: user.is_banned ? 'rgba(255, 45, 85, 0.05)' : 'transparent',
                                transition: 'background 0.2s'
                              }}
                            >
                              {/* Kullanıcı */}
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{
                                    width: '36px', height: '36px', borderRadius: '50%',
                                    background: isKadin ? 'linear-gradient(135deg, #ff416c, #ff4b2b)' : 'linear-gradient(135deg, #00f2fe, #4facfe)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: '800', fontSize: '0.85rem', flexShrink: 0
                                  }}>
                                    {(user.display_name || 'U')[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: '700', color: isSilinmis ? '#999' : '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      {user.display_name || 'İsimsiz'}
                                      {(user.id === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b' || (user.display_name || '').toLowerCase() === 'omer') && (
                                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '6px', background: 'rgba(255, 215, 0, 0.2)', color: '#ffd700', border: '1px solid #ffd700' }}>Admin</span>
                                      )}
                                      {(user.id !== 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b' && (user.display_name || '').toLowerCase() !== 'omer' && (user.is_moderator || user.role === 'moderator' || user.id === '16cd9b54-a051-4548-a3ad-d34f4b5b9ab4')) && (
                                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '6px', background: 'rgba(243, 156, 18, 0.2)', color: '#f39c12', border: '1px solid #f39c12' }}>Mod</span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                                      ID: {user.id.slice(0, 13)}...
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Cinsiyet & Rol */}
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{
                                  padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700',
                                  background: isKadin ? 'rgba(255, 65, 108, 0.15)' : 'rgba(79, 172, 254, 0.15)',
                                  color: isKadin ? '#ff6b8b' : '#4facfe',
                                  border: isKadin ? '1px solid rgba(255, 65, 108, 0.3)' : '1px solid rgba(79, 172, 254, 0.3)'
                                }}>
                                  {isKadin ? '♀️ Kadın (Yayıncı)' : '♂️ Erkek (Kullanıcı)'}
                                </span>
                              </td>

                              {/* Bakiye */}
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.8rem' }}>
                                  <span style={{ color: '#ffd700', fontWeight: '700' }}>
                                    🟡 {user.total_gold ?? 0}
                                  </span>
                                  <span style={{ color: '#00f2fe', fontWeight: '700' }}>
                                    💎 {user.total_diamonds ?? 0}
                                  </span>
                                </div>
                              </td>

                              {/* Kayıt Tarihi */}
                              <td style={{ padding: '12px 14px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>
                                {user.created_at ? new Date(user.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </td>

                              {/* Durum */}
                              <td style={{ padding: '12px 14px' }}>
                                {user.is_banned ? (
                                  <span style={{ color: '#ff2d55', fontSize: '0.75rem', fontWeight: '800', background: 'rgba(255,45,85,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid #ff2d55' }}>
                                    🚫 Yasaklı
                                  </span>
                                ) : isSilinmis ? (
                                  <span style={{ color: '#999', fontSize: '0.75rem', fontWeight: '700', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '6px' }}>
                                    Silinmiş
                                  </span>
                                ) : (
                                  <span style={{ color: '#2ecc71', fontSize: '0.75rem', fontWeight: '800', background: 'rgba(46,204,113,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid #2ecc71' }}>
                                    ● Aktif
                                  </span>
                                )}
                              </td>

                              {/* İşlemler */}
                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                  <button
                                    onClick={() => handleOpenAuditForUser(user.display_name || user.id)}
                                    title="Altın ve aktivite ekstresini incele"
                                    style={{
                                      padding: '5px 9px', borderRadius: '8px',
                                      background: 'rgba(0, 242, 254, 0.15)', border: '1px solid rgba(0, 242, 254, 0.4)',
                                      color: '#00f2fe', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer'
                                    }}
                                  >
                                    📊 Ekstre
                                  </button>

                                  <button
                                    onClick={() => handleToggleBanUser(user)}
                                    title={user.is_banned ? 'Yasağı kaldır' : 'Kullanıcıyı yasakla'}
                                    style={{
                                      padding: '5px 9px', borderRadius: '8px',
                                      background: user.is_banned ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255, 45, 85, 0.2)',
                                      border: user.is_banned ? '1px solid #2ecc71' : '1px solid #ff2d55',
                                      color: user.is_banned ? '#2ecc71' : '#ff2d55',
                                      fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer'
                                    }}
                                  >
                                    {user.is_banned ? 'Yasağı Aç' : 'Yasakla'}
                                  </button>

                                  <button
                                    disabled={deletingUserId === user.id}
                                    onClick={() => handleDeleteUserProfile(user)}
                                    title="Kullanıcı profilini sil ve kullanıcı adını boşa çıkar"
                                    style={{
                                      padding: '5px 9px', borderRadius: '8px',
                                      background: 'rgba(255, 45, 85, 0.1)', border: '1px solid rgba(255, 45, 85, 0.3)',
                                      color: '#ff6b8b', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer'
                                    }}
                                  >
                                    <Trash2 size={13} style={{ display: 'inline', marginRight: '3px' }} />
                                    {deletingUserId === user.id ? 'Siliniyor...' : 'Sil'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 26px', borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                💡 <i>Not: Bir kullanıcıyı sildiğinizde o kişinin kullanıcı adı tamamen serbest kalır ve başka biri tarafından alınabilir.</i>
              </div>
              <button
                onClick={() => setShowUsersModal(false)}
                style={{
                  padding: '10px 24px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  color: '#fff', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem'
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODERATÖR DENETİM GÜNLÜĞÜ MODALI (SADECE ADMİN) */}
      {isAdmin && showModLogModal && (
        <div
          onClick={() => setShowModLogModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #181c2f 0%, #0d0f1b 100%)',
              borderRadius: '24px', border: '1px solid rgba(243, 156, 18, 0.4)',
              width: '100%', maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto',
              padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: '#f39c12', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📜 Moderatör İşlem & Denetim Günlüğü ({auditLogsList.length})
              </h2>
              <button
                onClick={() => setShowModLogModal(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
              Moderatörlerin panel üzerinde gerçekleştirdiği banlama, silme, onaylama ve şifre değiştirme işlemleri burada zaman damgasıyla şeffaf şekilde listelenir.
            </p>

            {auditLogsList.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                Henüz kayıtlı bir denetim hareketi bulunmuyor.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {auditLogsList.map((log: any) => (
                  <div key={log.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '800', color: '#00f2fe', fontSize: '0.88rem' }}>
                        👤 {log.moderator}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                        {new Date(log.timestamp).toLocaleString('tr-TR')}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.83rem', color: '#fff', fontWeight: '600' }}>
                      {log.details}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ÖZEL PYNGOO TEMALI ONAY / UYARI / İPUCU DİYALOGU */}
      {dialogState.isOpen && (
        <div
          onClick={handleDialogDismiss}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #181c2f 0%, #0d0f1b 100%)',
              borderRadius: '24px',
              border: dialogState.isDanger 
                ? '1px solid rgba(255, 45, 85, 0.5)' 
                : '1px solid rgba(0, 242, 254, 0.3)',
              boxShadow: dialogState.isDanger 
                ? '0 20px 60px rgba(255, 45, 85, 0.25)' 
                : '0 20px 60px rgba(0, 242, 254, 0.15)',
              width: '100%',
              maxWidth: '520px',
              padding: '26px 28px',
              color: '#fff',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px',
                  background: dialogState.isDanger ? 'rgba(255, 45, 85, 0.15)' : 'rgba(0, 242, 254, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {dialogState.isDanger 
                    ? <ShieldAlert size={22} color="#ff2d55" /> 
                    : <ShieldCheck size={22} color="#00f2fe" />}
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>
                  {dialogState.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleDialogDismiss}
                style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', padding: '4px', display: 'flex'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              fontSize: '0.92rem',
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.6,
              whiteSpace: 'pre-line',
              marginBottom: dialogState.type === 'prompt' ? '16px' : '24px',
              maxHeight: '55vh',
              overflowY: 'auto'
            }}>
              {dialogState.message}
            </div>

            {dialogState.type === 'prompt' && (
              <div style={{ marginBottom: '22px' }}>
                <textarea
                  value={dialogInput}
                  onChange={(e) => setDialogInput(e.target.value)}
                  rows={3}
                  placeholder="Gerekçenizi buraya yazabilirsiniz..."
                  autoFocus
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              {(dialogState.type === 'confirm' || dialogState.type === 'prompt') && (
                <button
                  type="button"
                  onClick={handleDialogDismiss}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  {dialogState.cancelText || 'Vazgeç'}
                </button>
              )}
              <button
                type="button"
                onClick={handleDialogSubmit}
                style={{
                  padding: '10px 22px',
                  borderRadius: '12px',
                  background: dialogState.isDanger
                    ? 'linear-gradient(135deg, #ff2d55, #c0392b)'
                    : 'linear-gradient(135deg, #00f2fe, #4facfe)',
                  border: 'none',
                  color: dialogState.isDanger ? '#fff' : '#000',
                  fontWeight: '800',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: dialogState.isDanger 
                    ? '0 4px 14px rgba(255, 45, 85, 0.4)' 
                    : '0 4px 14px rgba(0, 242, 254, 0.3)'
                }}
              >
                {dialogState.confirmText || (dialogState.type === 'alert' ? 'Tamam' : 'Onayla')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
