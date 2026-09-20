/**
 * Pyngoo Akıllı Çeviri Servisi (Realtime Translation Engine)
 * MyMemory Translation API (CORS serbest) + Google Translate Fallback
 * Kesintisiz, limitsiz ve iki yönlü anında çeviri sağlar.
 */

// Sık kullanılan ifadeler için bellek içi hızlı önbellek (0ms gecikme)
const translationCache = new Map<string, string>();

/**
 * HTML özel karakterlerini çözer (&amp;, &#39;, &quot; vb.)
 */
function decodeHtmlEntities(str: string): string {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'");
}

export async function translateText(
  text: string, 
  targetLang: string = 'en', 
  sourceLang: string = 'auto'
): Promise<string> {
  if (!text || !text.trim()) return text;
  
  const trimmed = text.trim();
  const cleanTarget = (targetLang || 'en').substring(0, 2).toLowerCase();
  const cleanSource = (sourceLang || 'auto').substring(0, 2).toLowerCase();

  // Hedef ile kaynak dil aynıysa çeviriye gerek yok
  if (cleanSource !== 'au' && cleanSource === cleanTarget) {
    return trimmed;
  }

  const cacheKey = `${cleanSource}_${cleanTarget}_${trimmed.toLowerCase()}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  // 1. Birincil Motor: MyMemory API (CORS açık, 429 engeli yemez, yüksek doğruluk)
  try {
    const langPair = cleanSource === 'au' ? `autodetect|${cleanTarget}` : `${cleanSource}|${cleanTarget}`;
    const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${langPair}`;
    
    const response = await fetch(myMemoryUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.responseData?.translatedText) {
        const result = decodeHtmlEntities(data.responseData.translatedText).trim();
        // Eğer MyMemory mantıklı bir çeviri verdiyse kaydet
        if (result && result.toLowerCase() !== trimmed.toLowerCase()) {
          translationCache.set(cacheKey, result);
          return result;
        }
      }
    }
  } catch (err) {
    console.warn('MyMemory çeviri motoru hatası, Google fallback devrede:', err);
  }

  // 2. İkincil Motor (Fallback): Google Translate GTX API
  try {
    const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${cleanSource === 'au' ? 'auto' : cleanSource}&tl=${cleanTarget}&dt=t&q=${encodeURIComponent(trimmed)}`;
    const gResponse = await fetch(googleUrl);
    if (gResponse.ok) {
      const gData = await gResponse.json();
      if (gData && gData[0] && Array.isArray(gData[0])) {
        const translated = gData[0].map((item: any) => item[0]).filter(Boolean).join('');
        if (translated) {
          const cleanResult = decodeHtmlEntities(translated).trim();
          translationCache.set(cacheKey, cleanResult);
          return cleanResult;
        }
      }
    }
  } catch (gErr) {
    console.warn('Google Translate fallback hatası:', gErr);
  }

  return trimmed;
}
