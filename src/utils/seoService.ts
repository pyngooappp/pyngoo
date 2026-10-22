// Multilingual Global SEO Service for Pyngoo
// Targets top global search volume keywords for live video chat, social community, and creator discovery

export interface SeoMeta {
  title: string;
  description: string;
  keywords: string;
  ogLocale: string;
}

export const SEO_DATA: Record<string, SeoMeta> = {
  tr: {
    title: "Görüntülü Chat & Canlı Sosyal Sohbet Topluluğu | Pyngoo",
    description: "Görüntülü chat ile anında yeni insanlarla tanış! Ücretsiz, güvenli ve yapay zeka korumalı canlı görüntülü sohbet topluluğu Pyngoo'da seni bekliyor.",
    keywords: "görüntülü chat, canli goruntulu chat, goruntulu sohbet, canli goruntulu sohbet, ucretsiz goruntulu chat, canli yayin sohbet, sosyal topluluk, kameralı sohbet odaları, canlı sohbet, yeni arkadasliklar, pyngoo",
    ogLocale: "tr_TR"
  },
  en: {
    title: "Live Video Chat Community | Meet New People Worldwide | Pyngoo",
    description: "Meet new people instantly with Pyngoo live video chat! Free, safe, and AI-moderated live video discovery with instant matching and vibrant creator community.",
    keywords: "live video chat, meet new people, video discovery, live cam community, social discovery, live stream video, safe video chat, interactive video chat, pyngoo",
    ogLocale: "en_US"
  },
  de: {
    title: "Live-Video-Chat & Soziale Community | Neue Leute kennenlernen | Pyngoo",
    description: "Lerne sofort neue Leute kennen mit Pyngoo Video Chat! Kostenloser, sicherer und KI-moderierter Zufalls-Video-Chat mit Fremden weltweit im Browser.",
    keywords: "live videochat, soziale community, cam chat kostenlos, neue leute kennenlernen, live video discovery, sicher chatten, pyngoo",
    ogLocale: "de_DE"
  },
  fr: {
    title: "Chat Vidéo en Direct & Communauté Sociale | Nouvelles Rencontres | Pyngoo",
    description: "Rencontrez de nouvelles personnes instantanément avec le chat vidéo en direct Pyngoo ! Gratuit, sécurisé et modéré par IA.",
    keywords: "chat video en direct, communaute sociale, webcam chat gratuit, decouvertes en direct, rencontre amicale, pyngoo",
    ogLocale: "fr_FR"
  },
  es: {
    title: "Videochat en Vivo & Comunidad Social | Conoce Gente Nueva | Pyngoo",
    description: "¡Conoce gente nueva al instante con el videochat en vivo de Pyngoo! Chat de cámara seguro y moderado por IA con creadores de todo el mundo.",
    keywords: "videochat en vivo, comunidad social, chat de camara gratis, conocer gente nueva, videollamadas seguras, pyngoo",
    ogLocale: "es_ES"
  },
  ru: {
    title: "Прямой Видеочат & Социальное Сообщество | Новые Знакомства | Pyngoo",
    description: "Знакомьтесь с новыми людьми мгновенно в живом видеочате Pyngoo! Безопасный видеочат с активным сообществом и модерацией ИИ.",
    keywords: "живой видеочат, социальное сообщество, видеочат онлайн бесплатно, безопасное общение, новые знакомства, pyngoo",
    ogLocale: "ru_RU"
  },
  ar: {
    title: "مجتمع دردشة فيديو حية وتواصل اجتماعي | تعارف على أصدقاء جدد | Pyngoo",
    description: "تعرف على أصدقاء جدد فوراً عبر دردشة الفيديو الحية Pyngoo! منصة تواصل اجتماعي آمنة ومحمية بالذكاء الاصطناعي.",
    keywords: "دردشة فيديو حية, مجتمع اجتماعي, تواصل مباشر, تعارف أصدقاء, دردشة كاميرا آمنة, pyngoo",
    ogLocale: "ar_SA"
  },
  az: {
    title: "Canlı Video Çat & Sosial İcma | Yeni İnsanlarla Tanışlıq | Pyngoo",
    description: "Pyngoo video çat ilə dərhal yeni insanlarla tanış olun! Pulsuz, təhlükəsiz və süni intellekt qorumalı canlı video və səsli sosial platforma.",
    keywords: "canlı video söhbət, canlı kameralı chat, yeni insanlarla tanış ol, sosial kəşf, görüntülü danışıq, pulsuz görüntülü söhbət, pyngoo",
    ogLocale: "az_AZ"
  },
  it: {
    title: "Videochat dal Vivo & Comunità Sociale | Incontra Nuove Persone | Pyngoo",
    description: "Incontra nuove persone all'istante con la videochat dal vivo di Pyngoo! Chat live gratuita, sicura e moderata da intelligenza artificiale.",
    keywords: "videochat dal vivo, comunita sociale, incontrare nuove persone, chat video sicura, social discovery, pyngoo",
    ogLocale: "it_IT"
  },
  pt: {
    title: "Vídeo Chat ao Vivo & Comunidade Social | Conheça Novas Pessoas | Pyngoo",
    description: "Conheça novas pessoas instantaneamente com o vídeo chat ao vivo Pyngoo! Comunidade social segura e com moderação por IA.",
    keywords: "video chat ao vivo, comunidade social, conhecer novas pessoas, videochamada segura, descoberta social, pyngoo",
    ogLocale: "pt_BR"
  }
};

export const updateSeoForLanguage = (rawLang: string) => {
  if (typeof document === 'undefined') return;

  const langKey = (rawLang || 'tr').toLowerCase().split('-')[0];
  const meta = SEO_DATA[langKey] || SEO_DATA['tr'] || SEO_DATA['en'];

  document.documentElement.lang = langKey;
  document.title = meta.title;

  const updateMetaTag = (selector: string, attr: string, value: string) => {
    let el = document.querySelector(selector);
    if (el) {
      el.setAttribute(attr, value);
    }
  };

  updateMetaTag('meta[name="title"]', 'content', meta.title);
  updateMetaTag('meta[name="description"]', 'content', meta.description);
  updateMetaTag('meta[name="keywords"]', 'content', meta.keywords);
  updateMetaTag('meta[property="og:title"]', 'content', meta.title);
  updateMetaTag('meta[property="og:description"]', 'content', meta.description);
  updateMetaTag('meta[property="og:locale"]', 'content', meta.ogLocale);
  updateMetaTag('meta[name="twitter:title"]', 'content', meta.title);
  updateMetaTag('meta[name="twitter:description"]', 'content', meta.description);
};
