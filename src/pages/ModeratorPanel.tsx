import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  ShieldAlert, ShieldCheck, Users, RefreshCw,
  Trash2, Lock, CreditCard,
  FileText, Search, Copy, Check,
  Radio, Send, Activity, DollarSign,
  Download, LogOut, Sparkles, Cpu, Award, ChevronLeft, ChevronRight, AlertTriangle,
  Sun, Moon
} from 'lucide-react';
import { sendTelegramAlert } from '../utils/telegramAlert';
import LiveRealAnalyticsBanner from '../components/LiveRealAnalyticsBanner';
import EconomyHealthBanner from '../components/EconomyHealthBanner';

// ==========================================
// TİP TANIMLARI
// ==========================================
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

export interface WithdrawalItem {
  id: string;
  user_id: string;
  amount_diamonds: number;
  amount_currency: number;
  currency?: 'TRY' | 'USD';
  iban: string;
  full_name: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  created_at: string;
  profile_name?: string;
}

export interface ReportItem {
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

export interface UserProfileItem {
  id: string;
  display_name: string;
  gender: string;
  role: string;
  total_gold: number;
  total_diamonds: number;
  is_banned: boolean;
  is_moderator?: boolean;
  is_verified?: boolean;
  avatar_url?: string;
  created_at: string;
  active_device_id?: string;
}

export interface BroadcastMessage {
  id: string;
  title: string;
  content: string;
  target: 'all' | 'female' | 'male';
  sent_at: string;
  sent_by: string;
}

// Para birimi biçimlendirici
const withdrawalMoney = (w: { amount_currency: number | string; currency?: string }) =>
  `${Number(w.amount_currency || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${w.currency === 'USD' ? '$' : '₺'}`;

const withdrawalSums = (list: WithdrawalItem[]) => {
  const tl = list.filter(w => w.currency !== 'USD').reduce((sum, w) => sum + Number(w.amount_currency || 0), 0);
  const usd = list.filter(w => w.currency === 'USD').reduce((sum, w) => sum + Number(w.amount_currency || 0), 0);
  if (tl > 0 && usd > 0) return `${tl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ + ${usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} $`;
  if (usd > 0) return `${usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} $`;
  return `${tl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
};

// CSV dışa aktarıcı
const exportToCSV = (filename: string, rows: any[]) => {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows.map(row => {
      return keys.map(k => {
        let cell = row[k] === null || row[k] === undefined ? '' : row[k];
        cell = typeof cell === 'object' ? JSON.stringify(cell).replace(/"/g, '""') : String(cell).replace(/"/g, '""');
        if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
        return cell;
      }).join(separator);
    }).join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function ModeratorPanel() {
  // ==========================================
  // KİMLİK & YETKİLENDİRME DURUMLARI
  // ==========================================
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [activeModUser, setActiveModUser] = useState<{ username: string; role: 'admin' | 'moderator'; id?: string } | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number>(0);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  // Aktif Sekme Yönetimi
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'reports' | 'users' | 'payments' | 'withdrawals' | 'live_rooms' | 'broadcast' | 'infra' | 'audit' | 'staff'
  >('dashboard');

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Tema Yönetimi (Dark / Light Mod)
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('pyngoo_admin_theme') as 'dark' | 'light') || 'dark';
    } catch (_) {
      return 'dark';
    }
  });

  const isLight = themeMode === 'light';

  const toggleTheme = () => {
    const next = isLight ? 'dark' : 'light';
    setThemeMode(next);
    try {
      localStorage.setItem('pyngoo_admin_theme', next);
    } catch (_) {}
  };

  const theme = useMemo(() => {
    if (isLight) {
      return {
        isLight: true,
        bg: '#f8fafc',
        sidebarBg: '#ffffff',
        headerBg: '#ffffff',
        cardBg: '#ffffff',
        cardHeaderBg: '#f8fafc',
        tableHeaderBg: '#f1f5f9',
        border: '#e2e8f0',
        borderLight: '#cbd5e1',
        textPrimary: '#0f172a',
        textSecondary: '#475569',
        textMuted: '#64748b',
        inputBg: '#f8fafc',
        inputBorder: '#cbd5e1',
        badgeBg: '#f1f5f9',
        itemHover: '#f8fafc',
        shadow: '0 1px 3px rgba(0,0,0,0.06)'
      };
    }
    return {
      isLight: false,
      bg: '#090a10',
      sidebarBg: '#0c0d15',
      headerBg: '#0c0d15',
      cardBg: '#0f111c',
      cardHeaderBg: '#141724',
      tableHeaderBg: '#141726',
      border: 'rgba(255,255,255,0.06)',
      borderLight: 'rgba(255,255,255,0.1)',
      textPrimary: '#ffffff',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      inputBg: 'rgba(255,255,255,0.04)',
      inputBorder: 'rgba(255,255,255,0.12)',
      badgeBg: '#161928',
      itemHover: 'rgba(255,255,255,0.03)',
      shadow: 'none'
    };
  }, [isLight]);

  // Bildirim sesi ve rozet sayaçları
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // ==========================================
  // ÖZEL DİYALOG (ALERT / CONFIRM / PROMPT)
  // ==========================================
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
      setDialogState({ ...opts, isOpen: true, resolve });
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

  // Denetim günlüğü kayıt listesi
  const [auditLogsList, setAuditLogsList] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('pyngoo_mod_audit_logs');
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  });

  const logModeratorAction = (action: string, target: string, details: string) => {
    const modName = activeModUser?.username || 'Sistem Yöneticisi';
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

  // ==========================================
  // ŞİKAYETLER & MODERASYON
  // ==========================================
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'banned' | 'resolved' | 'dismissed'>('pending');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // ==========================================
  // PARA ÇEKİM TALEPLERİ
  // ==========================================
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'pending' | 'approved' | 'completed' | 'rejected'>('pending');
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [copiedIbanId, setCopiedIbanId] = useState<string | null>(null);

  // ==========================================
  // ALTIN SİPARİŞLERİ
  // ==========================================
  const [paymentOrders, setPaymentOrders] = useState<PaymentOrderItem[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [paymentSearch, setPaymentSearch] = useState('');

  // ==========================================
  // TÜM KULLANICILAR (CRM)
  // ==========================================
  const [allUsersList, setAllUsersList] = useState<UserProfileItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'female' | 'male' | 'banned' | 'moderator'>('all');

  // ==========================================
  // CANLI ODALAR (PRESENCE)
  // ==========================================
  const [liveRooms, setLiveRooms] = useState<{ id: string; name: string; avatar: string; joined_at?: string }[]>([]);
  const [waitingRoomCount, setWaitingRoomCount] = useState<number>(0);

  // ==========================================
  // DUYURU & BİLDİRİM MASASI
  // ==========================================
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'female' | 'male'>('all');
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastMessage[]>(() => {
    try {
      const raw = localStorage.getItem('pyngoo_broadcast_history');
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  });

  // ==========================================
  // ALTYAPI, KOTA & METRİKLER
  // ==========================================
  const [quotaMetrics, setQuotaMetrics] = useState<any | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);

  // ==========================================
  // KULLANICI AKTİVİTE & HESAP EKSTRESİ
  // ==========================================
  const [auditQuery, setAuditQuery] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditUser, setAuditUser] = useState<any | null>(null);
  const [auditItems, setAuditItems] = useState<any[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);

  // ==========================================
  // PERSONEL & MODERATÖRLER
  // ==========================================
  const [moderatorsList, setModeratorsList] = useState<any[]>([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [modUsernameInput, setModUsernameInput] = useState('');

  // Sayım Rozetleri (Header & Sidebar)
  const pendingReportCount = useMemo(() => reports.filter(r => r.status === 'pending').length, [reports]);
  const pendingWithdrawalCount = useMemo(() => withdrawals.filter(w => w.status === 'pending').length, [withdrawals]);
  const pendingPaymentCount = useMemo(() => paymentOrders.filter(p => p.status === 'pending').length, [paymentOrders]);

  // ==========================================
  // KİMLİK DOĞRULAMA MOTORU
  // ==========================================
  const isOmer = isSuperAdmin;
  const isAdmin = isSuperAdmin;

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

    const uEmail = (session.user.email || '').toLowerCase();
    const uid = session.user.id;
    const isOwner = uid === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b' || 
                    uid === '22b3c0e7-e1e2-4cb5-9532-990066b5a80c' ||
                    uEmail === 'omersahin1623@hotmail.com' || 
                    uEmail === 'cosmicdreamersleep@gmail.com' ||
                    uEmail === 'pyngooappp@gmail.com' ||
                    (prof?.display_name || '').toLowerCase() === 'omer';

    if (isOwner) {
      setAuthMessage(null);
      setIsAuthenticated(true);
      setIsSuperAdmin(true);
      setActiveModUser({
        username: prof?.display_name || 'omer',
        role: 'admin',
        id: uid
      });
      // Veritabanında da rolün admin olduğunu garanti et (RLS tam erişim için)
      if (prof && prof.role !== 'admin') {
        try {
          await supabase.from('profiles').update({ role: 'admin', is_banned: false }).eq('id', uid);
        } catch (_) {}
      }
      return true;
    }

    const isAdminRole = !!prof && prof.role === 'admin' && prof.is_banned !== true;
    const isModRole = !!prof && prof.is_banned !== true && (prof.is_moderator === true || prof.role === 'moderator');

    if (!prof || (!isAdminRole && !isModRole)) {
      try { await supabase.auth.signOut({ scope: 'local' }); } catch (_) {}
      const accountIdentity = uEmail || prof?.display_name || 'Bu hesabın';
      setAuthMessage(`⛔ "${accountIdentity}" hesabının yönetim paneli yetkisi bulunmuyor.`);
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
        // 1. Google OAuth Hash (#access_token=...) Çözümleme
        if (window.location.hash.includes('access_token')) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken) {
            try {
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
              });
            } catch (err) {
              console.warn('Panel hash token kurma hatası:', err);
            }
            const keepSearch = window.location.search.includes('panel=admin') ? '?panel=admin' : '';
            window.history.replaceState({}, document.title, window.location.pathname + keepSearch);
          }
        }

        // 2. PKCE Kodu (?code=...) Çözümleme
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          try {
            await supabase.auth.exchangeCodeForSession(code);
          } catch (err) {
            console.warn('Panel OAuth takas hatası:', err);
          }
          const keepSearch = window.location.search.includes('panel=admin') ? '?panel=admin' : '';
          window.history.replaceState({}, document.title, window.location.pathname + keepSearch);
        } else if (params.get('error')) {
          setAuthMessage('⚠️ Giriş tamamlanamadı, lütfen tekrar deneyin.');
          const keepSearch = window.location.search.includes('panel=admin') ? '?panel=admin' : '';
          window.history.replaceState({}, document.title, window.location.pathname + keepSearch);
        }

        // 3. Oturumu panele uygula
        await applyStaffSession();
      } catch (_) {}
    })();
  }, []);

  // 30 Dakika İnaktivite Zaman Aşımı
  useEffect(() => {
    if (!isAuthenticated) return;
    let timer: any = null;
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        await showAlert("⏱️ Güvenliğiniz için 30 dakika işlem yapılmadığından oturumunuz kilitlendi.", "Oturum Kilitlendi");
        handleLogoutPanel();
      }, 30 * 60 * 1000);
    };
    resetTimer();
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [isAuthenticated]);

  const AUTHORIZED_PIN_HASH = '759d4c4b7938b367cc664fe4f57acc773f0705e5b7295e20c5f821b68973ece5';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime > Date.now()) return;

    setPinError(false);
    setAuthMessage(null);

    const userInput = usernameInput.trim();
    const passInput = passwordInput.trim();
    if (!userInput || !passInput) {
      setPinError(true);
      return;
    }

    try {
      // 1. PIN Hash Kontrolü (omer / admin kullanıcı adı + yetkili şifre)
      const isOmerUser = userInput.toLowerCase() === 'omer' || userInput.toLowerCase() === 'admin';
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(passInput));
      const inputHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (isOmerUser && inputHash === AUTHORIZED_PIN_HASH) {
        setIsAuthenticated(true);
        setIsSuperAdmin(true);
        setActiveModUser({ username: 'omer', role: 'admin' });
        setFailedAttempts(0);
        logModeratorAction('mod_login', 'Sistem Paneli', 'Ömer (Yönetici) kullanıcı adı ve şifresiyle giriş yaptı.');
        return;
      }

      // 2. Supabase Auth ile Giriş (E-posta + Şifre)
      const { data, error } = await supabase.auth.signInWithPassword({ email: userInput, password: passInput });
      if (!error && data.user) {
        setFailedAttempts(0);
        const ok = await applyStaffSession();
        if (ok) return;
      }

      // 3. Hatalı Giriş
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      setPinError(true);
      if (nextAttempts >= 5) {
        setLockoutTime(Date.now() + 15 * 60 * 1000);
        setAuthMessage('⚠️ 5 defa hatalı şifre girildi. Giriş 15 dakika donduruldu.');
      }
    } catch (err: any) {
      setAuthMessage('Giriş hatası: ' + (err.message || 'Bilinmiyor'));
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthMessage(null);
      const keepSearch = window.location.search.includes('panel=admin') ? '?panel=admin' : '';
      const redirectUrl = window.location.origin + window.location.pathname + keepSearch;
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      });
    } catch (err: any) {
      setAuthMessage('Google girişi başlatılamadı: ' + err.message);
    }
  };

  const handleLogoutPanel = () => {
    supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    try {
      sessionStorage.removeItem('pyngoo_mod_session');
      localStorage.removeItem('pyngoo_mod_session');
    } catch (_) {}
    setIsAuthenticated(false);
    setIsSuperAdmin(false);
    setActiveModUser(null);
    setUsernameInput('');
    setPasswordInput('');
  };

  // ==========================================
  // VERİ YÜKLEME FONKSİYONLARI
  // ==========================================
  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const userIds = Array.from(new Set([...data.map(d => d.reporter_id), ...data.map(d => d.reported_user_id)]));
        let profileMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', userIds);
          if (profs) profs.forEach(p => { profileMap[p.id] = p.display_name; });
        }
        const enriched: ReportItem[] = data.map(item => ({
          ...item,
          reporter_name: profileMap[item.reporter_id] || 'Bilinmeyen Üye',
          reported_name: profileMap[item.reported_user_id] || 'Bilinmeyen Üye'
        }));
        setReports(enriched);
      }
    } catch (err) {
      console.error('Şikayetler çekilemedi:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  const fetchWithdrawals = async () => {
    setLoadingWithdrawals(true);
    try {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const userIds = Array.from(new Set(data.map(d => d.user_id)));
        let profileMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', userIds);
          if (profs) profs.forEach(p => { profileMap[p.id] = p.display_name; });
        }
        const enriched: WithdrawalItem[] = data.map(item => ({
          ...item,
          profile_name: profileMap[item.user_id] || item.full_name
        }));
        setWithdrawals(enriched);
      }
    } catch (err) {
      console.error('Çekim talepleri çekilemedi:', err);
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  const fetchPaymentOrders = async () => {
    setLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from('payment_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const userIds = Array.from(new Set(data.map(d => d.user_id)));
        let profileMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', userIds);
          if (profs) profs.forEach(p => { profileMap[p.id] = p.display_name; });
        }
        const enriched: PaymentOrderItem[] = data.map(item => ({
          ...item,
          user_name: profileMap[item.user_id] || 'Bilinmeyen Üye'
        }));
        setPaymentOrders(enriched);
      }
    } catch (err) {
      console.error('Ödeme siparişleri çekilemedi:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const fetchAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, gender, role, total_gold, total_diamonds, is_banned, is_moderator, is_verified, avatar_url, created_at, active_device_id')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setAllUsersList((data as UserProfileItem[]) || []);
    } catch (err) {
      console.error('Kullanıcılar çekilemedi:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchModerators = async () => {
    setLoadingMods(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, gender, total_gold, is_moderator, role')
        .or('is_moderator.eq.true,role.eq.moderator,role.eq.admin');
      setModeratorsList(data || []);
    } catch (err) {
      console.error('Moderatör listesi hatası:', err);
    } finally {
      setLoadingMods(false);
    }
  };

  const fetchQuotaMetrics = async () => {
    setQuotaLoading(true);
    try {
      const pingStart = performance.now();
      const [
        { count: profilesCount },
        { count: messagesCount },
        { count: matchesCount },
        { count: txCount },
        { count: reportsCount },
        { data: infra }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('match_history').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }),
        supabase.rpc('get_infra_stats')
      ]);
      const pingMs = Math.round(performance.now() - pingStart);
      const stats: any = infra && (infra as any).allowed ? infra : null;
      const dbLimitMb = 500;
      const dbMb = stats ? Math.round((Number(stats.db_bytes) / 1024 / 1024) * 10) / 10 : null;
      const dbPercent = dbMb === null ? null : Math.min(100, Math.round((dbMb / dbLimitMb) * 1000) / 10);
      const voiceMinutes = stats ? Math.round(Number(stats.agora?.voice_seconds || 0) / 60) : 0;
      const videoMinutes = stats ? Math.round(Number(stats.agora?.video_seconds || 0) / 60) : 0;
      const totalMinutes = voiceMinutes + videoMinutes;
      const freeLimit = 10000;
      const remainingMinutes = Math.max(0, freeLimit - totalMinutes);

      setQuotaMetrics({
        supabase: {
          profiles: profilesCount || 0,
          messages: messagesCount || 0,
          matches: matchesCount || 0,
          transactions: txCount || 0,
          reports: reportsCount || 0,
          pingMs,
          dbMb,
          dbLimitMb,
          dbPercent,
          topTables: (stats?.tables || []).map((t: any) => ({
            name: t.name,
            mb: Math.round((Number(t.bytes) / 1024 / 1024) * 100) / 100
          }))
        },
        agora: {
          voiceMinutes,
          videoMinutes,
          totalMinutes,
          freeLimit,
          remainingMinutes,
          percentUsed: Math.min(100, Math.round((totalMinutes / freeLimit) * 1000) / 10)
        },
        lastChecked: new Date().toLocaleTimeString('tr-TR')
      });
    } catch (err) {
      console.error('Kota çekme hatası:', err);
    } finally {
      setQuotaLoading(false);
    }
  };

  // Tüm Verileri Senkronize Et
  const refreshAllData = () => {
    fetchReports();
    fetchWithdrawals();
    fetchPaymentOrders();
    fetchAllUsers();
    fetchModerators();
    fetchQuotaMetrics();
    setActionMessage('🔄 Tüm paneller ve canlı sayaçlar güncellendi.');
    setTimeout(() => setActionMessage(null), 3000);
  };

  // Realtime Dinleyiciler (Presence & Postgres Changes)
  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Canlı Yayın Presence Kanalı Dinleyicisi
    const liveDir = supabase.channel('pyngoo_live_rooms_directory');
    liveDir.on('presence', { event: 'sync' }, () => {
      const state = liveDir.presenceState() as Record<string, any[]>;
      const list = Object.entries(state).map(([id, presences]) => {
        const p = presences[0] || {};
        return { id, name: p.name || 'Yayıncı', avatar: p.avatar || '', joined_at: p.joined_at };
      });
      setLiveRooms(list);
    });
    liveDir.subscribe();

    // 2. Bekleme Odası (waiting_room) Sayısı
    const updateWaitingCount = async () => {
      const { count } = await supabase.from('waiting_room').select('*', { count: 'exact', head: true });
      setWaitingRoomCount(count || 0);
    };
    updateWaitingCount();

    // 3. Veritabanı Değişiklik Abonelikleri
    const changesChannel = supabase.channel('pyngoo_panel_realtime_events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        fetchReports();
        try { new Audio('/pingoo.mp3').play().catch(() => {}); } catch (_) {}
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawal_requests' }, () => {
        fetchWithdrawals();
        try { new Audio('/pingoo.mp3').play().catch(() => {}); } catch (_) {}
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_notifications' }, () => {
        fetchPaymentOrders();
        try { new Audio('/pingoo.mp3').play().catch(() => {}); } catch (_) {}
      })
      .subscribe();

    // İlk yükleme
    refreshAllData();

    return () => {
      supabase.removeChannel(liveDir);
      supabase.removeChannel(changesChannel);
    };
  }, [isAuthenticated]);

  // ==========================================
  // ŞİKAYET MASASI AKSİYONLARI
  // ==========================================
  const handleBanUserFromReport = async (report: ReportItem) => {
    const ok = await showConfirm(
      `"${report.reported_name}" adlı kullanıcıyı KALICI OLARAK YASAKLAMAK istediğinize emin misiniz?`,
      'Kullanıcıyı Yasakla',
      true,
      'Yasakla'
    );
    if (!ok) return;

    try {
      await supabase.from('profiles').update({ is_banned: true }).eq('id', report.reported_user_id);
      await supabase.from('reports').update({ status: 'banned' }).eq('id', report.id);
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'banned' } : r));
      setActionMessage(`🚫 ${report.reported_name} yasaklandı.`);
      logModeratorAction('ban', report.reported_name || report.reported_user_id, `Şikayet üzerinden kalıcı ban. Sebep: ${report.reason || report.category}`);
      sendTelegramAlert(`🔨 <b>KULLANICI YASAKLANDI!</b>\n👤 <b>Yasaklanan:</b> ${report.reported_name} (<code>${report.reported_user_id.slice(0, 8)}</code>)\n⚠️ <b>Sebep:</b> ${report.category || report.reason}\n🛡️ <b>İşlem:</b> Panel Moderasyon`);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      await showAlert('Hata: ' + (err.message || 'Yasaklanamadı'), 'Hata');
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      await supabase.from('reports').update({ status: 'resolved' }).eq('id', reportId);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
      setActionMessage('✅ Şikayet çözüldü olarak kapatıldı.');
      logModeratorAction('report_resolve', reportId, 'Şikayet çözüldü');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      await supabase.from('reports').update({ status: 'dismissed' }).eq('id', reportId);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'dismissed' } : r));
      setActionMessage('🛡️ Şikayet "Asılsız / Masum" olarak arşivlendi.');
      logModeratorAction('report_dismiss', reportId, 'Şikayet asılsız olarak arşivlendi');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // PARA ÇEKİM AKSİYONLARI
  // ==========================================
  const handleApproveWithdrawal = async (item: WithdrawalItem) => {
    if (item.status !== 'pending') return;
    try {
      await supabase.from('withdrawal_requests').update({ status: 'approved' }).eq('id', item.id);
      setWithdrawals(prev => prev.map(w => w.id === item.id ? { ...w, status: 'approved' } : w));
      setActionMessage(`✅ ${item.full_name} talebi onaylandı. Ödeme hazırlığına alındı.`);
      logModeratorAction('withdrawal_approve', item.full_name, `${withdrawalMoney(item)} tutarındaki çekim onaylandı.`);
      sendTelegramAlert(`🔵 <b>ÇEKİM ONAYLANDI!</b>\n👤 <b>Yayıncı:</b> ${item.full_name}\n💵 <b>Tutar:</b> ${withdrawalMoney(item)}\n🏦 <b>IBAN:</b> <code>${item.iban}</code>`);
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      await showAlert('Hata: ' + err.message, 'Hata');
    }
  };

  const handleCompleteWithdrawal = async (item: WithdrawalItem) => {
    if (item.status === 'completed') return;
    try {
      await supabase.from('withdrawal_requests').update({ status: 'completed' }).eq('id', item.id);
      setWithdrawals(prev => prev.map(w => w.id === item.id ? { ...w, status: 'completed' } : w));
      setActionMessage(`💰 ${item.full_name} ödemesi tamamlandı ve Yatırıldı işaretlendi!`);
      logModeratorAction('withdrawal_complete', item.full_name, `${withdrawalMoney(item)} tutarındaki ödeme hesaba yatırıldı.`);
      sendTelegramAlert(`🟢 <b>ÖDEME HESABA YATIRILDI!</b>\n👤 <b>Yayıncı:</b> ${item.full_name}\n💵 <b>Tutar:</b> ${withdrawalMoney(item)}\n✅ <b>İşlem:</b> Tamamlandı`);
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      await showAlert('Hata: ' + err.message, 'Hata');
    }
  };

  const handleRejectWithdrawal = async (item: WithdrawalItem) => {
    const reason = await showPrompt(
      `${item.full_name} kullanıcısının ${item.amount_diamonds.toLocaleString()} elmaslık çekimini reddetmek ve elmasları hesabına iade etmek üzeresiniz.\n\nRed Gerekçesi:`,
      'Hatalı veya uyuşmayan IBAN bilgisi',
      'Çekim Talebini Reddet'
    );
    if (reason === null) return;

    try {
      await supabase.from('withdrawal_requests').update({ status: 'rejected' }).eq('id', item.id);
      const { data: prof } = await supabase.from('profiles').select('total_diamonds').eq('id', item.user_id).single();
      const currentDiamonds = prof?.total_diamonds || 0;
      await supabase.from('profiles').update({ total_diamonds: currentDiamonds + item.amount_diamonds }).eq('id', item.user_id);

      setWithdrawals(prev => prev.map(w => w.id === item.id ? { ...w, status: 'rejected' } : w));
      setActionMessage(`❌ Çekim reddedildi, ${item.amount_diamonds.toLocaleString()} elmas yayıncıya iade edildi.`);
      logModeratorAction('withdrawal_reject', item.full_name, `Çekim reddedildi. İade: ${item.amount_diamonds} elmas. Sebep: ${reason}`);
      sendTelegramAlert(`🔴 <b>ÇEKİM REDDEDİLDİ & İADE EDİLDİ!</b>\n👤 <b>Yayıncı:</b> ${item.full_name}\n💎 <b>İade:</b> ${item.amount_diamonds} elmas\n📝 <b>Gerekçe:</b> ${reason}`);
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      await showAlert('Hata: ' + err.message, 'Hata');
    }
  };

  // ==========================================
  // ALTIN SİPARİŞİ AKSİYONLARI
  // ==========================================
  const handleApprovePayment = async (order: PaymentOrderItem) => {
    if (order.status !== 'pending') return;
    const ok = await showConfirm(
      `Sipariş Kodu: ${order.order_code}\nKullanıcı: ${order.user_name}\nEklenecek Altın: ${order.total_gold.toLocaleString()} Altın\nTutar: ${order.price_text}\n\nBu ödemeyi onaylayıp kullanıcının hesabına altınları yüklemek istiyor musunuz?`,
      'Ödeme Onayı',
      false,
      'Onayla ve Altın Yükle'
    );
    if (!ok) return;

    try {
      const { error: rpcErr } = await supabase.rpc('approve_payment_order', {
        p_order_id: order.id,
        p_admin_notes: 'Yönetim panelinden onaylandı'
      });
      if (rpcErr) throw rpcErr;

      setPaymentOrders(prev => prev.map(p => p.id === order.id ? { ...p, status: 'approved' } : p));
      setActionMessage(`🪙 ${order.user_name} hesabına ${order.total_gold.toLocaleString()} altın yüklendi!`);
      logModeratorAction('payment_approve', order.user_name || order.order_code, `${order.total_gold} altın siparişi onaylandı (${order.price_text}).`);
      sendTelegramAlert(`🪙 <b>ALTIN SİPARİŞİ ONAYLANDI!</b>\n👤 <b>Kullanıcı:</b> ${order.user_name}\n💎 <b>Yüklenen Altın:</b> ${order.total_gold.toLocaleString()}\n💵 <b>Tutar:</b> ${order.price_text}\n🔢 <b>Kod:</b> <code>${order.order_code}</code>`);
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      await showAlert('Onaylama hatası: ' + err.message, 'Hata');
    }
  };

  const handleRejectPayment = async (order: PaymentOrderItem) => {
    const reason = await showPrompt('Bu ödeme bildirimini reddetme gerekçesi:', 'Banka hesabına tutar geçmedi', 'Ödeme Bildirimi Reddi');
    if (reason === null) return;

    try {
      await supabase.from('payment_notifications').update({ status: 'rejected', admin_notes: reason }).eq('id', order.id);
      setPaymentOrders(prev => prev.map(p => p.id === order.id ? { ...p, status: 'rejected', admin_notes: reason } : p));
      setActionMessage(`❌ ${order.order_code} nolu ödeme bildirimi reddedildi.`);
      logModeratorAction('payment_reject', order.order_code, `Ödeme reddedildi. Sebep: ${reason}`);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      await showAlert('Hata: ' + err.message, 'Hata');
    }
  };

  // ==========================================
  // KULLANICI CRM AKSİYONLARI
  // ==========================================
  const handleToggleBanUser = async (user: UserProfileItem) => {
    const newStatus = !user.is_banned;
    const ok = await showConfirm(
      `"${user.display_name}" kullanıcısını ${newStatus ? 'YASAKLAMAK' : 'YASAĞINI KALDIRMAK'} istediğinize emin misiniz?`,
      newStatus ? 'Kullanıcıyı Yasakla' : 'Yasağı Kaldır',
      newStatus
    );
    if (!ok) return;

    try {
      await supabase.from('profiles').update({ is_banned: newStatus }).eq('id', user.id);
      setAllUsersList(prev => prev.map(u => u.id === user.id ? { ...u, is_banned: newStatus } : u));
      setActionMessage(newStatus ? `🚫 "${user.display_name}" yasaklandı.` : `✅ "${user.display_name}" yasağı kaldırıldı.`);
      logModeratorAction(newStatus ? 'user_ban' : 'user_unban', user.display_name, newStatus ? 'Kullanıcı banlandı' : 'Kullanıcı yasağı kaldırıldı');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      await showAlert('Hata: ' + err.message, 'Hata');
    }
  };

  const handleDeleteUserProfile = async (user: UserProfileItem) => {
    if (!isOmer) {
      await showAlert('Kullanıcı profilini kalıcı olarak silme yetkisi yalnızca Süper Yöneticiye aittir.', 'Yetki Yetersiz');
      return;
    }
    const ok = await showConfirm(
      `"${user.display_name}" adlı kullanıcı profilini kalıcı olarak silmek ve rumuzu tamamen boşa çıkarmak istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`,
      'Profili Kalıcı Olarak Sil',
      true,
      'Kalıcı Olarak Sil'
    );
    if (!ok) return;

    try {
      try { await supabase.rpc('purge_user_data', { p_target_user_id: user.id }); } catch (_) {}
      await supabase.from('profiles').delete().eq('id', user.id);
      try { await supabase.from('waiting_room').delete().eq('user_id', user.id); } catch (_) {}
      setAllUsersList(prev => prev.filter(u => u.id !== user.id));
      setActionMessage(`🗑️ "${user.display_name}" profili tamamen silindi ve rumuz boşa çıkarıldı.`);
      logModeratorAction('user_delete', user.display_name, `Profil kalıcı olarak silindi (ID: ${user.id}).`);
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      await showAlert('Silme hatası: ' + err.message, 'Hata');
    }
  };

  const handleAdjustBalance = async (user: UserProfileItem) => {
    if (!isAdmin) {
      await showAlert('Bakiye ayarlama yetkisi yalnızca Sistem Yöneticisine aittir.', 'Yetki Yetersiz');
      return;
    }
    const goldInput = await showPrompt(
      `"${user.display_name}" için eklenecek veya çıkarılacak ALTIN miktarı:\n(Örnek: +500 veya -200)\n\nMevcut Altın: ${user.total_gold.toLocaleString()}`,
      '0',
      'Altın Bakiyesi Düzenleme'
    );
    if (goldInput === null) return;
    const goldDelta = parseInt(goldInput, 10) || 0;

    const diamondInput = await showPrompt(
      `"${user.display_name}" için eklenecek veya çıkarılacak ELMAS miktarı:\n(Örnek: +100 veya -50)\n\nMevcut Elmas: ${user.total_diamonds.toLocaleString()}`,
      '0',
      'Elmas Bakiyesi Düzenleme'
    );
    if (diamondInput === null) return;
    const diamondDelta = parseInt(diamondInput, 10) || 0;

    if (goldDelta === 0 && diamondDelta === 0) return;

    const newGold = Math.max(0, user.total_gold + goldDelta);
    const newDiamonds = Math.max(0, user.total_diamonds + diamondDelta);

    try {
      await supabase.from('profiles').update({
        total_gold: newGold,
        total_diamonds: newDiamonds
      }).eq('id', user.id);

      setAllUsersList(prev => prev.map(u => u.id === user.id ? { ...u, total_gold: newGold, total_diamonds: newDiamonds } : u));
      setActionMessage(`💰 "${user.display_name}" bakiyesi güncellendi: ${newGold.toLocaleString()} Altın / ${newDiamonds.toLocaleString()} Elmas.`);
      logModeratorAction('balance_adjust', user.display_name, `Bakiye güncellendi (Altın: ${goldDelta > 0 ? '+' : ''}${goldDelta}, Elmas: ${diamondDelta > 0 ? '+' : ''}${diamondDelta})`);
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      await showAlert('Bakiye güncelleme hatası: ' + err.message, 'Hata');
    }
  };

  // ==========================================
  // SİSTEM DUYURU AKSİYONLARI
  // ==========================================
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastContent.trim()) {
      await showAlert('Lütfen duyuru başlığı ve içeriğini eksiksiz doldurun.', 'Eksik Bilgi');
      return;
    }
    const ok = await showConfirm(
      `Hedef: ${broadcastTarget === 'all' ? 'Tüm Kullanıcılar' : broadcastTarget === 'female' ? 'Sadece Kadınlar / Yayıncılar' : 'Sadece Erkekler'}\nBaşlık: ${broadcastTitle}\n\nBu duyuruyu göndermek istiyor musunuz?`,
      'Duyuru Fırlat',
      false,
      'Duyuruyu Yayınla'
    );
    if (!ok) return;

    const newMsg: BroadcastMessage = {
      id: `bc_${Date.now()}`,
      title: broadcastTitle.trim(),
      content: broadcastContent.trim(),
      target: broadcastTarget,
      sent_at: new Date().toISOString(),
      sent_by: activeModUser?.username || 'Admin'
    };

    const updatedHistory = [newMsg, ...broadcastHistory].slice(0, 50);
    setBroadcastHistory(updatedHistory);
    try { localStorage.setItem('pyngoo_broadcast_history', JSON.stringify(updatedHistory)); } catch (_) {}

    // Telegram'a ilet
    sendTelegramAlert(`📢 <b>SİSTEM DUYURUSU YAYINLANDI!</b>\n🎯 <b>Hedef Kitle:</b> ${broadcastTarget.toUpperCase()}\n📌 <b>Başlık:</b> ${newMsg.title}\n💬 <b>İçerik:</b> ${newMsg.content}\n👑 <b>Yayınlayan:</b> ${newMsg.sent_by}`);

    setBroadcastTitle('');
    setBroadcastContent('');
    setActionMessage('📢 Sistem duyurusu başarıyla yayınlandı!');
    setTimeout(() => setActionMessage(null), 3500);
  };

  // ==========================================
  // HESAP EKSTRESİ VE DENETİM RAPORU
  // ==========================================
  const handleFetchAuditReport = async () => {
    const q = auditQuery.trim();
    if (!q) {
      setAuditError('Lütfen bir rumuz veya UUID girin.');
      return;
    }
    setAuditLoading(true);
    setAuditError(null);

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
      let query = supabase.from('profiles').select('*');
      if (isUuid) query = query.eq('id', q);
      else query = query.ilike('display_name', q);

      const { data: prof, error: pErr } = await query.maybeSingle();
      if (pErr || !prof) {
        setAuditError(`"${q}" adına sahip profil bulunamadı.`);
        setAuditUser(null);
        setAuditItems([]);
        return;
      }
      setAuditUser(prof);

      // İşlem geçmişini çek
      let txQuery = supabase.from('transactions').select('*').eq('user_id', prof.id).order('created_at', { ascending: false });
      if (auditStartDate) txQuery = txQuery.gte('created_at', auditStartDate + 'T00:00:00');
      if (auditEndDate) txQuery = txQuery.lte('created_at', auditEndDate + 'T23:59:59');

      const { data: txs } = await txQuery.limit(200);
      setAuditItems(txs || []);
    } catch (err: any) {
      setAuditError('Rapor çekme hatası: ' + err.message);
    } finally {
      setAuditLoading(false);
    }
  };

  // ==========================================
  // MODERATÖR PERSONEL AKSİYONLARI
  // ==========================================
  const handleAssignModerator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const name = modUsernameInput.trim();
    if (!name) return;

    try {
      const { data: prof } = await supabase.from('profiles').select('id, display_name').ilike('display_name', name).maybeSingle();
      if (!prof) {
        await showAlert(`"${name}" adında bir kullanıcı bulunamadı.`, 'Kullanıcı Bulunamadı');
        return;
      }
      await supabase.from('profiles').update({ is_moderator: true, role: 'moderator' }).eq('id', prof.id);
      setActionMessage(`🛡️ "${prof.display_name}" kullanıcısına Moderatör yetkisi verildi.`);
      setModUsernameInput('');
      fetchModerators();
      logModeratorAction('mod_assign', prof.display_name, 'Yeni moderatör atandı');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      await showAlert('Hata: ' + err.message, 'Hata');
    }
  };

  const handleRevokeModerator = async (targetId: string, targetName: string) => {
    if (!isAdmin) return;
    if (targetName.toLowerCase() === 'omer') {
      await showAlert('Süper Admin hesabının yetkisi kaldırılamaz!', 'Engellendi');
      return;
    }
    const ok = await showConfirm(`"${targetName}" kullanıcısının moderatörlük yetkisini geri almak istiyor musunuz?`, 'Yetkiyi Geri Al', true);
    if (!ok) return;

    try {
      await supabase.from('profiles').update({ is_moderator: false, role: 'user' }).eq('id', targetId);
      setModeratorsList(prev => prev.filter(m => m.id !== targetId));
      setActionMessage(`✅ "${targetName}" moderatörlük yetkisi kaldırıldı.`);
      logModeratorAction('mod_revoke', targetName, 'Moderatör yetkisi geri alındı');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      await showAlert('Hata: ' + err.message, 'Hata');
    }
  };

  // ==========================================
  // GİRİŞ EKRANI (OTURUM YOKSA)
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        background: theme.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: theme.textPrimary,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative'
      }}>
        {/* Sağ üst tema değiştirici */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isLight ? 'Karanlık Moda Geç' : 'Aydınlık Moda Geç'}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            color: theme.textSecondary,
            borderRadius: '10px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: '600',
            boxShadow: theme.shadow
          }}
        >
          {isLight ? <Moon size={16} /> : <Sun size={16} />}
          <span>{isLight ? 'Koyu Mod' : 'Açık Mod'}</span>
        </button>

        <div style={{
          width: '100%',
          maxWidth: '420px',
          background: theme.cardBg,
          borderRadius: '20px',
          border: `1px solid ${theme.border}`,
          padding: '36px 30px',
          textAlign: 'center',
          boxShadow: isLight ? '0 10px 30px rgba(0,0,0,0.06)' : '0 25px 60px rgba(0,0,0,0.85)'
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: isLight ? '#f1f5f9' : '#161928',
            border: `1px solid ${theme.borderLight}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px auto'
          }}>
            <ShieldCheck size={32} color={isLight ? '#0284c7' : '#cbd5e1'} />
          </div>

          <h1 style={{ fontSize: '1.35rem', fontWeight: '800', letterSpacing: '-0.3px', margin: '0 0 6px 0', color: theme.textPrimary }}>
            Pyngoo Yönetim Merkezi
          </h1>
          <p style={{ fontSize: '0.84rem', color: theme.textSecondary, margin: '0 0 24px 0' }}>
            Yönetim ve moderasyon erişimi için kimliğinizi doğrulayın.
          </p>

          {lockoutTime > Date.now() ? (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px', padding: '14px', color: '#f87171', fontSize: '0.84rem', fontWeight: '600'
            }}>
              ⚠️ Çok sayıda hatalı deneme nedeniyle giriş geçici olarak donduruldu.
            </div>
          ) : (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', color: theme.textSecondary, marginBottom: '6px', fontWeight: '700' }}>
                  Yönetici Kullanıcı Adı veya E-Posta:
                </label>
                <input
                  type="text"
                  placeholder="omer veya ornek@mail.com"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: '10px',
                    background: theme.inputBg, border: pinError ? '1px solid #ef4444' : `1px solid ${theme.inputBorder}`,
                    color: theme.textPrimary, fontSize: '0.9rem', outline: 'none'
                  }}
                  autoFocus
                />
              </div>

              <div style={{ textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', color: theme.textSecondary, marginBottom: '6px', fontWeight: '700' }}>
                  Şifre:
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: '10px',
                    background: theme.inputBg, border: pinError ? '1px solid #ef4444' : `1px solid ${theme.inputBorder}`,
                    color: theme.textPrimary, fontSize: '0.9rem', outline: 'none'
                  }}
                />
              </div>

              {pinError && (
                <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: 0, fontWeight: '700' }}>
                  ⚠️ Geçersiz kimlik bilgileri! (Deneme: {failedAttempts}/5)
                </p>
              )}

              <button
                type="submit"
                style={{
                  width: '100%', padding: '13px', borderRadius: '10px',
                  background: isLight ? '#0f172a' : '#ffffff',
                  border: 'none', color: isLight ? '#ffffff' : '#090a10', fontWeight: '800', fontSize: '0.92rem',
                  cursor: 'pointer', transition: 'opacity 0.15s ease'
                }}
              >
                Giriş Yap
              </button>
            </form>
          )}

          <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, height: '1px', background: theme.border }} />
            <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>VEYA</span>
            <div style={{ flex: 1, height: '1px', background: theme.border }} />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px',
              background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${theme.borderLight}`,
              color: theme.textPrimary,
              fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: isLight ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <span style={{ fontWeight: '900', color: '#4285F4' }}>G</span> Google Yetkilendirmesi ile Giriş
          </button>

          {authMessage && (
            <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '14px', fontWeight: '700' }}>
              {authMessage}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // ANA KOMUTA MERKEZİ ARAYÜZÜ (SIDEBAR + CONTENT)
  // ==========================================
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: theme.bg,
      color: theme.textPrimary,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* ========================================== */}
      {/* SOL NAVİGASYON MENÜSÜ (SIDEBAR)            */}
      {/* ========================================== */}
      <aside style={{
        width: sidebarCollapsed ? '76px' : '250px',
        background: theme.sidebarBg,
        borderRight: `1px solid ${theme.border}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 50
      }}>
        {/* Brand / Logo Header */}
        <div style={{
          padding: '18px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          borderBottom: `1px solid ${theme.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: isLight ? '#f1f5f9' : '#161928',
              border: `1px solid ${theme.borderLight}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ShieldCheck size={20} color={isLight ? '#0284c7' : '#cbd5e1'} />
            </div>
            {!sidebarCollapsed && (
              <div>
                <div style={{ fontSize: '0.98rem', fontWeight: '800', letterSpacing: '-0.3px', color: theme.textPrimary }}>
                  PYNGOO
                </div>
                <div style={{ fontSize: '0.64rem', color: theme.textMuted, fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  Yönetim Paneli
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${theme.border}`,
              color: theme.textSecondary,
              borderRadius: '6px', padding: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            title={sidebarCollapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt'}
          >
            {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Menü Linkleri */}
        <nav style={{ flex: 1, padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
          {[
            { id: 'dashboard', label: 'Genel Bakış', icon: Activity, badge: null },
            { id: 'reports', label: 'Şikayet Masası', icon: ShieldAlert, badge: pendingReportCount, isDangerBadge: true },
            { id: 'users', label: 'Kullanıcı CRM', icon: Users, badge: null },
            { id: 'payments', label: 'Altın Siparişleri', icon: CreditCard, badge: pendingPaymentCount },
            { id: 'withdrawals', label: 'Para Çekimleri', icon: DollarSign, badge: pendingWithdrawalCount },
            { id: 'live_rooms', label: 'Canlı Odalar', icon: Radio, badge: liveRooms.length },
            { id: 'broadcast', label: 'Sistem Duyuru', icon: Send, badge: null },
            { id: 'infra', label: 'Altyapı & Kota', icon: Cpu, badge: null },
            { id: 'audit', label: 'Hesap Ekstresi', icon: FileText, badge: null },
            { id: 'staff', label: 'Personel & Günlük', icon: Award, badge: null }
          ].map(tab => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarCollapsed ? 'center' : 'space-between',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: isActive ? (isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)') : 'transparent',
                  border: isActive ? `1px solid ${theme.borderLight}` : '1px solid transparent',
                  color: isActive ? theme.textPrimary : theme.textSecondary,
                  cursor: 'pointer',
                  fontWeight: isActive ? '700' : '500',
                  fontSize: '0.84rem',
                  transition: 'background 0.12s ease, color 0.12s ease'
                }}
                title={sidebarCollapsed ? tab.label : undefined}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <IconComponent size={18} color={isActive ? (isLight ? '#0284c7' : '#ffffff') : theme.textMuted} />
                  {!sidebarCollapsed && <span>{tab.label}</span>}
                </div>
                {!sidebarCollapsed && tab.badge !== null && tab.badge > 0 && (
                  <span style={{
                    background: tab.isDangerBadge ? '#ef4444' : (isLight ? '#e2e8f0' : '#1e2335'),
                    color: tab.isDangerBadge ? '#ffffff' : theme.textPrimary,
                    border: tab.isDangerBadge ? 'none' : `1px solid ${theme.border}`,
                    fontWeight: '700',
                    fontSize: '0.7rem',
                    padding: '2px 7px',
                    borderRadius: '6px'
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Alt Profil & Çıkış Kartı */}
        <div style={{
          padding: '12px 10px',
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 4px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: isLight ? '#f1f5f9' : '#161928',
                border: `1px solid ${theme.borderLight}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Lock size={15} color={theme.textSecondary} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: theme.textPrimary }}>
                  {activeModUser?.username || 'Yönetici'}
                </div>
                <div style={{ fontSize: '0.66rem', color: theme.textMuted, fontWeight: '600' }}>
                  {isSuperAdmin ? 'Süper Admin' : 'Moderatör'}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleLogoutPanel}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${theme.border}`,
              color: theme.textSecondary,
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <LogOut size={14} /> {!sidebarCollapsed && 'Oturumu Kapat'}
          </button>
        </div>
      </aside>

      {/* ========================================== */}
      {/* SAĞ ÇALIŞMA ALANI                          */}
      {/* ========================================== */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        
        {/* Üst Header Bar */}
        <header style={{
          padding: '14px 24px',
          background: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(12, 13, 21, 0.85)',
          borderBottom: `1px solid ${theme.border}`,
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 40
        }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: theme.textPrimary }}>
              {activeTab === 'dashboard' && 'Genel Bakış'}
              {activeTab === 'reports' && 'Şikayet Masası & Moderasyon'}
              {activeTab === 'users' && 'Kullanıcı Yönetimi (CRM)'}
              {activeTab === 'payments' && 'Altın Siparişleri'}
              {activeTab === 'withdrawals' && 'Para Çekim Talepleri'}
              {activeTab === 'live_rooms' && 'Canlı Odalar'}
              {activeTab === 'broadcast' && 'Sistem Duyuruları'}
              {activeTab === 'infra' && 'Altyapı & Kota Metrikleri'}
              {activeTab === 'audit' && 'Kullanıcı Hesap Ekstresi'}
              {activeTab === 'staff' && 'Personel & Denetim Günlüğü'}
            </h2>
            <div style={{ fontSize: '0.74rem', color: theme.textMuted, marginTop: '2px' }}>
              Pyngoo Realtime Platform Denetim Sistemi
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Canlı Bağlantı Durumu */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 10px', borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.72rem', color: '#10b981', fontWeight: '700'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              CANLI
            </div>

            {/* Tema Değiştirici (Dark / Light) */}
            <button
              onClick={toggleTheme}
              style={{
                padding: '7px 12px', borderRadius: '6px',
                background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${theme.borderLight}`,
                color: theme.textPrimary, fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: theme.shadow
              }}
              title={isLight ? 'Karanlık Moda Geç' : 'Aydınlık Moda Geç'}
            >
              {isLight ? <Moon size={13} /> : <Sun size={13} />}
              <span>{isLight ? 'Koyu Mod' : 'Açık Mod'}</span>
            </button>

            {/* Yenile Butonu */}
            <button
              onClick={refreshAllData}
              style={{
                padding: '7px 12px', borderRadius: '6px',
                background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${theme.borderLight}`,
                color: theme.textPrimary, fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <RefreshCw size={13} /> Yenile
            </button>
          </div>
        </header>

        {/* Canlı Bildirim / Toast Çubuğu */}
        {actionMessage && (
          <div style={{
            margin: '14px 24px 0 24px',
            padding: '10px 16px',
            borderRadius: '8px',
            background: isLight ? '#f1f5f9' : '#141726',
            border: `1px solid ${theme.border}`,
            color: theme.textPrimary,
            fontWeight: '600',
            fontSize: '0.84rem'
          }}>
            {actionMessage}
          </div>
        )}

        {/* ========================================== */}
        {/* SEKME İÇERİKLERİ                           */}
        {/* ========================================== */}
        <div style={{ padding: '20px 24px', flex: 1 }}>

          {/* ------------------------------------------ */}
          {/* TAB 1: DASHBOARD (GENEL BAKIŞ)            */}
          {/* ------------------------------------------ */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Canlı KPI Sayaç Kartları */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                
                {/* Toplam Kullanıcı */}
                <div style={{
                  background: theme.cardBg, padding: '18px', borderRadius: '12px',
                  border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '6px',
                  boxShadow: theme.shadow
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: theme.textSecondary, fontSize: '0.78rem', fontWeight: '600' }}>
                    <span>Toplam Kullanıcı</span>
                    <Users size={16} color={theme.textMuted} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: theme.textPrimary }}>
                    {allUsersList.length > 0 ? allUsersList.length.toLocaleString() : '...'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: theme.textMuted }}>
                    {allUsersList.filter(u => u.gender === 'kadin').length} Kadın • {allUsersList.filter(u => u.gender === 'erkek').length} Erkek
                  </div>
                </div>

                {/* Bekleyen Şikayetler */}
                <div 
                  onClick={() => setActiveTab('reports')}
                  style={{
                    background: theme.cardBg,
                    padding: '18px', borderRadius: '12px',
                    border: pendingReportCount > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : `1px solid ${theme.border}`,
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px',
                    boxShadow: theme.shadow
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: pendingReportCount > 0 ? '#ef4444' : theme.textSecondary, fontSize: '0.78rem', fontWeight: '600' }}>
                    <span>Bekleyen Şikayetler</span>
                    <ShieldAlert size={16} color={pendingReportCount > 0 ? '#ef4444' : theme.textMuted} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: pendingReportCount > 0 ? '#ef4444' : theme.textPrimary }}>
                    {pendingReportCount}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: theme.textMuted }}>
                    İnceleme bekleyen şikayetler
                  </div>
                </div>

                {/* Bekleyen Para Çekimleri */}
                <div 
                  onClick={() => setActiveTab('withdrawals')}
                  style={{
                    background: theme.cardBg,
                    padding: '18px', borderRadius: '12px',
                    border: pendingWithdrawalCount > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : `1px solid ${theme.border}`,
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px',
                    boxShadow: theme.shadow
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: pendingWithdrawalCount > 0 ? '#f59e0b' : theme.textSecondary, fontSize: '0.78rem', fontWeight: '600' }}>
                    <span>Bekleyen Çekimler</span>
                    <DollarSign size={16} color={pendingWithdrawalCount > 0 ? '#f59e0b' : theme.textMuted} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: pendingWithdrawalCount > 0 ? '#f59e0b' : theme.textPrimary }}>
                    {pendingWithdrawalCount}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: theme.textMuted }}>
                    {withdrawalSums(withdrawals.filter(w => w.status === 'pending'))}
                  </div>
                </div>

                {/* Bekleyen Altın Siparişleri */}
                <div 
                  onClick={() => setActiveTab('payments')}
                  style={{
                    background: theme.cardBg,
                    padding: '18px', borderRadius: '12px',
                    border: pendingPaymentCount > 0 ? '1px solid rgba(16, 185, 129, 0.4)' : `1px solid ${theme.border}`,
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px',
                    boxShadow: theme.shadow
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: pendingPaymentCount > 0 ? '#10b981' : theme.textSecondary, fontSize: '0.78rem', fontWeight: '600' }}>
                    <span>Altın Siparişleri</span>
                    <CreditCard size={16} color={pendingPaymentCount > 0 ? '#10b981' : theme.textMuted} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: pendingPaymentCount > 0 ? '#10b981' : theme.textPrimary }}>
                    {pendingPaymentCount}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: theme.textMuted }}>
                    Havale/EFT & Kripto Onayı
                  </div>
                </div>

                {/* Canlı Yayınlar / Odalar */}
                <div 
                  onClick={() => setActiveTab('live_rooms')}
                  style={{
                    background: theme.cardBg, padding: '18px', borderRadius: '12px',
                    border: `1px solid ${theme.border}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px',
                    boxShadow: theme.shadow
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: theme.textSecondary, fontSize: '0.78rem', fontWeight: '600' }}>
                    <span>Aktif Canlı Odalar</span>
                    <Radio size={16} color={theme.textMuted} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: theme.textPrimary }}>
                    {liveRooms.length}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: theme.textMuted }}>
                    {waitingRoomCount} eşleşme bekleyen kullanıcı
                  </div>
                </div>
              </div>

              {/* Canlı Kullanıcı & Ekonomi Takip Bannerları */}
              <LiveRealAnalyticsBanner isAdmin={isAdmin} isLight={theme.isLight} />
              <EconomyHealthBanner isAdmin={isAdmin} isLight={theme.isLight} />

              {/* Hızlı İşlem Masası */}
              <div style={{
                background: theme.cardBg, padding: '18px 20px', borderRadius: '12px',
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadow
              }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px', color: theme.textPrimary }}>
                  <Sparkles size={16} color={theme.textMuted} /> Hızlı İşlemler
                </h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setActiveTab('reports')}
                    style={{
                      padding: '8px 14px', borderRadius: '8px',
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                      color: '#ef4444', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer'
                    }}
                  >
                    Şikayetleri İncele ({pendingReportCount})
                  </button>
                  <button
                    onClick={() => setActiveTab('withdrawals')}
                    style={{
                      padding: '8px 14px', borderRadius: '8px',
                      background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                      color: '#d97706', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer'
                    }}
                  >
                    Çekim Taleplerini Gör ({pendingWithdrawalCount})
                  </button>
                  <button
                    onClick={() => setActiveTab('payments')}
                    style={{
                      padding: '8px 14px', borderRadius: '8px',
                      background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                      color: '#059669', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer'
                    }}
                  >
                    Altın Siparişlerini Onayla ({pendingPaymentCount})
                  </button>
                  <button
                    onClick={() => setActiveTab('broadcast')}
                    style={{
                      padding: '8px 14px', borderRadius: '8px',
                      background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${theme.border}`,
                      color: theme.textPrimary, fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer'
                    }}
                  >
                    Sistem Duyurusu Yayınla
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------ */}
          {/* TAB 2: ŞİKAYET & MODERASYON MASASI         */}
          {/* ------------------------------------------ */}
          {activeTab === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Filtre ve Üst Kontroller */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { id: 'pending', label: `Bekleyenler (${pendingReportCount})` },
                    { id: 'banned', label: 'Yasaklananlar' },
                    { id: 'resolved', label: 'Çözülenler' },
                    { id: 'dismissed', label: 'Asılsız Arşiv' },
                    { id: 'all', label: 'Tümü' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setReportFilter(f.id as any)}
                      style={{
                        padding: '7px 12px', borderRadius: '8px',
                        background: reportFilter === f.id ? (isLight ? '#0f172a' : '#272b3b') : (isLight ? '#ffffff' : 'rgba(255,255,255,0.03)'),
                        border: reportFilter === f.id ? `1px solid ${theme.borderLight}` : `1px solid ${theme.border}`,
                        color: reportFilter === f.id ? '#ffffff' : theme.textSecondary,
                        fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => exportToCSV('pyngoo_sikayetler', reports)}
                  style={{
                    padding: '7px 12px', borderRadius: '8px',
                    background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)', border: `1px solid ${theme.border}`,
                    color: theme.textPrimary, fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Download size={13} /> CSV İndir
                </button>
              </div>

              {/* Şikayet Listesi */}
              {loadingReports ? (
                <div style={{ padding: '60px', textAlign: 'center', color: theme.textSecondary }}>Şikayetler yükleniyor...</div>
              ) : reports.filter(r => reportFilter === 'all' || r.status === reportFilter).length === 0 ? (
                <div style={{
                  padding: '60px', textAlign: 'center', background: theme.cardBg,
                  borderRadius: '12px', border: `1px solid ${theme.border}`,
                  boxShadow: theme.shadow
                }}>
                  <ShieldCheck size={40} color="#10b981" style={{ margin: '0 auto 10px auto' }} />
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: theme.textPrimary }}>Bu kategoride bekleyen şikayet yok!</div>
                  <div style={{ fontSize: '0.78rem', color: theme.textMuted, marginTop: '4px' }}>Platform tertemiz ve güvenli.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {reports
                    .filter(r => reportFilter === 'all' || r.status === reportFilter)
                    .map(r => (
                      <div
                        key={r.id}
                        style={{
                          background: theme.cardBg,
                          padding: '16px 20px', borderRadius: '12px',
                          border: r.status === 'pending' ? '1px solid rgba(239, 68, 68, 0.4)' : `1px solid ${theme.border}`,
                          boxShadow: theme.shadow,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                          {/* Kanıt Görseli Varsa Önizleme */}
                          {r.snapshot_data ? (
                            <div
                              onClick={() => setPreviewImage(r.snapshot_data!)}
                              style={{
                                width: '56px', height: '56px', borderRadius: '8px',
                                overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(239, 68, 68, 0.4)',
                                position: 'relative'
                              }}
                            >
                              <img src={r.snapshot_data} alt="Kanıt" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <div style={{
                                position: 'absolute', bottom: 0, width: '100%', background: 'rgba(0,0,0,0.7)',
                                fontSize: '0.54rem', textAlign: 'center', color: '#f87171', fontWeight: '700'
                              }}>KANIT</div>
                            </div>
                          ) : (
                            <div style={{
                              width: '48px', height: '48px', borderRadius: '8px',
                              background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <AlertTriangle size={20} color="#ef4444" />
                            </div>
                          )}

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.92rem', fontWeight: '700', color: theme.textPrimary }}>
                                Şikayet Edilen: @{r.reported_name}
                              </span>
                              <span style={{
                                padding: '2px 7px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: '700',
                                background: r.status === 'pending' ? 'rgba(239, 68, 68, 0.15)' : r.status === 'banned' ? '#7f1d1d' : 'rgba(16, 185, 129, 0.15)',
                                color: r.status === 'pending' ? '#ef4444' : r.status === 'banned' ? '#fca5a5' : '#10b981'
                              }}>
                                {r.status === 'pending' ? 'BEKLİYOR' : r.status === 'banned' ? 'YASAKLANDI' : 'ÇÖZÜLDÜ'}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '3px', fontWeight: '600' }}>
                              Sebep: {r.category || r.reason || 'Kural İhlali'}
                            </div>

                            <div style={{ fontSize: '0.72rem', color: theme.textMuted, marginTop: '3px' }}>
                              Şikayet Eden: @{r.reporter_name} • {new Date(r.created_at).toLocaleString('tr-TR')}
                            </div>
                          </div>
                        </div>

                        {/* Aksiyon Butonları */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {r.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleBanUserFromReport(r)}
                                style={{
                                  padding: '8px 14px', borderRadius: '8px',
                                  background: '#ef4444', border: 'none',
                                  color: '#fff', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
                                }}
                              >
                                Kullanıcıyı Banla
                              </button>
                              <button
                                onClick={() => handleResolveReport(r.id)}
                                style={{
                                  padding: '8px 12px', borderRadius: '8px',
                                  background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
                                  color: '#10b981', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
                                }}
                              >
                                Çözüldü
                              </button>
                              <button
                                onClick={() => handleDismissReport(r.id)}
                                style={{
                                  padding: '8px 12px', borderRadius: '8px',
                                  background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)',
                                  border: `1px solid ${theme.border}`,
                                  color: theme.textSecondary, fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer'
                                }}
                              >
                                Asılsız
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------ */}
          {/* TAB 3: KULLANICI YÖNETİMİ & CRM            */}
          {/* ------------------------------------------ */}
          {activeTab === 'users' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Arama ve Filtreleme */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '260px' }}>
                  <div style={{
                    position: 'relative', width: '100%', maxWidth: '340px'
                  }}>
                    <Search size={15} color={theme.textMuted} style={{ position: 'absolute', left: '12px', top: '11px' }} />
                    <input
                      type="text"
                      placeholder="Rumuz, ID veya Cihaz Kimliği ara..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      style={{
                        width: '100%', padding: '9px 12px 9px 34px', borderRadius: '8px',
                        background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
                        color: theme.textPrimary, fontSize: '0.84rem', outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '5px' }}>
                    {[
                      { id: 'all', label: 'Tümü' },
                      { id: 'female', label: 'Kadınlar' },
                      { id: 'male', label: 'Erkekler' },
                      { id: 'banned', label: 'Yasaklılar' },
                      { id: 'moderator', label: 'Yetkililer' }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setUserRoleFilter(f.id as any)}
                        style={{
                          padding: '6px 11px', borderRadius: '7px',
                          background: userRoleFilter === f.id ? (isLight ? '#0f172a' : '#272b3b') : (isLight ? '#ffffff' : 'rgba(255,255,255,0.03)'),
                          border: userRoleFilter === f.id ? `1px solid ${theme.borderLight}` : `1px solid ${theme.border}`,
                          color: userRoleFilter === f.id ? '#ffffff' : theme.textSecondary,
                          fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer'
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => exportToCSV('pyngoo_kullanicilar', allUsersList)}
                  style={{
                    padding: '7px 12px', borderRadius: '8px',
                    background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)', border: `1px solid ${theme.border}`,
                    color: theme.textPrimary, fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Download size={13} /> Dışa Aktar (CSV)
                </button>
              </div>

              {/* Kullanıcı Tablosu */}
              {loadingUsers ? (
                <div style={{ padding: '40px', textAlign: 'center', color: theme.textSecondary }}>Kullanıcılar yükleniyor...</div>
              ) : (
              <div style={{
                background: theme.cardBg, borderRadius: '12px',
                border: `1px solid ${theme.border}`, overflow: 'hidden',
                boxShadow: theme.shadow
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: theme.tableHeaderBg, borderBottom: `1px solid ${theme.border}`, color: theme.textMuted }}>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>KULLANICI</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>CİNSİYET & DOĞRULAMA</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>BAKİYE</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>ROL</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>KAYIT TARİHİ</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px', textAlign: 'right' }}>İŞLEMLER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsersList
                      .filter(u => {
                        const q = userSearchQuery.toLowerCase();
                        const matchQ = (u.display_name || '').toLowerCase().includes(q) || (u.id || '').toLowerCase().includes(q);
                        if (!matchQ) return false;
                        if (userRoleFilter === 'female') return u.gender === 'kadin';
                        if (userRoleFilter === 'male') return u.gender === 'erkek';
                        if (userRoleFilter === 'banned') return u.is_banned;
                        if (userRoleFilter === 'moderator') return u.is_moderator || u.role === 'moderator' || u.role === 'admin';
                        return true;
                      })
                      .slice(0, 100)
                      .map(u => (
                        <tr key={u.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '32px', height: '32px', borderRadius: '8px',
                                background: isLight ? '#f1f5f9' : '#1a1d2e',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: '700', fontSize: '0.8rem', color: theme.textSecondary
                              }}>
                                {(u.display_name || '?')[0].toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: '700', color: u.is_banned ? '#ef4444' : theme.textPrimary }}>
                                  @{u.display_name} {u.is_banned && '(YASAKLI)'}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: theme.textMuted, fontFamily: 'monospace' }}>
                                  {u.id.slice(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px', color: theme.textPrimary }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{u.gender === 'kadin' ? '👩 Kadın' : '👨 Erkek'}</span>
                              {u.gender === 'kadin' && (
                                <span style={{
                                  fontSize: '0.65rem', padding: '2px 5px', borderRadius: '4px',
                                  background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)',
                                  color: theme.textSecondary, fontWeight: '700',
                                  border: `1px solid ${theme.border}`
                                }}>
                                  AI DOĞRULANDI
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: '700', color: '#eab308' }}>
                              🪙 {Number(u.total_gold || 0).toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: theme.textSecondary, marginTop: '2px' }}>
                              💎 {Number(u.total_diamonds || 0).toLocaleString()}
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '2px 7px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: '700',
                              background: u.role === 'admin' ? 'rgba(239,68,68,0.15)' : u.is_moderator ? 'rgba(99,102,241,0.15)' : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)'),
                              color: u.role === 'admin' ? '#ef4444' : u.is_moderator ? '#6366f1' : theme.textSecondary
                            }}>
                              {u.role === 'admin' ? 'ADMIN' : u.is_moderator ? 'MODERATÖR' : 'ÜYE'}
                            </span>
                          </td>

                          <td style={{ padding: '12px 16px', color: theme.textMuted, fontSize: '0.76rem' }}>
                            {u.created_at ? new Date(u.created_at).toLocaleDateString('tr-TR') : '-'}
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => handleAdjustBalance(u)}
                                title="Bakiye Ekle/Çıkar"
                                style={{
                                  padding: '5px 9px', borderRadius: '6px',
                                  background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)',
                                  border: `1px solid ${theme.border}`,
                                  color: theme.textPrimary, fontWeight: '600', fontSize: '0.72rem', cursor: 'pointer'
                                }}
                              >
                                Bakiye
                              </button>

                              <button
                                onClick={() => handleToggleBanUser(u)}
                                title={u.is_banned ? 'Yasağı Kaldır' : 'Kullanıcıyı Yasakla'}
                                style={{
                                  padding: '5px 9px', borderRadius: '6px',
                                  background: u.is_banned ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                  border: u.is_banned ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
                                  color: u.is_banned ? '#10b981' : '#ef4444',
                                  fontWeight: '600', fontSize: '0.72rem', cursor: 'pointer'
                                }}
                              >
                                {u.is_banned ? 'Yasağı Aç' : 'Yasakla'}
                              </button>

                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteUserProfile(u)}
                                  title="Profili Kalıcı Sil (Rumuz Boşa Çıkar)"
                                  style={{
                                    padding: '5px 7px', borderRadius: '6px',
                                    background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${theme.border}`,
                                    color: theme.textMuted, cursor: 'pointer'
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}

          {/* ------------------------------------------ */}
          {/* TAB 4: ALTIN SİPARİŞLERİ                   */}
          {/* ------------------------------------------ */}
          {activeTab === 'payments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {[
                    { id: 'pending', label: `Bekleyenler (${pendingPaymentCount})` },
                    { id: 'approved', label: 'Onaylananlar' },
                    { id: 'rejected', label: 'Reddedilenler' },
                    { id: 'all', label: 'Tümü' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setPaymentFilter(f.id as any)}
                      style={{
                        padding: '7px 12px', borderRadius: '8px',
                        background: paymentFilter === f.id ? (isLight ? '#0f172a' : '#272b3b') : (isLight ? '#ffffff' : 'rgba(255,255,255,0.03)'),
                        border: paymentFilter === f.id ? `1px solid ${theme.borderLight}` : `1px solid ${theme.border}`,
                        color: paymentFilter === f.id ? '#ffffff' : theme.textSecondary,
                        fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}

                  <input
                    type="text"
                    placeholder="Sipariş kodu veya kullanıcı ara..."
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    style={{
                      padding: '7px 11px', borderRadius: '8px',
                      background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
                      color: theme.textPrimary, fontSize: '0.82rem', outline: 'none'
                    }}
                  />
                </div>

                <button
                  onClick={() => exportToCSV('pyngoo_altin_siparisleri', paymentOrders)}
                  style={{
                    padding: '7px 12px', borderRadius: '8px',
                    background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)', border: `1px solid ${theme.border}`,
                    color: theme.textPrimary, fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Download size={13} /> Dışa Aktar (CSV)
                </button>
              </div>

              {loadingPayments ? (
                <div style={{ padding: '40px', textAlign: 'center', color: theme.textSecondary }}>Siparişler yükleniyor...</div>
              ) : (
              <div style={{
                background: theme.cardBg, borderRadius: '12px',
                border: `1px solid ${theme.border}`, overflow: 'hidden',
                boxShadow: theme.shadow
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: theme.tableHeaderBg, borderBottom: `1px solid ${theme.border}`, color: theme.textMuted }}>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>SİPARİŞ KODU</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>KULLANICI</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>YÖNTEM & TUTAR</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>YÜKLENECEK ALTIN</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>DURUM</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px', textAlign: 'right' }}>AKSİYON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentOrders
                      .filter(p => {
                        if (paymentFilter !== 'all' && p.status !== paymentFilter) return false;
                        if (paymentSearch.trim()) {
                          const s = paymentSearch.toLowerCase();
                          return (p.order_code || '').toLowerCase().includes(s) || (p.user_name || '').toLowerCase().includes(s);
                        }
                        return true;
                      })
                      .map(p => (
                        <tr key={p.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: '700', color: theme.textSecondary }}>
                            {p.order_code}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: '700', color: theme.textPrimary }}>@{p.user_name}</div>
                            {p.sender_name && (
                              <div style={{ fontSize: '0.72rem', color: theme.textMuted }}>Gönderen: {p.sender_name}</div>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: '700', color: theme.textPrimary }}>{p.price_text}</div>
                            <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>{p.payment_method.toUpperCase()}</div>
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: '800', color: '#eab308' }}>🪙 {p.total_gold.toLocaleString()} Altın</div>
                            {p.bonus_amount > 0 && (
                              <div style={{ fontSize: '0.7rem', color: '#10b981' }}>+{p.bonus_amount.toLocaleString()} Bonus</div>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '2px 7px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: '700',
                              background: p.status === 'pending' ? 'rgba(245, 158, 11, 0.15)' : p.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: p.status === 'pending' ? '#f59e0b' : p.status === 'approved' ? '#10b981' : '#ef4444'
                            }}>
                              {p.status === 'pending' ? 'ONAY BEKLİYOR' : p.status === 'approved' ? 'YÜKLENDİ' : 'REDDEDİLDİ'}
                            </span>
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            {p.status === 'pending' && (
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  onClick={() => handleApprovePayment(p)}
                                  style={{
                                    padding: '6px 12px', borderRadius: '6px',
                                    background: isLight ? '#0f172a' : '#fff', border: 'none',
                                    color: isLight ? '#fff' : '#090a10', fontWeight: '700', fontSize: '0.76rem', cursor: 'pointer'
                                  }}
                                >
                                  Onayla
                                </button>
                                <button
                                  onClick={() => handleRejectPayment(p)}
                                  style={{
                                    padding: '6px 10px', borderRadius: '6px',
                                    background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)',
                                    color: '#ef4444', fontWeight: '600', fontSize: '0.76rem', cursor: 'pointer'
                                  }}
                                >
                                  Reddet
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}

          {/* ------------------------------------------ */}
          {/* TAB 5: YAYINCI PARA ÇEKİM TALEPLERİ        */}
          {/* ------------------------------------------ */}
          {activeTab === 'withdrawals' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {[
                    { id: 'pending', label: `Bekleyenler (${pendingWithdrawalCount})` },
                    { id: 'approved', label: 'Onaylandı (Yatırımda)' },
                    { id: 'completed', label: 'Tamamlandı (Yatırıldı)' },
                    { id: 'rejected', label: 'Reddedildi' },
                    { id: 'all', label: 'Tümü' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setWithdrawalFilter(f.id as any)}
                      style={{
                        padding: '7px 12px', borderRadius: '8px',
                        background: withdrawalFilter === f.id ? (isLight ? '#0f172a' : '#272b3b') : (isLight ? '#ffffff' : 'rgba(255,255,255,0.03)'),
                        border: withdrawalFilter === f.id ? `1px solid ${theme.borderLight}` : `1px solid ${theme.border}`,
                        color: withdrawalFilter === f.id ? '#ffffff' : theme.textSecondary,
                        fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}

                  <input
                    type="text"
                    placeholder="Yayıncı adı veya IBAN ara..."
                    value={withdrawalSearch}
                    onChange={(e) => setWithdrawalSearch(e.target.value)}
                    style={{
                      padding: '7px 11px', borderRadius: '8px',
                      background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
                      color: theme.textPrimary, fontSize: '0.82rem', outline: 'none'
                    }}
                  />
                </div>

                <button
                  onClick={() => exportToCSV('pyngoo_cekim_talepleri', withdrawals)}
                  style={{
                    padding: '7px 12px', borderRadius: '8px',
                    background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)', border: `1px solid ${theme.border}`,
                    color: theme.textPrimary, fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Download size={13} /> Dışa Aktar (CSV)
                </button>
              </div>

              {/* Çekim Tablosu */}
              {loadingWithdrawals ? (
                <div style={{ padding: '40px', textAlign: 'center', color: theme.textSecondary }}>Çekim talepleri yükleniyor...</div>
              ) : (
              <div style={{
                background: theme.cardBg, borderRadius: '12px',
                border: `1px solid ${theme.border}`, overflow: 'hidden',
                boxShadow: theme.shadow
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: theme.tableHeaderBg, borderBottom: `1px solid ${theme.border}`, color: theme.textMuted }}>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>YAYINCI</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>ÇEKİLEN ELMAS</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>ÖDENECEK TUTAR</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>IBAN / HESAP</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px' }}>DURUM</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.5px', textAlign: 'right' }}>AKSİYON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals
                      .filter(w => {
                        if (withdrawalFilter !== 'all' && w.status !== withdrawalFilter) return false;
                        if (withdrawalSearch.trim()) {
                          const s = withdrawalSearch.toLowerCase();
                          return (w.full_name || '').toLowerCase().includes(s) ||
                            (w.profile_name || '').toLowerCase().includes(s) ||
                            (w.iban || '').toLowerCase().includes(s);
                        }
                        return true;
                      })
                      .map(w => (
                        <tr key={w.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: '700', color: theme.textPrimary }}>{w.full_name}</div>
                            <div style={{ fontSize: '0.72rem', color: theme.textSecondary }}>@{w.profile_name}</div>
                          </td>

                          <td style={{ padding: '12px 16px', fontWeight: '700', color: theme.textSecondary }}>
                            💎 {Number(w.amount_diamonds || 0).toLocaleString()} Elmas
                          </td>

                          <td style={{ padding: '12px 16px', fontWeight: '800', color: '#10b981', fontSize: '0.92rem' }}>
                            {withdrawalMoney(w)}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: '600', color: theme.textPrimary }}>{w.iban}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(w.iban);
                                  setCopiedIbanId(w.id);
                                  setTimeout(() => setCopiedIbanId(null), 2000);
                                }}
                                style={{
                                  background: 'transparent', border: 'none', color: copiedIbanId === w.id ? '#10b981' : theme.textMuted,
                                  cursor: 'pointer'
                                }}
                                title="IBAN Kopyala"
                              >
                                {copiedIbanId === w.id ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '2px 7px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: '700',
                              background: w.status === 'pending' ? 'rgba(245, 158, 11, 0.15)' : w.status === 'approved' ? 'rgba(99, 102, 241, 0.15)' : w.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: w.status === 'pending' ? '#f59e0b' : w.status === 'approved' ? '#6366f1' : w.status === 'completed' ? '#10b981' : '#ef4444'
                            }}>
                              {w.status === 'pending' ? 'TALEP GELDİ' : w.status === 'approved' ? 'YATIRIM AŞAMASINDA' : w.status === 'completed' ? 'YATIRILDI' : 'REDDEDİLDİ'}
                            </span>
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              {w.status === 'pending' && (
                                <button
                                  onClick={() => handleApproveWithdrawal(w)}
                                  style={{
                                    padding: '6px 11px', borderRadius: '6px',
                                    background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)',
                                    color: '#6366f1', fontWeight: '700', fontSize: '0.76rem', cursor: 'pointer'
                                  }}
                                >
                                  Onayla
                                </button>
                              )}

                              {(w.status === 'pending' || w.status === 'approved') && (
                                <button
                                  onClick={() => handleCompleteWithdrawal(w)}
                                  style={{
                                    padding: '6px 11px', borderRadius: '6px',
                                    background: '#10b981', border: 'none',
                                    color: '#ffffff', fontWeight: '700', fontSize: '0.76rem', cursor: 'pointer'
                                  }}
                                >
                                  Yatırıldı Yap
                                </button>
                              )}

                              {w.status === 'pending' && (
                                <button
                                  onClick={() => handleRejectWithdrawal(w)}
                                  style={{
                                    padding: '6px 9px', borderRadius: '6px',
                                    background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)',
                                    color: '#ef4444', fontWeight: '600', fontSize: '0.76rem', cursor: 'pointer'
                                  }}
                                >
                                  Reddet
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}

          {/* ------------------------------------------ */}
          {/* TAB 6: CANLI ODALAR & YAYINLAR             */}
          {/* ------------------------------------------ */}
          {activeTab === 'live_rooms' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                background: theme.cardBg, padding: '16px 20px', borderRadius: '12px',
                border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: theme.shadow
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: theme.textPrimary }}>
                    Canlı Yayın Presence Kanalı (pyngoo_live_rooms_directory)
                  </h3>
                  <div style={{ fontSize: '0.76rem', color: theme.textMuted, marginTop: '3px' }}>
                    Şu anda canlı yayın yapan kullanıcılar presence üzerinden sıfır veritabanı yüküyle anlık izleniyor.
                  </div>
                </div>
                <div style={{
                  padding: '6px 12px', borderRadius: '8px', background: isLight ? '#f1f5f9' : '#1e2438', color: theme.textSecondary,
                  fontWeight: '700', fontSize: '0.8rem', border: `1px solid ${theme.border}`
                }}>
                  {liveRooms.length} Aktif Yayıncı
                </div>
              </div>

              {liveRooms.length === 0 ? (
                <div style={{
                  padding: '50px', textAlign: 'center', background: theme.cardBg,
                  borderRadius: '12px', border: `1px solid ${theme.border}`,
                  boxShadow: theme.shadow
                }}>
                  <Radio size={40} color={theme.textMuted} style={{ margin: '0 auto 10px auto' }} />
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', color: theme.textPrimary }}>Şu anda açık canlı oda bulunmuyor.</div>
                  <div style={{ fontSize: '0.78rem', color: theme.textMuted, marginTop: '4px' }}>
                    Yayıncı kadınlar yayına başladığında burada anlık listelenecektir.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
                  {liveRooms.map(room => (
                    <div
                      key={room.id}
                      style={{
                        background: theme.cardBg, padding: '16px', borderRadius: '12px',
                        border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '10px',
                        boxShadow: theme.shadow
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '44px', height: '44px', borderRadius: '10px',
                          background: isLight ? '#f1f5f9' : '#1a1d2e',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '700', fontSize: '1rem', color: theme.textSecondary
                        }}>
                          {room.avatar ? (
                            <img src={room.avatar} alt={room.name} style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover' }} />
                          ) : (
                            room.name[0].toUpperCase()
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.92rem', fontWeight: '700', color: theme.textPrimary }}>@{room.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: '#10b981', fontWeight: '600' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                            YAYINDA (CANLI)
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.7rem', color: theme.textMuted, fontFamily: 'monospace' }}>
                        Oda ID: {room.id}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------ */}
          {/* TAB 7: SİSTEM DUYURU & BİLDİRİM MASASI     */}
          {/* ------------------------------------------ */}
          {activeTab === 'broadcast' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '800px' }}>
              <div style={{
                background: theme.cardBg, padding: '20px 22px', borderRadius: '12px',
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadow
              }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: theme.textPrimary }}>
                  <Send size={16} color={theme.textSecondary} /> Yeni Sistem Duyurusu Fırlat
                </h3>

                <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', color: theme.textSecondary, marginBottom: '6px', fontWeight: '600' }}>
                      Hedef Kitle:
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[
                        { id: 'all', label: 'Tüm Kullanıcılar' },
                        { id: 'female', label: 'Sadece Kadınlar / Yayıncılar' },
                        { id: 'male', label: 'Sadece Erkekler' }
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setBroadcastTarget(t.id as any)}
                          style={{
                            padding: '7px 12px', borderRadius: '8px',
                            background: broadcastTarget === t.id ? (isLight ? '#0f172a' : '#272b3b') : (isLight ? '#ffffff' : 'rgba(255,255,255,0.03)'),
                            border: broadcastTarget === t.id ? `1px solid ${theme.borderLight}` : `1px solid ${theme.border}`,
                            color: broadcastTarget === t.id ? '#ffffff' : theme.textSecondary,
                            fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer'
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', color: theme.textSecondary, marginBottom: '6px', fontWeight: '600' }}>
                      Duyuru Başlığı:
                    </label>
                    <input
                      type="text"
                      placeholder="Örnek: Bu Gece 21:00'de Hediye Festivali Başlıyor! 🎉"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                        background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
                        color: theme.textPrimary, fontSize: '0.86rem', outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', color: theme.textSecondary, marginBottom: '6px', fontWeight: '600' }}>
                      Duyuru Metni:
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Kullanıcılara iletilecek mesajı yazın..."
                      value={broadcastContent}
                      onChange={(e) => setBroadcastContent(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                        background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
                        color: theme.textPrimary, fontSize: '0.86rem', outline: 'none', resize: 'vertical'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      padding: '11px', borderRadius: '8px',
                      background: isLight ? '#0f172a' : '#fff',
                      border: 'none', color: isLight ? '#fff' : '#090a10', fontWeight: '700', fontSize: '0.88rem',
                      cursor: 'pointer'
                    }}
                  >
                    Duyuruyu Şimdi Yayınla
                  </button>
                </form>
              </div>

              {/* Geçmiş Duyurular */}
              <div style={{
                background: theme.cardBg, padding: '18px 20px', borderRadius: '12px',
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadow
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', fontWeight: '700', color: theme.textPrimary }}>Geçmiş Duyurular</h4>
                {broadcastHistory.length === 0 ? (
                  <div style={{ color: theme.textMuted, fontSize: '0.78rem' }}>Henüz geçmiş duyuru kaydı yok.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {broadcastHistory.map(b => (
                      <div key={b.id} style={{
                        padding: '10px 14px', borderRadius: '8px', background: theme.cardHeaderBg,
                        border: `1px solid ${theme.border}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '700', color: theme.textPrimary, fontSize: '0.84rem' }}>{b.title}</span>
                          <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>
                            {new Date(b.sent_at).toLocaleString('tr-TR')}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '3px' }}>
                          {b.content}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '5px' }}>
                          Hedef: {b.target.toUpperCase()} • Gönderen: {b.sent_by}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ------------------------------------------ */}
          {/* TAB 8: ALTYAPI, KOTA & METRİKLER           */}
          {/* ------------------------------------------ */}
          {activeTab === 'infra' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {quotaLoading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: theme.textSecondary }}>Altyapı metrikleri sorgulanıyor...</div>
              ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                {/* Supabase Kartı */}
                <div style={{
                  background: theme.cardBg, padding: '20px', borderRadius: '12px',
                  border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '12px',
                  boxShadow: theme.shadow
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', color: '#10b981', fontSize: '0.92rem' }}>⚡ Supabase Veritabanı</span>
                    <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>Ücretsiz Kota: 500 MB</span>
                  </div>

                  <div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '800', color: theme.textPrimary }}>
                      {quotaMetrics?.supabase?.dbMb !== null && quotaMetrics?.supabase?.dbMb !== undefined ? `${quotaMetrics.supabase.dbMb} MB` : '...'}
                    </div>
                    <div style={{ width: '100%', height: '6px', background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)', borderRadius: '10px', marginTop: '6px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${quotaMetrics?.supabase?.dbPercent || 5}%`,
                        height: '100%', background: '#10b981'
                      }} />
                    </div>
                  </div>

                  <div style={{ fontSize: '0.76rem', color: theme.textSecondary, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div>👥 Toplam Profil: {quotaMetrics?.supabase?.profiles || 0}</div>
                    <div>💬 Mesajlar: {quotaMetrics?.supabase?.messages || 0}</div>
                    <div>📶 Ping Gecikmesi: {quotaMetrics?.supabase?.pingMs || 0} ms</div>
                  </div>
                </div>

                {/* Agora Dakikaları Kartı */}
                <div style={{
                  background: theme.cardBg, padding: '20px', borderRadius: '12px',
                  border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '12px',
                  boxShadow: theme.shadow
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', color: theme.textPrimary, fontSize: '0.92rem' }}>📹 Agora Ses & Video</span>
                    <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>Aylık Kota: 10.000 Dk</span>
                  </div>

                  <div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '800', color: theme.textPrimary }}>
                      {quotaMetrics?.agora?.totalMinutes !== undefined ? `${quotaMetrics.agora.totalMinutes} Dk` : '...'}
                    </div>
                    <div style={{ width: '100%', height: '6px', background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)', borderRadius: '10px', marginTop: '6px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${quotaMetrics?.agora?.percentUsed || 2}%`,
                        height: '100%', background: '#64748b'
                      }} />
                    </div>
                  </div>

                  <div style={{ fontSize: '0.76rem', color: theme.textSecondary, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div>🎙️ Ses Dakikaları: {quotaMetrics?.agora?.voiceMinutes || 0} Dk</div>
                    <div>🎥 Video Dakikaları: {quotaMetrics?.agora?.videoMinutes || 0} Dk</div>
                    <div>⏳ Kalan Ücretsiz Kota: {quotaMetrics?.agora?.remainingMinutes || 10000} Dk</div>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}

          {/* ------------------------------------------ */}
          {/* TAB 9: KULLANICI HESAP EKSTRESİ & DENETİM  */}
          {/* ------------------------------------------ */}
          {activeTab === 'audit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                background: theme.cardBg, padding: '16px 20px', borderRadius: '12px',
                border: `1px solid ${theme.border}`, display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap',
                boxShadow: theme.shadow
              }}>
                <input
                  type="text"
                  placeholder="Kullanıcı Rumuzu veya UUID..."
                  value={auditQuery}
                  onChange={(e) => setAuditQuery(e.target.value)}
                  style={{
                    padding: '9px 12px', borderRadius: '8px',
                    background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
                    color: theme.textPrimary, fontSize: '0.86rem', outline: 'none', flex: 1, minWidth: '220px'
                  }}
                />

                <input
                  type="date"
                  value={auditStartDate}
                  onChange={(e) => setAuditStartDate(e.target.value)}
                  style={{
                    padding: '9px 12px', borderRadius: '8px',
                    background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
                    color: theme.textPrimary, fontSize: '0.82rem', outline: 'none'
                  }}
                />

                <input
                  type="date"
                  value={auditEndDate}
                  onChange={(e) => setAuditEndDate(e.target.value)}
                  style={{
                    padding: '9px 12px', borderRadius: '8px',
                    background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
                    color: theme.textPrimary, fontSize: '0.82rem', outline: 'none'
                  }}
                />

                <button
                  onClick={handleFetchAuditReport}
                  style={{
                    padding: '9px 16px', borderRadius: '8px',
                    background: isLight ? '#0f172a' : '#fff', border: 'none',
                    color: isLight ? '#fff' : '#090a10', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer'
                  }}
                >
                  {auditLoading ? 'Aranıyor...' : 'Ekstre Çek'}
                </button>
              </div>

              {auditError && (
                <div style={{ color: '#ef4444', fontSize: '0.82rem', fontWeight: '600' }}>{auditError}</div>
              )}

              {auditUser && (
                <div style={{
                  background: theme.cardBg, padding: '16px 20px', borderRadius: '12px',
                  border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  boxShadow: theme.shadow
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: theme.textPrimary }}>@{auditUser.display_name}</h3>
                    <div style={{ fontSize: '0.74rem', color: theme.textMuted, marginTop: '3px' }}>
                      ID: {auditUser.id} • {auditUser.gender === 'kadin' ? 'Kadın Yayıncı' : 'Erkek Üye'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1rem', fontWeight: '700', color: '#eab308' }}>🪙 {auditUser.total_gold.toLocaleString()} Altın</div>
                    <div style={{ fontSize: '0.84rem', fontWeight: '600', color: theme.textSecondary }}>💎 {auditUser.total_diamonds.toLocaleString()} Elmas</div>
                  </div>
                </div>
              )}

              {auditItems.length > 0 && (
                <div style={{
                  background: theme.cardBg, borderRadius: '12px',
                  border: `1px solid ${theme.border}`, overflow: 'hidden',
                  boxShadow: theme.shadow
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: theme.tableHeaderBg, borderBottom: `1px solid ${theme.border}`, color: theme.textMuted }}>
                        <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: '700' }}>TARİH</th>
                        <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: '700' }}>İŞLEM TÜRÜ</th>
                        <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: '700' }}>MİKTAR</th>
                        <th style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: '700' }}>AÇIKLAMA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditItems.map((item, idx) => (
                        <tr key={item.id || idx} style={{ borderBottom: `1px solid ${theme.border}` }}>
                          <td style={{ padding: '10px 14px', color: theme.textMuted, fontSize: '0.76rem' }}>
                            {new Date(item.created_at).toLocaleString('tr-TR')}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: '700', color: theme.textPrimary }}>
                            {item.type || 'Transfer'}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: '700', color: item.amount > 0 ? '#10b981' : '#ef4444' }}>
                            {item.amount > 0 ? `+${item.amount}` : item.amount}
                          </td>
                          <td style={{ padding: '10px 14px', color: theme.textSecondary }}>
                            {item.description || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------ */}
          {/* TAB 10: PERSONEL & MODERATÖR YÖNETİMİ      */}
          {/* ------------------------------------------ */}
          {activeTab === 'staff' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Yeni Moderatör Ekleme */}
              {isAdmin && (
                <div style={{
                  background: theme.cardBg, padding: '18px 20px', borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.shadow
                }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: theme.textPrimary }}>
                    <Award size={16} color={theme.textSecondary} /> Yeni Moderatör Tanımla
                  </h3>
                  <form onSubmit={handleAssignModerator} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Moderatör yapılacak kullanıcının tam rumuzu..."
                      value={modUsernameInput}
                      onChange={(e) => setModUsernameInput(e.target.value)}
                      style={{
                        padding: '9px 12px', borderRadius: '8px',
                        background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
                        color: theme.textPrimary, fontSize: '0.86rem', outline: 'none', flex: 1, maxWidth: '380px'
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        padding: '9px 16px', borderRadius: '8px',
                        background: isLight ? '#0f172a' : '#fff', border: 'none',
                        color: isLight ? '#fff' : '#090a10', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer'
                      }}
                    >
                      Yetki Ver
                    </button>
                  </form>
                </div>
              )}

              {/* Moderatör Listesi */}
              {loadingMods ? (
                <div style={{ padding: '40px', textAlign: 'center', color: theme.textSecondary }}>Personel listesi yükleniyor...</div>
              ) : (
              <div style={{
                background: theme.cardBg, borderRadius: '12px',
                border: `1px solid ${theme.border}`, overflow: 'hidden',
                boxShadow: theme.shadow
              }}>
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${theme.border}`, fontWeight: '700', fontSize: '0.88rem', color: theme.textPrimary }}>
                  Yetkili Personel Listesi
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: theme.tableHeaderBg, borderBottom: `1px solid ${theme.border}`, color: theme.textMuted }}>
                      <th style={{ padding: '10px 16px', fontSize: '0.72rem', fontWeight: '700' }}>YETKİLİ</th>
                      <th style={{ padding: '10px 16px', fontSize: '0.72rem', fontWeight: '700' }}>ROL</th>
                      <th style={{ padding: '10px 16px', fontSize: '0.72rem', fontWeight: '700', textAlign: 'right' }}>İŞLEM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moderatorsList.map(mod => (
                      <tr key={mod.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: theme.textPrimary }}>
                          @{mod.display_name}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '2px 7px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: '700',
                            background: mod.role === 'admin' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
                            color: mod.role === 'admin' ? '#ef4444' : '#6366f1'
                          }}>
                            {mod.role === 'admin' ? 'SÜPER ADMİN' : 'MODERATÖR'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {isAdmin && mod.role !== 'admin' && (
                            <button
                              onClick={() => handleRevokeModerator(mod.id, mod.display_name)}
                              style={{
                                padding: '5px 10px', borderRadius: '6px',
                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                                color: '#ef4444', fontWeight: '600', fontSize: '0.74rem', cursor: 'pointer'
                              }}
                            >
                              Yetkiyi Geri Al
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}

              {/* Denetim Günlüğü */}
              <div style={{
                background: theme.cardBg, padding: '18px 20px', borderRadius: '12px',
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadow
              }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', fontWeight: '700', color: theme.textPrimary }}>Moderatör İşlem Günlüğü (Audit Trail)</h4>
                {auditLogsList.length === 0 ? (
                  <div style={{ color: theme.textMuted, fontSize: '0.78rem' }}>Henüz işlem kaydı bulunmuyor.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                    {auditLogsList.slice(0, 50).map(log => (
                      <div key={log.id} style={{
                        padding: '8px 12px', borderRadius: '8px', background: theme.cardHeaderBg,
                        border: `1px solid ${theme.border}`,
                        fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <span style={{ color: theme.textPrimary, fontWeight: '700' }}>[{log.moderator}]</span>{' '}
                          <span style={{ color: theme.textSecondary }}>{log.details}</span>
                        </div>
                        <span style={{ fontSize: '0.68rem', color: theme.textMuted }}>
                          {new Date(log.timestamp).toLocaleTimeString('tr-TR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ========================================== */}
      {/* KANIT GÖRSELİ ÖNİZLEME (LIGHTBOX)          */}
      {/* ========================================== */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 100, padding: '20px'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={previewImage} alt="Kanıt Görseli" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '12px', objectFit: 'contain' }} />
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute', top: '-12px', right: '-12px',
                width: '32px', height: '32px', borderRadius: '50%',
                background: isLight ? '#ffffff' : '#1e2438', border: `1px solid ${theme.borderLight}`, color: theme.textPrimary,
                fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* ÖZEL DİYALOG PENCERESİ (CONFIRM / PROMPT)  */}
      {/* ========================================== */}
      {dialogState.isOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 200, padding: '20px'
        }}>
          <div style={{
            width: '100%', maxWidth: '420px', background: theme.cardBg,
            borderRadius: '16px', border: dialogState.isDanger ? '1px solid #ef4444' : `1px solid ${theme.border}`,
            padding: '24px 22px', textAlign: 'center',
            boxShadow: isLight ? '0 20px 40px rgba(0,0,0,0.1)' : '0 25px 60px rgba(0,0,0,0.85)'
          }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: '0 0 8px 0', color: dialogState.isDanger ? '#ef4444' : theme.textPrimary }}>
              {dialogState.title || 'İşlem Onayı'}
            </h3>
            <p style={{ fontSize: '0.84rem', color: theme.textSecondary, margin: '0 0 16px 0', whiteSpace: 'pre-line' }}>
              {dialogState.message}
            </p>

            {dialogState.type === 'prompt' && (
              <input
                type="text"
                value={dialogInput}
                onChange={(e) => setDialogInput(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
                  color: theme.textPrimary, fontSize: '0.86rem', marginBottom: '16px', outline: 'none'
                }}
                autoFocus
              />
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDialogDismiss}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)', border: `1px solid ${theme.border}`,
                  color: theme.textSecondary, fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer'
                }}
              >
                {dialogState.cancelText || 'Vazgeç'}
              </button>
              <button
                onClick={handleDialogSubmit}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  background: dialogState.isDanger ? '#ef4444' : (isLight ? '#0f172a' : '#fff'),
                  border: 'none', color: dialogState.isDanger ? '#fff' : (isLight ? '#fff' : '#090a10'),
                  fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer'
                }}
              >
                {dialogState.confirmText || 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
