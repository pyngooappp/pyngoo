/**
 * Pyngoo Askeri Düzeyde Profil Görseli Güvenlik ve Doğrulama Modülü
 * 
 * Güvenlik Katmanları:
 * 1. Uzantı Doğrulaması (Yalnızca .jpg, .jpeg, .png, .webp)
 * 2. MIME Type Doğrulaması (image/jpeg, image/png, image/webp)
 * 3. Magic Bytes (İkili Dosya İmzası) Kontrolü:
 *    - JPEG: FF D8 FF
 *    - PNG: 89 50 4E 47 0D 0A 1A 0A
 *    - WEBP: RIFF .... WEBP
 * 4. Dosya Boyutu Sınırı (Maksimum 15MB)
 * 5. HTML5 Canvas İle Sıfırdan Yeniden Kodlama (Sanitization):
 *    - Görsel pikselleri canvas'a aktarılır ve sıfırdan JPEG olarak üretilir.
 *    - Böylece dosya içine gizlenmiş olabilecek tüm EXIF betikleri, PHP kodları,
 *      XSS / SVG zararlıları, polyglot yükleri veya binary injection kalıntıları
 *      tamamen yok edilir (yalnızca ham piksel renkleri işlenir).
 */

export interface ImageValidationResult {
  valid: boolean;
  sanitizedDataUrl?: string;
  errorKey?: string;
  errorFallback?: string;
}

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

/**
 * Dosyanın ilk baytlarını (Magic Bytes) okuyarak gerçek resim imzasını doğrular.
 */
async function checkMagicBytes(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const slice = file.slice(0, 16);

    reader.onloadend = () => {
      if (!reader.result || !(reader.result instanceof ArrayBuffer)) {
        resolve(false);
        return;
      }

      const bytes = new Uint8Array(reader.result);
      if (bytes.length < 4) {
        resolve(false);
        return;
      }

      // 1. JPEG: FF D8 FF
      const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;

      // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
      const isPng = bytes.length >= 8 &&
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
        bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A;

      // 3. WEBP: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
      const isWebp = bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // "RIFF"
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;  // "WEBP"

      resolve(isJpeg || isPng || isWebp);
    };

    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(slice);
  });
}

/**
 * Bir dosyayı derinlemesine denetler ve güvenli şekilde dezenfekte eder.
 */
export async function validateAndSanitizeImage(
  file: File,
  maxDimension: number = 640,
  quality: number = 0.88
): Promise<ImageValidationResult> {
  // 1. Dosya boyutu kontrolü
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      errorKey: 'photo_err_too_large',
      errorFallback: 'Fotoğraf boyutu çok büyük (Maksimum 15MB).'
    };
  }

  // 2. Uzantı kontrolü
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      errorKey: 'photo_err_invalid_type',
      errorFallback: 'Lütfen geçerli bir resim dosyası seçin (JPG, PNG veya WEBP).'
    };
  }

  // 3. MIME Türü kontrolü (Zararlı text/html, application/* veya image/svg+xml engellenir)
  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      errorKey: 'photo_err_invalid_type',
      errorFallback: 'Lütfen geçerli bir resim dosyası seçin (JPG, PNG veya WEBP).'
    };
  }

  // 4. Magic Bytes (İkili İmza) derinlemesine kontrolü
  const isValidSignature = await checkMagicBytes(file);
  if (!isValidSignature) {
    return {
      valid: false,
      errorKey: 'photo_err_invalid_signature',
      errorFallback: 'Güvenlik uyarısı: Dosya geçerli bir resim formatına sahip değil.'
    };
  }

  // 5. HTML5 Canvas Dezenfeksiyonu (Tüm gömülü meta veri ve kod parçacıkları sıfırlanır)
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      resolve({
        valid: false,
        errorKey: 'photo_err_read_failed',
        errorFallback: 'Fotoğraf dosyası okunamadı veya bozuk.'
      });
    };

    reader.onload = (e) => {
      const rawUrl = e.target?.result as string;
      if (!rawUrl) {
        resolve({
          valid: false,
          errorKey: 'photo_err_read_failed',
          errorFallback: 'Fotoğraf verisi alınamadı.'
        });
        return;
      }

      const img = new Image();
      img.onerror = () => {
        // Çözümlenemeyen veya bozuk resimlerde ASLA ham veriye dönülmez!
        resolve({
          valid: false,
          errorKey: 'photo_err_corrupted',
          errorFallback: 'Görsel içeriği çözümlenemedi. Lütfen farklı bir resim yükleyin.'
        });
      };

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height *= maxDimension / width;
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width *= maxDimension / height;
              height = maxDimension;
            }
          }

          canvas.width = Math.round(width);
          canvas.height = Math.round(height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              valid: false,
              errorKey: 'photo_err_processing',
              errorFallback: 'Görsel işlenemedi.'
            });
            return;
          }

          // Yalnızca saf pikseller canvas'a çizilir
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Sıfırdan temiz ve standardize JPEG üretilir (tüm metadata temizlenmiştir)
          const cleanDataUrl = canvas.toDataURL('image/jpeg', quality);

          resolve({
            valid: true,
            sanitizedDataUrl: cleanDataUrl
          });
        } catch (canvasErr) {
          resolve({
            valid: false,
            errorKey: 'photo_err_processing',
            errorFallback: 'Görsel işleme sırasında hata oluştu.'
          });
        }
      };

      img.src = rawUrl;
    };

    reader.readAsDataURL(file);
  });
}
