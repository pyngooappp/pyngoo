import { supabase } from '../lib/supabase';

export type TransactionType = 
  | 'purchase_gold'     // Altın Satın Alma (+)
  | 'gift_sent'         // Hediye Gönderme (-)
  | 'gift_received'     // Hediye Alma (+)
  | 'call_cost'         // Özel Arama Harcaması (-)
  | 'call_earning'      // Kadın Arama Kazancı (+ elmas)
  | 'daily_reward'      // Günlük Giriş Ödülü (+)
  | 'ad_reward'         // Reklam / Market Bonusu (+)
  | 'withdraw_request'  // Para Çekim Talebi (-)
  | 'withdraw_refund'   // Para Çekim İadesi / Red (+)
  | 'system_adjustment';// Yönetici / Sistem Düzenlemesi

export async function logTransaction(
  userId: string,
  amount: number,
  type: TransactionType,
  _meta?: {
    targetUserId?: string;
    details?: string;
    giftName?: string;
    durationSec?: number;
    iban?: string;
    [key: string]: any;
  }
) {
  try {
    const { error } = await supabase.from('transactions').insert([
      {
        user_id: userId,
        amount: amount,
        transaction_type: type
      }
    ]);
    if (error) {
      console.warn('logTransaction Supabase note:', error.message);
    }
  } catch (err) {
    console.warn('logTransaction exception:', err);
  }
}
