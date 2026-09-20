// 7/24 Otomatik Kripto (USDT - TRC20) Blokzincir Doğrulama Servisi
// TronGrid Genel API'si üzerinden transfer teyidi ve anında bakiye yükleme

import { supabase } from '../lib/supabase';
import { logTransaction } from './transactionService';
import { sendTelegramAlert } from './telegramAlert';

export const OFFICIAL_USDT_TRC20_WALLET = 'TDwYUwBrV6mSmJvmcP93VSTnBtWrXnpFsu';
export const USDT_CONTRACT_ADDRESS = 'TR7NHqjekKQxGTCi8q8ZY4pL8otSzgjLj6t';

export interface VerifyCryptoResult {
  success: boolean;
  isAutoCredited: boolean;
  message: string;
  goldAdded?: number;
}

/**
 * TXID'nin daha önce kullanılıp kullanılmadığını kontrol eder (Sahtekarlık Koruması)
 */
export const isTxIdAlreadyUsed = async (txId: string): Promise<boolean> => {
  const cleanId = txId.trim().toLowerCase();
  
  // 1. Local cache kontrolü
  try {
    const cached = JSON.parse(localStorage.getItem('pyngoo_used_txids') || '[]');
    if (cached.includes(cleanId)) return true;
  } catch (_) {}

  // 2. Supabase transactions tablosu kontrolü
  try {
    const { data } = await supabase
      .from('transactions')
      .select('id')
      .ilike('metadata->>txId', cleanId)
      .limit(1);

    if (data && data.length > 0) return true;
  } catch (_) {}

  // 3. Supabase payment_notifications tablosu kontrolü
  try {
    const { data: notifData } = await supabase
      .from('payment_notifications')
      .select('id')
      .ilike('crypto_txid', cleanId)
      .limit(1);

    if (notifData && notifData.length > 0) return true;
  } catch (_) {}

  return false;
};

/**
 * Kullanılan TXID'yi kaydeder
 */
const markTxIdAsUsed = (txId: string) => {
  const cleanId = txId.trim().toLowerCase();
  try {
    const cached = JSON.parse(localStorage.getItem('pyngoo_used_txids') || '[]');
    if (!cached.includes(cleanId)) {
      cached.push(cleanId);
      localStorage.setItem('pyngoo_used_txids', JSON.stringify(cached.slice(-200)));
    }
  } catch (_) {}
};

/**
 * TronGrid üzerinden transferi sorgular ve doğrulandıysa altınları gece siz uyurken bile anında yükler
 */
