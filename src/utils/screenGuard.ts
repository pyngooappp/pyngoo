import { Capacitor, registerPlugin } from '@capacitor/core';

// Android yerel eklentisi (android/app/src/main/java/app/pyngoo/chat/ScreenGuardPlugin.java).
// Açıkken ekran görüntüsü / ekran kaydı sistem tarafından engellenir, kayıtta görüntü siyah çıkar.
interface ScreenGuardPlugin {
  enable(): Promise<void>;
  disable(): Promise<void>;
}

const ScreenGuard = registerPlugin<ScreenGuardPlugin>('ScreenGuard');

const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

let activeCount = 0;

export async function enableScreenGuard(): Promise<void> {
  if (!isAndroid()) return;
  activeCount += 1;
  try { await ScreenGuard.enable(); } catch { /* eski sürüm uygulamada eklenti yoksa sessizce geç */ }
}

export async function disableScreenGuard(): Promise<void> {
  if (!isAndroid()) return;
  activeCount = Math.max(0, activeCount - 1);
  if (activeCount > 0) return;
  try { await ScreenGuard.disable(); } catch { /* yok say */ }
}
