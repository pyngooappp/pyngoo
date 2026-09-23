import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// Google Resmi Test Rewarded Reklam ID'leri
// Gerçek canlı AdMob ID'lerinizi aldığınızda REAL_AD_UNITS içine yazabilirsiniz:
const TEST_AD_UNITS = {
  android: 'ca-app-pub-3940256099942544/5224354917',
  ios: 'ca-app-pub-3940256099942544/1712485313'
};

export const ADMOB_APP_IDS = {
  android: 'ca-app-pub-6163702675031285~8012675744',
  ios: 'ca-app-pub-6163702675031285~1338244734'
};

const REAL_AD_UNITS = {
  android: 'ca-app-pub-6163702675031285/2481147464',
  ios: 'ca-app-pub-6163702675031285/4424784328' // Pyngoo iOS Ödüllü
};

const USE_TEST_ADS = false; // Gerçek AdMob ID'leri aktif

class AdMobService {
  private isInitialized = false;
  private isAdLoaded = false;
  private isPreparing = false;

  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public async initialize(): Promise<void> {
    if (!this.isNative() || this.isInitialized) return;

    try {
      await AdMob.initialize({
        initializeForTesting: USE_TEST_ADS
      });

      // iOS 14+ için App Tracking Transparency izni isteği
      if (Capacitor.getPlatform() === 'ios') {
        try {
          await AdMob.requestTrackingAuthorization();
        } catch (e) {
          console.warn('Tracking authorization error:', e);
        }
      }

      this.setupEventListeners();
      this.isInitialized = true;
      console.log('✅ Google AdMob SDK başarıyla başlatıldı.');

      // Arka planda ilk ödüllü reklamı önceden yükle (Preload)
      this.prepareRewardVideo();
    } catch (error) {
      console.error('❌ AdMob başlatılırken hata oluştu:', error);
    }
  }

  private getAdUnitId(): string {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') {
      return (!USE_TEST_ADS && REAL_AD_UNITS.ios) ? REAL_AD_UNITS.ios : TEST_AD_UNITS.ios;
    }
    return (!USE_TEST_ADS && REAL_AD_UNITS.android) ? REAL_AD_UNITS.android : TEST_AD_UNITS.android;
  }

  private setupEventListeners(): void {
    AdMob.addListener(RewardAdPluginEvents.Loaded, () => {
      console.log('🎬 AdMob Ödüllü Reklam Hazır.');
      this.isAdLoaded = true;
      this.isPreparing = false;
    });

    AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (err) => {
      console.warn('⚠️ AdMob Reklam yüklenemedi:', err);
      this.isAdLoaded = false;
      this.isPreparing = false;
    });

    AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      console.log('🎬 AdMob Reklam kapatıldı, yeni reklam önceden yükleniyor...');
      this.isAdLoaded = false;
      this.prepareRewardVideo();
    });

    AdMob.addListener(RewardAdPluginEvents.FailedToShow, (err) => {
      console.error('❌ AdMob Reklam gösterilemedi:', err);
      this.isAdLoaded = false;
    });
  }

  public async prepareRewardVideo(userId?: string): Promise<boolean> {
    if (!this.isNative() || this.isPreparing || this.isAdLoaded) return this.isAdLoaded;

    try {
      this.isPreparing = true;
      const adId = this.getAdUnitId();
      await AdMob.prepareRewardVideoAd({
        adId,
        isTesting: USE_TEST_ADS,
        ssv: userId ? { userId } : undefined
      });
      this.isAdLoaded = true;
      this.isPreparing = false;
      return true;
    } catch (error) {
      console.warn('⚠️ AdMob canlı reklam yüklenemedi (uygulama henüz App Store onayında olabilir), test reklamı deneniyor:', error);
      // Canlı reklam birimi App Store incelemesindeyken test reklamına düşerek akışı koru
      try {
        const platform = Capacitor.getPlatform();
        const testAdId = platform === 'ios' ? TEST_AD_UNITS.ios : TEST_AD_UNITS.android;
        await AdMob.prepareRewardVideoAd({
          adId: testAdId,
          isTesting: true,
          ssv: userId ? { userId } : undefined
        });
        this.isAdLoaded = true;
        this.isPreparing = false;
        console.log('✅ AdMob test reklamı başarıyla hazırlandı.');
        return true;
      } catch (testErr) {
        console.warn('❌ AdMob test reklamı da yüklenemedi:', testErr);
      }
      this.isPreparing = false;
      this.isAdLoaded = false;
      return false;
    }
  }

  public async showRewardVideo(userId?: string): Promise<{
    rewarded: boolean;
    amount: number;
    error?: string;
  }> {
    if (!this.isNative()) {
      return { rewarded: false, amount: 0, error: 'not_native' };
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    // Eğer reklam henüz hazır değilse hazırla
    if (!this.isAdLoaded) {
      const prepared = await this.prepareRewardVideo(userId);
      if (!prepared) {
        return { rewarded: false, amount: 0, error: 'Reklam şu an hazır değil, lütfen birkaç saniye sonra tekrar deneyin.' };
      }
    }

    return new Promise(async (resolve) => {
      let isRewarded = false;
      let rewardAmount = 20;

      const rewardSub = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (rewardItem) => {
        isRewarded = true;
        if (rewardItem?.amount) {
          rewardAmount = rewardItem.amount;
        }
        console.log('🎉 Kullanıcı reklamı tamamladı ve ödülü kazandı!', rewardItem);
      });

      const dismissSub = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        try {
          rewardSub.remove();
          dismissSub.remove();
        } catch (_) {}

        resolve({
          rewarded: isRewarded,
          amount: isRewarded ? rewardAmount : 0,
          error: isRewarded ? undefined : 'Reklam tamamlanmadan kapatıldı.'
        });
      });

      try {
        await AdMob.showRewardVideoAd();
      } catch (err: any) {
        try {
          rewardSub.remove();
          dismissSub.remove();
        } catch (_) {}
        resolve({
          rewarded: false,
          amount: 0,
          error: err?.message || 'Reklam gösterilirken hata oluştu.'
        });
      }
    });
  }
}

export const admobService = new AdMobService();
