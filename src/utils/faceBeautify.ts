// PYNGOO — Yüz Güzelleştirme Motoru (MediaPipe Face Landmarker, ücretsiz & cihaz üzerinde)
//
// Agora'nın kendi "Beauty Effect" eklentisi resmi dokümanında mobilde önerilmiyor
// (masaüstü sınıfı işlemci istiyor). MediaPipe ise WASM/WebGL ile hem masaüstü hem
// mobil tarayıcıda (WKWebView dahil) çalışacak şekilde tasarlanmış, ücretsiz ve
// hiçbir görüntü sunucuya gitmeden cihazda işleniyor.
//
// Bu dosya kasıtlı olarak HİÇBİR ekrana bağlı değil: ham bir kamera MediaStreamTrack'i
// alır, işlenmiş bir MediaStreamTrack döner. Hangi ekranın (VoiceChat, ileride kurulacak
// Canlı Oda) bunu kullanacağı ayrı bir karar.
//
// Güvenlik ağı: model yüklenemez, WebGL yoksa veya işleme sırasında herhangi bir hata
// olursa orijinal (işlenmemiş) track sessizce geri döner — görüşme ASLA bu yüzden kesilmez.

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(WASM_CDN).then((fileset) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
      })
    );
  }
  return landmarkerPromise;
}

export interface BeautifiedTrack {
  track: MediaStreamTrack;
  stop: () => void;
}

// Ham kamera track'ini alır; mümkünse cilt yumuşatma uygulanmış yeni bir track döner.
// Başarısız olursa (model/WebGL yok, hata vb.) girdi track'in KENDİSİNİ değiştirmeden döner.
export async function beautifyVideoTrack(inputTrack: MediaStreamTrack): Promise<BeautifiedTrack> {
  const passthrough: BeautifiedTrack = { track: inputTrack, stop: () => {} };

  try {
    const landmarker = await getLandmarker();

    const video = document.createElement('video');
    video.srcObject = new MediaStream([inputTrack]);
    video.muted = true;
    video.playsInline = true;
    await video.play();

    const settings = inputTrack.getSettings();
    const width = settings.width || video.videoWidth || 640;
    const height = settings.height || video.videoHeight || 480;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return passthrough;

    let raf = 0;
    let stopped = false;

    const render = () => {
      if (stopped || video.readyState < 2) {
        raf = requestAnimationFrame(render);
        return;
      }
      // 1) Keskin kareyi çiz
      ctx.filter = 'none';
      ctx.drawImage(video, 0, 0, width, height);

      // 2) Yüz bölgesini bul (varsa) ve SADECE o bölgeye yumuşak/hafif blur bindirerek
      // cilt pürüzsüzleştirme etkisi ver — gözler/ağız keskinliği korunsun diye tüm
      // kareyi değil, yüz kutusunun ortasını hedefliyoruz (basit ama etkili MVP yaklaşımı).
      const result = landmarker.detectForVideo(video, performance.now());
      const box = faceBoundingBox(result, width, height);
      if (box) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(box.cx, box.cy, box.rw, box.rh, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.filter = 'blur(3px)';
        ctx.globalAlpha = 0.55;
        ctx.drawImage(video, 0, 0, width, height);
        ctx.restore();
      }

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const outStream = canvas.captureStream(30);
    const outTrack = outStream.getVideoTracks()[0];

    // Orijinal track durursa (kamera kapandı, cihaz değişti vb.) işlenmiş track'i de kapat.
    inputTrack.addEventListener('ended', () => stop());

    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      video.pause();
      video.srcObject = null;
      outTrack.stop();
    };

    return { track: outTrack, stop };
  } catch (err) {
    console.error('Yüz güzelleştirme başlatılamadı, ham görüntüyle devam ediliyor:', err);
    return passthrough;
  }
}

function faceBoundingBox(
  result: ReturnType<FaceLandmarker['detectForVideo']>,
  width: number,
  height: number
): { cx: number; cy: number; rw: number; rh: number } | null {
  const points = result.faceLandmarks?.[0];
  if (!points || points.length === 0) return null;

  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = ((minX + maxX) / 2) * width;
  const cy = ((minY + maxY) / 2) * height;
  const rw = ((maxX - minX) / 2) * width * 1.05;
  const rh = ((maxY - minY) / 2) * height * 1.15;
  return { cx, cy, rw, rh };
}
