class SoundManager {
  private audioContext: AudioContext | null = null;
  private radarInterval: number | null = null;
  private isSearching: boolean = false;
  private isUnlocked: boolean = false;

  constructor() {
    this.initUnlockListener();
  }

  // iOS WKWebView ve Safari için ilk kullanıcı dokunuşunda ses kanalını kalıcı olarak açar
  public initUnlockListener() {
    if (typeof window === 'undefined' || this.isUnlocked) return;

    const unlock = () => {
      try {
        const ctx = this.getContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        // iOS Web Audio pipeline kilidini 1 örneklemeli sessiz tampon ile aç
        if (ctx) {
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
        }
        this.isUnlocked = true;
      } catch (_) {}

      const events = ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'];
      events.forEach((e) => window.removeEventListener(e, unlock));
    };

    const events = ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'];
    events.forEach((e) => window.addEventListener(e, unlock, { once: true, passive: true }));
  }

  private getContext(): AudioContext {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext as AudioContext;
  }

  // Eşleşme Aranıyor (Derin Yükselen Whoosh + Kristal Sonar Ping İkilisi)
  private playDoublePing() {
    if (!this.isSearching) return;
    
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      
      // 1. SES: Alttan yükselen sinematik sihirli ses (Whoosh)
      // Çift osilatör (Triangle + Sine) ile zengin ve dolgun frekans
      const sweepOsc = ctx.createOscillator();
      const sweepGain = ctx.createGain();
      
      sweepOsc.type = 'triangle';
      sweepOsc.frequency.setValueAtTime(280, now);
      sweepOsc.frequency.exponentialRampToValueAtTime(760, now + 0.35);
      
      sweepGain.gain.setValueAtTime(0, now);
      sweepGain.gain.linearRampToValueAtTime(0.32, now + 0.08);
      sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      
      sweepOsc.connect(sweepGain);
      sweepGain.connect(ctx.destination);
      
      sweepOsc.start(now);
      sweepOsc.stop(now + 0.45);

      // 2. SES: Kristal Berraklığında Radar / Sonar Ping (Acoustic Chime Ping)
      // Çift armonik: Temel frekans (1046.5Hz = C6) + 5. derece (1567.98Hz = G6)
      const pingTime = now + 0.30;
      [1046.5, 1567.98].forEach((freq, idx) => {
        const pingOsc = ctx.createOscillator();
        const pingGain = ctx.createGain();

        pingOsc.type = idx === 0 ? 'sine' : 'triangle';
        pingOsc.frequency.setValueAtTime(freq, pingTime);
        pingOsc.frequency.exponentialRampToValueAtTime(freq * 0.88, pingTime + 0.22);

        const peakVol = idx === 0 ? 0.48 : 0.25;
        pingGain.gain.setValueAtTime(0, pingTime);
        pingGain.gain.linearRampToValueAtTime(peakVol, pingTime + 0.025);
        pingGain.gain.exponentialRampToValueAtTime(0.001, pingTime + 0.55);

        pingOsc.connect(pingGain);
        pingGain.connect(ctx.destination);

        pingOsc.start(pingTime);
        pingOsc.stop(pingTime + 0.55);
      });
    } catch (_) {}
  }

  // Senkron başlatma: Kullanıcı butona dokunur dokunmaz gecikmesiz çalışır
  public startRadar() {
    this.isSearching = true;
    try {
      const ctx = this.getContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (_) {}
    
    // Aramaya başlar başlamaz ilk sesleri hemen çal (Whoosh + Ping)
    this.playDoublePing();
    
    if (this.radarInterval) {
      clearInterval(this.radarInterval);
    }
    this.radarInterval = window.setInterval(() => {
      this.playDoublePing();
    }, 2200) as unknown as number;
  }

  public stopRadar() {
    this.isSearching = false;
    if (this.radarInterval) {
      clearInterval(this.radarInterval);
      this.radarInterval = null;
    }
  }

  // Eşleşme Bulundu (Kristal Çan / Canlı Başarı Akoru)
  public playMatchFound() {
    this.stopRadar();
    try {
      const ctx = this.getContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      
      if (ctx) {
        const playChime = (freq: number, startTime: number, duration: number, vol = 0.38) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

          gainNode.gain.setValueAtTime(0, ctx.currentTime + startTime);
          gainNode.gain.linearRampToValueAtTime(vol, ctx.currentTime + startTime + 0.04);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc.start(ctx.currentTime + startTime);
          osc.stop(ctx.currentTime + startTime + duration);
        };

        // Sıcak ve etkileyici C-Major arpeggio akoru (C5, E5, G5, C6)
        playChime(523.25, 0, 0.9, 0.35);     // C5
        playChime(659.25, 0.10, 0.9, 0.38);  // E5
        playChime(783.99, 0.20, 1.0, 0.42);  // G5
        playChime(1046.50, 0.32, 1.6, 0.55); // C6
      }
    } catch (_) {}

    // HTML5 Audio yedek bildirim tetikleyicisi
    try {
      const audio = new Audio('/pingoo.mp3');
      audio.volume = 0.85;
      audio.play().catch(() => {});
    } catch (_) {}
  }

  // Altın Satın Alma ve Hediye Şıngırtısı (Gold Coin Chime)
  public playCoinSound() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      [987.77, 1318.51, 1567.98].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.22, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.45);
      });
    } catch (_) {}
  }

  // Gelen Arama Zil Sesi (Telefon Çalma Tonu)
  private ringtoneInterval: number | null = null;

  public startRingtone() {
    this.stopRingtone();
    const playRingCycle = () => {
      try {
        const ctx = this.getContext();
        const now = ctx.currentTime;

        // 1. Düşük ve Yüksek Çift Ton (Dual Tone 440Hz + 480Hz Standart Telefon Çalması)
        [440, 480].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          // 1.5 saniyelik çalma
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
          gain.gain.setValueAtTime(0.18, now + 1.45);
          gain.gain.linearRampToValueAtTime(0.001, now + 1.5);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 1.5);
        });
      } catch (_) {}
    };

    playRingCycle();
    this.ringtoneInterval = window.setInterval(playRingCycle, 3000) as unknown as number;
  }

  public stopRingtone() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }

  // Arayan Kişi İçin Çalma Sesi (Düüüt... Düüüt... Ringback Tone)
  private outgoingInterval: number | null = null;

  public startOutgoingRingback() {
    this.stopOutgoingRingback();
    const playRingbackCycle = () => {
      try {
        const ctx = this.getContext();
        const now = ctx.currentTime;

        // Standart Telefon Çalma Sesi: 425Hz (Düüüt... 1.2 sn çal, 2.3 sn dur)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(425, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.setValueAtTime(0.12, now + 1.15);
        gain.gain.linearRampToValueAtTime(0.001, now + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.2);
      } catch (_) {}
    };

    playRingbackCycle();
    this.outgoingInterval = window.setInterval(playRingbackCycle, 3500) as unknown as number;
  }

  public stopOutgoingRingback() {
    if (this.outgoingInterval) {
      clearInterval(this.outgoingInterval);
      this.outgoingInterval = null;
    }
  }

  // Meşgul Sesi (Düt... Düt... Düt... Düt... - 4 hızlı tekrar)
  public playBusyTone(onComplete?: () => void) {
    this.stopOutgoingRingback();
    this.stopRingtone();
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const beepDuration = 0.35;
      const pauseDuration = 0.35;
      const totalCycles = 4;

      for (let i = 0; i < totalCycles; i++) {
        const start = now + i * (beepDuration + pauseDuration);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(425, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.03);
        gain.gain.setValueAtTime(0.15, start + beepDuration - 0.03);
        gain.gain.linearRampToValueAtTime(0.001, start + beepDuration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + beepDuration);
      }

      const totalDurationMs = totalCycles * (beepDuration + pauseDuration) * 1000;
      setTimeout(() => {
        if (onComplete) onComplete();
      }, totalDurationMs + 200);
    } catch (_) {
      if (onComplete) onComplete();
    }
  }

  // Görüşmedeki Kişiye Arama Bekletme Uyarısı (Hafif Bip-Bip)
  public playCallWaitingBeep() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      [0, 0.2].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now + offset);
        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(0.08, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.12);
      });
    } catch (_) {}
  }

  // Canlı Görüşme Mesaj Sesi (Hafif ve Zarif Bildirim Sesi)
  public playMessageSound() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch (_) {}
  }
}

export const soundManager = new SoundManager();