export const processCryptoPayment = async (
  userId: string,
  userName: string,
  txId: string,
  goldPackage: { gold: number; bonus: number; name: string; id: string },
  expectedUsdt: string,
  orderCode: string
): Promise<VerifyCryptoResult> => {
  const cleanTxId = txId.trim();

  // 1. TXID format kontrolü (Tron TXID tam 64 karakter hexadecimal olmalıdır)
  const isHex64 = /^[a-fA-F0-9]{64}$/.test(cleanTxId);
  if (!cleanTxId || !isHex64) {
    await notifyTelegramManual(userId, userName, cleanTxId || 'Girilmedi', goldPackage, expectedUsdt, orderCode);
    return {
      success: true,
      isAutoCredited: false,
      message: 'Kripto transfer bildiriminiz alındı. TXID formatı operatör kontrolüne iletildi, altınlarınız onay sonrası tanımlanacaktır.'
    };
  }

  // 2. Çift harcama (Replay / Sahtekarlık) kontrolü
  const alreadyUsed = await isTxIdAlreadyUsed(cleanTxId);
  if (alreadyUsed) {
    return {
      success: false,
      isAutoCredited: false,
      message: 'Bu işlem kodu (TXID) daha önce kullanılmış. Lütfen yeni yaptığınız transferin kodunu giriniz.'
    };
  }

  // Hedef cüzdanımızın hex formatı: TDwYUwBrV6mSmJvmcP93VSTnBtWrXnpFsu
  const OFFICIAL_WALLET_HEX = '2b8feecd0578d6a78d3dfd7173a728ed3495e485';
  const expectedUsdtNum = parseFloat(expectedUsdt) || 0;

  // 3. TronGrid API'sinden transferi doğrulamayı dene (Sıkı Kontrol)
  let verifiedOnChain = false;
  try {
    const response = await fetch(`https://api.trongrid.io/v1/transactions/${cleanTxId}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.data && data.data.length > 0) {
        const txInfo = data.data[0];
        const ret = txInfo.ret?.[0]?.contractRet;

        if (ret === 'SUCCESS') {
          // GÜVENLİK KONTROLÜ: İşlem Zaman Aşımı (Max 45 Dakika)
          // TronGrid block_timestamp milisaniye döner. Eski işlemlerle sahte bildirim yapılmasını engeller.
          const txTimestamp = txInfo.block_timestamp || txInfo.raw_data?.timestamp || 0;
          if (txTimestamp > 0) {
            const MAX_AGE_MS = 45 * 60 * 1000; // 45 dakika
            const age = Date.now() - txTimestamp;
            if (age > MAX_AGE_MS || age < -5 * 60 * 1000) {
              console.warn('Eski işlem kodu tespit edildi (Zaman aşımı):', { age, txTimestamp });
              await notifyTelegramManual(userId, userName, cleanTxId, goldPackage, expectedUsdt, orderCode);
              return {
                success: true,
                isAutoCredited: false,
                message: 'İşlem kodu 45 dakikadan eski bir transfere ait. Güvenlik gerekçesiyle otomatik yükleme durduruldu ve operatör kontrolüne iletildi.'
              };
            }
          }

          // Sözleşme çağrısı detaylarını incele
          const contract = txInfo.raw_data?.contract?.[0];
          const contractType = contract?.type;
          const paramValue = contract?.parameter?.value;

          if (contractType === 'TriggerSmartContract' && paramValue) {
            const contractAddr = (paramValue.contract_address || '').toLowerCase();
            const isUsdtContract = contractAddr === '41a614f803b6fd780986a42c78ec9c7f77e6ded13c' ||
                                   contractAddr === USDT_CONTRACT_ADDRESS.toLowerCase();

            const callData = (paramValue.data || '').toLowerCase();

            // ERC-20 / TRC-20 Transfer metodu: 0xa9059cbb
            if (isUsdtContract && callData.startsWith('a9059cbb')) {
              // Hedef adres (data'nın sonraki 64 karakteri)
              const toAddressPart = callData.substring(8, 72);
              // Tutar (data'nın son 64 karakteri)
              const amountPart = callData.substring(72, 136);

              const isTargetWallet = toAddressPart.includes(OFFICIAL_WALLET_HEX.toLowerCase());
              const transferredUnits = parseInt(amountPart, 16);
              const transferredUsdt = transferredUnits / 1_000_000; // USDT 6 ondalık basamaklıdır

              // Hedef cüzdan bizim cüzdanımız ve aktarılan tutar beklenen tutara eşit veya fazlaysa onayla
              if (isTargetWallet && transferredUsdt >= expectedUsdtNum * 0.99 && transferredUsdt <= Math.max(expectedUsdtNum * 3, 20)) {
                verifiedOnChain = true;
              } else {
                console.warn('Kripto transferi eşleşmedi: Hedef veya tutar farklı!', {
                  isTargetWallet,
                  transferredUsdt,
                  expectedUsdtNum
                });
              }
            }
          }
        }
      }
    }

    // Ek Güvenlik: TronGrid Events API teyidi
    if (!verifiedOnChain) {
      try {
        const eventRes = await fetch(`https://api.trongrid.io/v1/transactions/${cleanTxId}/events`, {
          headers: { 'Accept': 'application/json' }
        });
        if (eventRes.ok) {
          const eventData = await eventRes.json();
          if (eventData && eventData.data && Array.isArray(eventData.data)) {
            const transferEvent = eventData.data.find((ev: any) => 
              ev.event_name === 'Transfer' &&
              (ev.result?.to?.toLowerCase() === OFFICIAL_USDT_TRC20_WALLET.toLowerCase() ||
               ev.result?.to?.toLowerCase()?.includes(OFFICIAL_WALLET_HEX.toLowerCase()))
            );

            if (transferEvent) {
              const val = parseFloat(transferEvent.result?.value || '0') / 1_000_000;
              if (val >= expectedUsdtNum * 0.99) {
                verifiedOnChain = true;
              }
            }
          }
        }
      } catch (eventErr) {
        // Events endpoint opsiyonel ek kontroldür
      }
    }
  } catch (err) {
    console.warn('TronGrid zincir sorgulama atlandı:', err);
  }

  const totalGoldToAdd = goldPackage.gold + goldPackage.bonus;

  // 4. OTOMATİK ONAYLANDIYSA: Altını anında yükle! (7/24 Gece Otomasyonu)
  if (verifiedOnChain) {
    markTxIdAsUsed(cleanTxId);

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_gold')
        .eq('id', userId)
        .single();

      const newGold = (profile?.total_gold || 0) + totalGoldToAdd;

      await supabase
        .from('profiles')
        .update({ total_gold: newGold })
        .eq('id', userId);

      await logTransaction(userId, totalGoldToAdd, 'purchase_gold', {
        details: `${goldPackage.name} (Kripto USDT TRC-20 Otomatik)`,
        txId: cleanTxId,
        orderCode,
        usdtAmount: expectedUsdt
      });

      const successMsg = `
🤖 <b>7/24 OTOMATİK KRİPTO ONAYLANDI! (ALTIN YÜKLENDİ)</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Kullanıcı:</b> ${userName} (<code>${userId.slice(0, 8)}</code>)
🪙 <b>Yüklenen:</b> <b>${totalGoldToAdd} Altın</b> (${goldPackage.name})
💵 <b>Alınan:</b> <code>${expectedUsdt} USDT (TRC-20)</code>
🏷️ <b>Sipariş Kodu:</b> <code>${orderCode}</code>
🔗 <b>Blokzincir TXID:</b> <code>${cleanTxId}</code>
📥 <b>Hedef:</b> Binance Global (<code>${OFFICIAL_USDT_TRC20_WALLET.slice(0, 8)}...</code>)
✅ <b>Durum:</b> TronGrid Doğruladı, Kullanıcıya Anında Teslim Edildi!
📅 <b>Tarih:</b> ${new Date().toLocaleDateString('tr-TR')} • ${new Date().toLocaleTimeString('tr-TR')}
      `.trim();
      await sendTelegramAlert(successMsg);

      return {
        success: true,
        isAutoCredited: true,
        goldAdded: totalGoldToAdd,
        message: `Tebrikler! ${expectedUsdt} USDT transferiniz blokzincirde doğrulandı ve ${totalGoldToAdd} Altın anında hesabınıza yüklendi!`
      };
    } catch (e) {
      console.error('Kripto otomatik yükleme hatası:', e);
    }
  }

  // 5. Zincirde henüz onaylanmadıysa veya borsa dahili transferi ise:
  await notifyTelegramManual(userId, userName, cleanTxId, goldPackage, expectedUsdt, orderCode);

  return {
    success: true,
    isAutoCredited: false,
    message: 'Kripto transfer bildiriminiz alındı! Transfer kontrol edilip altınlarınız kısa süre içinde hesabınıza tanımlanacaktır.'
  };
};

