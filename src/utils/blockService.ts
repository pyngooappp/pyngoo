import { supabase } from '../lib/supabase';

const LOCAL_STORAGE_KEY = 'pyngoo_blocked_users';
const LOCAL_STORAGE_NAMES_KEY = 'pyngoo_blocked_users_meta';

export interface BlockedUserItem {
  id: string;
  name: string;
  blockedAt: string;
}

// Yerel hafızadaki engelli ID listesini al (Anlık senkron kontrol için)
export const getLocalBlockedIds = (): string[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// Yerel hafızadaki detaylı engelli kullanıcı listesini al
export const getLocalBlockedList = (): BlockedUserItem[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_NAMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// Kullanıcının engelli listesini hem Supabase hem yerel hafızadan çek ve birleştir
export const fetchBlockedUsers = async (userId: string): Promise<BlockedUserItem[]> => {
  const localList = getLocalBlockedList();
  
  if (!userId) return localList;

  try {
    // Supabase blocks tablosunu sorgula
    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_user_id, created_at')
      .eq('user_id', userId);

    if (error || !data) {
      return localList;
    }

    const blockedIds = data.map((b: any) => b.blocked_user_id);
    
    // Profillerden isimleri çek
    if (blockedIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', blockedIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.display_name]));

      const remoteList: BlockedUserItem[] = data.map((b: any) => ({
        id: b.blocked_user_id,
        name: profileMap.get(b.blocked_user_id) || 'Kullanıcı',
        blockedAt: b.created_at || new Date().toISOString()
      }));

      // Yerel listeyle birleştir
      const mergedMap = new Map<string, BlockedUserItem>();
      localList.forEach(item => mergedMap.set(item.id, item));
      remoteList.forEach(item => mergedMap.set(item.id, item));

      const finalList = Array.from(mergedMap.values());
      
      // Senkronize et
      localStorage.setItem(LOCAL_STORAGE_NAMES_KEY, JSON.stringify(finalList));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(finalList.map(i => i.id)));
      
      return finalList;
    }

    return localList;
  } catch (err) {
    console.warn('Blocked users fetch error, fallback to local:', err);
    return localList;
  }
};

// Kullanıcıyı Engelle
export const blockUser = async (userId: string, targetUserId: string, targetName: string = 'Kullanıcı'): Promise<void> => {
  if (!targetUserId) return;

  // 1. Yerel hafızaya kaydet (Anında etki)
  const currentIds = getLocalBlockedIds();
  if (!currentIds.includes(targetUserId)) {
    currentIds.push(targetUserId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentIds));
  }

  const currentList = getLocalBlockedList();
  if (!currentList.some(i => i.id === targetUserId)) {
    currentList.unshift({
      id: targetUserId,
      name: targetName,
      blockedAt: new Date().toISOString()
    });
    localStorage.setItem(LOCAL_STORAGE_NAMES_KEY, JSON.stringify(currentList));
  }

  // 2. Supabase blocks tablosuna kaydet
  if (userId) {
    try {
      await supabase.from('blocks').insert([
        {
          user_id: userId,
          blocked_user_id: targetUserId
        }
      ]);
    } catch (err) {
      console.warn('Supabase blocks tablosuna yazılamadı:', err);
    }
  }
};

// Kullanıcının Engelini Kaldır (Unblock)
export const unblockUser = async (userId: string, targetUserId: string): Promise<void> => {
  if (!targetUserId) return;

  // 1. Yerelden sil
  const currentIds = getLocalBlockedIds().filter(id => id !== targetUserId);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentIds));

  const currentList = getLocalBlockedList().filter(i => i.id !== targetUserId);
  localStorage.setItem(LOCAL_STORAGE_NAMES_KEY, JSON.stringify(currentList));

  // 2. Supabase'den sil
  if (userId) {
    try {
      await supabase
        .from('blocks')
        .delete()
        .eq('user_id', userId)
        .eq('blocked_user_id', targetUserId);
    } catch (err) {
      console.warn('Supabase unblock error:', err);
    }
  }
};

// Hedef kullanıcının engelli olup olmadığını anlık kontrol et
export const isUserBlocked = (targetUserId: string): boolean => {
  if (!targetUserId) return false;
  return getLocalBlockedIds().includes(targetUserId);
};
