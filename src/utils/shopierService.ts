// Shopier Güvenli 3D Ödeme Entegrasyon Servisi

export const SHOPIER_CONFIG = {
  clientId: '04b653dfb67e0361eb588ccac33067d9',
  callbackUrl: 'https://pyngoo.app/market',
  shopierPayUrl: 'https://www.shopier.com/ShowProduct/api_pay4.php',
  apiBaseUrl: 'https://api.shopier.com/v1'
};

export interface ShopierOrderData {
  orderId: string;
  packageId: string;
  packageName: string;
  gold: number;
  bonus: number;
  price: string;
  priceNum: number;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
}

/**
 * Shopier 3D Secure Güvenli Ödeme Sayfasını Başlatır
 */
export const startShopierPayment = (order: ShopierOrderData) => {
  // 1. Ödeme oturumunu tarayıcıda sakla (kullanıcı geri döndüğünde altını tanımlayabilmek için)
  const pendingSession = {
    ...order,
    timestamp: Date.now(),
    status: 'pending'
  };
  localStorage.setItem(`shopier_pending_${order.orderId}`, JSON.stringify(pendingSession));
  localStorage.setItem('shopier_last_order', order.orderId);

  // 2. Form oluştur ve Shopier 3D Secure ödeme kapısına yönlendir
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = SHOPIER_CONFIG.shopierPayUrl;
  form.style.display = 'none';

  const params: Record<string, string> = {
    API_key: SHOPIER_CONFIG.clientId,
    website_index: '1',
    platform_order_id: order.orderId,
    product_name: `${order.gold + order.bonus} Pyngoo Altın (${order.packageName})`,
    product_type: '1', // Dijital Hizmet / Anında Teslim
    buyer_name: order.userName || 'Pyngoo Kullanıcısı',
    buyer_surname: 'Müşteri',
    buyer_email: order.userEmail || `${order.userId.slice(0, 8)}@pyngoo.app`,
    buyer_phone: order.userPhone || '05555555555',
    buyer_account_age: '30',
    buyer_id_nr: order.userId.slice(0, 11).replace(/[^a-zA-Z0-9]/g, '1'),
    buyer_address: 'Türkiye',
    buyer_city: 'İstanbul',
    buyer_country: 'Türkiye',
    total_order_value: order.priceNum.toFixed(2),
    currency: '0', // 0 = TRY
    current_language: '0', // 0 = Türkçe
    modul_version: '1.0.4',
    callback_url: SHOPIER_CONFIG.callbackUrl
  };

  for (const [key, value] of Object.entries(params)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
};