const notifyTelegramManual = async (
  userId: string,
  userName: string,
  txId: string,
  goldPackage: { gold: number; bonus: number; name: string },
  expectedUsdt: string,
  orderCode: string
) => {
  try {
    const msg = `
🪙 <b>YENİ KRİPTO (USDT - TRC20) ÖDEME BİLDİRİMİ</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Kullanıcı:</b> ${userName} (<code>${userId.slice(0, 8)}</code>)
🪙 <b>Paket:</b> ${goldPackage.gold} Altın (+${goldPackage.bonus} Hediye)
💵 <b>Beklenen Tutar:</b> <code>${expectedUsdt} USDT (TRC-20)</code>
🏷️ <b>Zorunlu Kod:</b> <code>${orderCode}</code>
🔗 <b>TXID / Hash:</b> <code>${txId || 'Girilmedi'}</code>
📥 <b>Cüzdanınız:</b> <code>${OFFICIAL_USDT_TRC20_WALLET}</code>
📅 <b>Tarih:</b> ${new Date().toLocaleDateString('tr-TR')} • ${new Date().toLocaleTimeString('tr-TR')}

<i>Lütfen Binance Global hesabınızdan transferi kontrol edip onaylayınız.</i>
    `.trim();
    await sendTelegramAlert(msg);
  } catch (_) {}
};
