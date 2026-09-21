export interface LegalContent {
  isRtl?: boolean;
  tabs: {
    terms: string;
    privacy: string;
    refund: string;
    kvkk: string;
    cookies: string;
  };
  zeroTolerance: {
    title: string;
    desc: string;
  };
  terms: {
    ageTitle: string;
    ageDesc: string;
    modTitle: string;
    modDesc: string;
    blockTitle: string;
    blockDesc: string;
    coinsTitle: string;
    coinsDesc: string;
    deleteTitle: string;
    deleteDesc: string;
  };
  refund: {
    badgeTitle: string;
    badgeDesc: string;
    sec1Title: string;
    sec1Desc: string;
    sec2Title: string;
    sec2Desc: string;
    sec3Title: string;
    sec3Desc: string;
    sec4Title: string;
    sec4Desc: string;
    sec5Title: string;
    sec5Desc: string;
    sec6Title: string;
    sec6Desc: string;
    sec7Title: string;
    sec7Desc: string;
  };
  privacy: {
    sec1Title: string;
    sec1Desc: string;
    sec2Title: string;
    sec2Desc: string;
    sec3Title: string;
    sec3Desc: string;
    sec4Title: string;
    sec4Desc: string;
  };
  kvkk: {
    sec1Title: string;
    sec1Desc: string;
    sec2Title: string;
    sec2Desc: string;
    sec3Title: string;
    sec3Desc: string;
  };
  cookies: {
    title: string;
    desc: string;
  };
}

const translations: Record<string, LegalContent> = {
  tr: {
    tabs: { terms: 'Kullanıcı Sözleşmesi', privacy: 'Gizlilik', refund: 'İptal & İade', kvkk: 'KVKK', cookies: 'Çerezler' },
    zeroTolerance: {
      title: 'SIFIR TOLERANS POLİTİKASI (Apple & Google Kuralı)',
      desc: 'Pyngoo platformunda taciz, çıplaklık, cinsel içerik, reşit olmayan bireylerin istismarı, nefret söylemi ve yasa dışı faaliyetlere KESİNLİKLE SIFIR TOLERANS gösterilir. Bu kuralları ihlal eden kullanıcılar sistemden DERHAL ve KALICI OLARAK yasaklanır.'
    },
    terms: {
      ageTitle: '1. Yaş Sınırı (18+)',
      ageDesc: 'Pyngoo uygulamasını kullanabilmek için en az 18 yaşında olmanız gerekmektedir. 18 yaşın altındaki bireylerin uygulamayı kullanması kesinlikle yasaktır.',
      modTitle: '2. 24 Saat İçerisinde İnceleme Taahhüdü',
      modDesc: 'Kullanıcılar tarafından iletilen tüm şikayet ve delil kayıtları insan moderasyon ekibimiz tarafından en geç 24 saat içinde titizlikle incelenir. İhlal tespit edilen hesaplar kalıcı olarak silinir ve engellenir.',
      blockTitle: '3. Kullanıcı Engelleme (Block) ve Şikayet',
      blockDesc: 'Kullanıcılar, istemedikleri kişileri diledikleri an görüşme ve mesaj ekranındaki "Engelle" butonu ile engelleyebilir. Engellenen kullanıcılar sizinle bir daha asla eşleşemez ve size ulaşamaz.',
      coinsTitle: '4. Sanal Para (Altın / Elmas) ve İadeler',
      coinsDesc: 'Uygulama içindeki altın ve elmaslar dijital ürünlerdir. Harcanan veya kısmen kullanılan altınlar iade edilmez. Kullanılmamış paketler için İptal ve İade Politikamızdaki 14 günlük şartlar geçerlidir.',
      deleteTitle: '5. Hesap Silme Hakkı',
      deleteDesc: 'Kullanıcı dilediği zaman profil ekranından "Hesabımı Sil" butonuna basarak tüm verilerini ve hesabını kalıcı olarak sistemden yok edebilir.'
    },
    refund: {
      badgeTitle: '14 GÜNLÜK KULLANILMAMIŞ BAKİYE İADE GARANTİSİ',
      badgeDesc: 'Satın aldığınız altın paketini hiç kullanmadıysanız 14 gün içinde kesintisiz tam iade talep edebilirsiniz.',
      sec1Title: '1. Dijital Ürünlerin Niteliği ve Cayma Hakkı Kapsamı',
      sec1Desc: '6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği\'nin 15/ğ maddesi uyarınca; elektronik ortamda anında ifa edilen hizmetler veya tüketiciye anında teslim edilen gayrimaddi mallara ilişkin sözleşmelerde genel olarak cayma hakkı kullanılamaz. Ancak Pyngoo olarak müşteri memnuniyeti ilkemiz gereği, tamamen kullanılmamış paketler için 14 günlük iade hakkı tanımaktayız.',
      sec2Title: '2. İade Edilebilir Durumlar (14 Günlük Koşul)',
      sec2Desc: 'Satın alma tarihinden itibaren en geç 14 gün içerisinde yazılı olarak başvurulması ve satın alınan Altın paketinden HİÇBİR ŞEKİLDE HARCAMA YAPILMAMIŞ (%100 tam bakiye duruyor olması) şartıyla sipariş tutarınız eksiksiz iade edilir. İade talebiniz destek ekibimizce 24 saat içerisinde incelenir ve onaylandığında 3-7 iş günü içinde kartınıza/hesabınıza yansıtılır.',
      sec3Title: '3. İade Edilemeyen Durumlar (Harcanmış Altınlar)',
      sec3Desc: 'Satın alınan altınların bir kısmı dahi olsa canlı sesli/görüntülü görüşmede süre uzatmada (+60s), eşleşmede veya yayıncılara hediye (gül, kahve vb.) olarak harcandıysa; hizmet anında ifa edilmiş ve üçüncü şahıslara (yayıncı elması olarak) aktarılmış sayıldığından kısmi veya tam iade kesinlikle yapılamaz.',
      sec4Title: '4. Aylık VIP Kulübü Abonelik İptali',
      sec4Desc: 'VIP Kulübü üyeliğinizi profilinizden dilediğiniz an tek tıkla iptal edebilirsiniz. İptal ettiğinizde mevcut dönemin sonuna kadar VIP ayrıcalıklarınız devam eder ve sonraki ay kartınızdan çekim yapılmaz. İlk 14 gün içinde hiçbir VIP avantajı (günlük 50 altın, ücretsiz uzatmalar vb.) kullanılmamışsa tam iade yapılır.',
      sec5Title: '5. Kural İhlali Sebebiyle Yasaklanan Hesaplar',
      sec5Desc: 'Topluluk Güvenlik Kuralları (çıplaklık, taciz, reşit olmayan kullanım, dolandırıcılık) sebebiyle moderatörlerimiz tarafından kalıcı olarak yasaklanan kullanıcıların hesaplarında kalan sanal bakiyeler için iade yapılmaz.',
      sec6Title: '6. Mükerrer (Çift) Çekim ve Teknik Hatalar',
      sec6Desc: 'Banka veya internet bağlantısı kaynaklı mükerrer çekimlerde ya da ödemesi yapıldığı halde 1 saat içinde cüzdana yansımayan paketlerde dekontunuz incelenerek mükerrer tutar derhal ve kesintisiz iade edilir.',
      sec7Title: '7. İade Başvuru Kanalı',
      sec7Desc: 'İade ve iptal taleplerinizi sipariş kodunuz (PYN-XXXX) ve kayıtlı kullanıcı adınız ile birlikte resmi destek adresimize iletebilirsiniz: destek@pyngoo.app'
    },
    privacy: {
      sec1Title: '1. Kamera ve Mikrofon İzinleri',
      sec1Desc: 'Kamera ve mikrofon erişimi yalnızca eşleştiğiniz kullanıcıyla canlı WebRTC sesli ve görüntülü görüşme yapabilmeniz için anlık olarak kullanılır. Görüşmeleriniz sunucularımızda KESİNLİKLE kaydedilmez veya depolanmaz.',
      sec2Title: '2. Yapay Zeka Yüz Doğrulaması (Kadın Üyeler)',
      sec2Desc: 'Kadın kayıtlarında sahte profil ve botları önlemek amacıyla tarayıcınızda yerel yapay zeka ile anlık canlı yüz tespiti yapılır. Fotoğrafınız hiçbir yere gönderilmez, biyometrik veri olarak saklanmaz.',
      sec3Title: '3. Veri Satışı Yapılmaması Garantisi',
      sec3Desc: 'Kişisel bilgileriniz (takma adınız, e-postanız) hiçbir 3. taraf reklam şirketi veya veri komisyoncusu ile paylaşılmaz ve satılmaz.',
      sec4Title: '4. Veri Silme ve Hesabı Kapatma',
      sec4Desc: 'Apple Guideline 5.1.1(v) ve Google Play kuralları gereği profilinizden "Hesabımı Sil" dediğiniz anda veritabanındaki tüm profiliniz, mesajlarınız ve arkadaşlıklarınız kalıcı olarak silinir.'
    },
    kvkk: {
      sec1Title: '1. Veri Sorumlusu ve Hizmet Sağlayıcı',
      sec1Desc: '6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve Avrupa Genel Veri Koruma Tüzüğü (GDPR) kapsamında; resmi şirketleşme tescil süreci tamamlanana kadar platformun tüm operasyonel, teknik ve yasal veri sorumluluğu Pyngoo Yönetimi ve Geliştirici Ekibi ("Pyngoo Management", destek@pyngoo.app) tarafından üstlenilmekte ve yürütülmektedir.',
      sec2Title: '2. İlgili Kişi Hakları',
      sec2Desc: 'Kullanıcılarımız diledikleri zaman kişisel verilerinin işlenip işlenmediğini öğrenme, yanlış verileri düzelttirme, verilerinin silinmesini talep etme hakkına sahiptir.',
      sec3Title: '3. İletişim & Destek',
      sec3Desc: 'Veri güvenliği ve tüm yasal talepleriniz için bize resmi e-posta adresimiz üzerinden ulaşabilirsiniz: destek@pyngoo.app'
    },
    cookies: {
      title: 'Çerezlerin Kullanımı',
      desc: 'Pyngoo, oturumunuzu açık tutmak, dil tercihinizi hatırlamak ve güvenliğinizi sağlamak amacıyla zorunlu teknik çerezler ve yerel depolama (Local Storage) kullanır. Reklam takip çerezi kullanılmaz.'
    }
  },

  en: {
    tabs: { terms: 'Terms & EULA', privacy: 'Privacy', refund: 'Refund Policy', kvkk: 'GDPR / Privacy', cookies: 'Cookies' },
    zeroTolerance: {
      title: 'ZERO TOLERANCE POLICY (Apple & Google Rule)',
      desc: 'Pyngoo maintains a strict ZERO TOLERANCE policy for harassment, nudity, sexual content, exploitation of minors, hate speech, and illegal activities. Accounts violating these rules are permanently and immediately banned without exception.'
    },
    terms: {
      ageTitle: '1. Age Requirement (18+)',
      ageDesc: 'You must be at least 18 years of age to register and use Pyngoo. Minors are strictly prohibited from accessing this service.',
      modTitle: '2. 24-Hour Moderation Commitment',
      modDesc: 'All user reports and flagged interactions are actively reviewed by human moderators within 24 hours. Accounts found in violation are banned permanently.',
      blockTitle: '3. User Blocking and Reporting',
      blockDesc: 'Users have the right and ability to block any user at any time during calls or chats. Blocked users will never match with you again and cannot contact you.',
      coinsTitle: '4. Virtual Currency & In-App Purchases',
      coinsDesc: 'In-app gold and diamonds are virtual items. Used balances are non-refundable. For unused packages, refer to our 14-day refund policy.',
      deleteTitle: '5. Account Deletion',
      deleteDesc: 'Users can permanently delete their account and associated data at any time via the "Delete Account" button in profile settings.'
    },
    refund: {
      badgeTitle: '14-DAY UNUSED BALANCE REFUND GUARANTEE',
      badgeDesc: 'If you have not used your purchased gold package, you are eligible for a 100% full refund within 14 calendar days.',
      sec1Title: '1. Nature of Virtual Goods & Right of Withdrawal',
      sec1Desc: 'In accordance with consumer protection regulations concerning digital goods supplied instantaneously, statutory withdrawal rights generally do not apply once digital goods are delivered. However, under Pyngoo\'s customer guarantee, completely unused virtual packages are eligible for a 14-day refund period.',
      sec2Title: '2. Eligible Refund Conditions (14-Day Rule)',
      sec2Desc: 'A full refund is granted within 14 calendar days from purchase date ONLY IF the purchased Gold package has not been consumed at all (100% untouched balance). Once approved by support, funds return to your original payment method in 3-7 business days.',
      sec3Title: '3. Non-Refundable Circumstances (Used Coins)',
      sec3Desc: 'Once any portion of purchased gold is spent on call matching, call extensions (+60s), or live gifts (roses, coffee, etc.), the digital service is irreversibly fulfilled and credited to creators. Partial or full refunds are strictly impossible for used balances.',
      sec4Title: '4. Monthly VIP Pass Cancellation',
      sec4Desc: 'You can cancel your VIP Pass membership anytime from your profile. Benefits continue until the end of the current billing cycle without renewing. If no VIP perks (daily gold, extensions) were claimed within the first 14 days, a full refund can be issued upon request.',
      sec5Title: '5. Banned Accounts & Policy Violations',
      sec5Desc: 'Users permanently banned for severe violations of our Safety Guidelines (harassment, nudity, underage access, fraud) forfeit all remaining virtual balances with no refund.',
      sec6Title: '6. Duplicate Charges & Technical Errors',
      sec6Desc: 'Duplicate bank transactions or technical delivery failures where coins fail to arrive within 1 hour will be promptly resolved with an instant, unconditional refund upon receipt verification.',
      sec7Title: '7. How to Request a Refund',
      sec7Desc: 'Send your refund requests including your order code (PYN-XXXX) and registered username to our official support desk: destek@pyngoo.app'
    },
    privacy: {
      sec1Title: '1. Camera and Microphone Permissions',
      sec1Desc: 'Camera and microphone access are utilized strictly for real-time peer-to-peer WebRTC live calls. Your calls are NEVER recorded, monitored, or stored on our servers.',
      sec2Title: '2. AI Face Verification',
      sec2Desc: 'Local browser-based AI face detection is used during female onboarding solely to prevent bots and catfish. No facial biometric data is stored or transmitted externally.',
      sec3Title: '3. No Data Sale Guarantee',
      sec3Desc: 'We do not sell, rent, or trade your personal information with third-party advertisers or data brokers under any circumstances.',
      sec4Title: '4. Data Deletion & Account Termination',
      sec4Desc: 'In compliance with Apple Guideline 5.1.1(v) and Google Play policies, deleting your account permanently purges your profile, messages, and friendships from our database.'
    },
    kvkk: {
      sec1Title: '1. Data Controller & Service Operator',
      sec1Desc: 'Under GDPR and applicable international data protection frameworks, all operational, technical, and data controller responsibilities for Pyngoo are officially managed by the Pyngoo Platform Operations & Development Team ("Pyngoo Management", contact: destek@pyngoo.app) prior to formal corporate registry completion.',
      sec2Title: '2. Data Subject Rights',
      sec2Desc: 'Users retain the right to access, rectify, or request total erasure of their stored personal data at any time.',
      sec3Title: '3. Contact & Support',
      sec3Desc: 'For privacy inquiries and legal requests, please contact our support team at: destek@pyngoo.app'
    },
    cookies: {
      title: 'Use of Cookies & Local Storage',
      desc: 'Pyngoo uses essential functional cookies and local storage exclusively to maintain your login session, language preference, and security. No cross-site advertising cookies are used.'
    }
  },

  de: {
    tabs: { terms: 'AGB & EULA', privacy: 'Datenschutz', refund: 'Erstattung', kvkk: 'DSGVO', cookies: 'Cookies' },
    zeroTolerance: {
      title: 'NULL-TOLERANZ-POLITIK (Apple & Google Richtlinie)',
      desc: 'Pyngoo verfolgt eine strikte NULL-TOLERANZ-Politik gegenüber Belästigung, Nacktheit, sexuellen Inhalten, Missbrauch von Minderjährigen, Hassrede und rechtswidrigen Handlungen. Konten, die gegen diese Regeln verstoßen, werden unverzüglich und dauerhaft gesperrt.'
    },
    terms: {
      ageTitle: '1. Mindestalter (18+)',
      ageDesc: 'Sie müssen mindestens 18 Jahre alt sein, um Pyngoo zu nutzen. Minderjährigen ist die Nutzung dieser Plattform strengstens untersagt.',
      modTitle: '2. 24-Stunden-Prüfungsverpflichtung',
      modDesc: 'Alle Benutzermeldungen und Vorfälle werden innerhalb von 24 Stunden von unserem Moderationsteam überprüft. Verstöße führen zur sofortigen dauerhaften Sperre.',
      blockTitle: '3. Benutzer blockieren & melden',
      blockDesc: 'Sie können jeden Benutzer während eines Anrufs oder Chats sofort blockieren. Blockierte Benutzer können Sie nie wieder kontaktieren oder matchen.',
      coinsTitle: '4. Virtuelle Währung & In-App-Käufe',
      coinsDesc: 'Gold und Diamanten sind digitale Güter. Verbrauchte Guthaben können nicht erstattet werden. Für ungenutzte Pakete gilt unsere 14-tägige Erstattungsrichtlinie.',
      deleteTitle: '5. Recht auf Kontolöschung',
      deleteDesc: 'Sie können Ihr Konto und alle zugehörigen Daten jederzeit über die Schaltfläche "Konto löschen" in den Profileinstellungen dauerhaft entfernen.'
    },
    refund: {
      badgeTitle: '14 TAGE ERSTATTUNGSGARANTIE FÜR UNGENUTZTES GUTHABEN',
      badgeDesc: 'Wenn Sie Ihr gekauftes Goldpaket noch nicht verwendet haben, haben Sie innerhalb von 14 Tagen Anspruch auf eine volle Rückerstattung.',
      sec1Title: '1. Art digitaler Güter & Widerrufsrecht',
      sec1Desc: 'Gemäß den Verbraucherschutzvorschriften für sofort bereitgestellte digitale Inhalte erlischt das gesetzliche Widerrufsrecht in der Regel mit der Bereitstellung. Pyngoo gewährt Ihnen jedoch aus Kundenservicegründen ein 14-tägiges Rückgaberecht für vollständig unberührte Pakete.',
      sec2Title: '2. Erstattungsfähige Bedingungen (14-Tage-Regel)',
      sec2Desc: 'Eine volle Rückerstattung wird innerhalb von 14 Tagen ab Kaufdatum gewährt, WENN das gekaufte Goldpaket zu 100% ungenutzt ist. Nach Bestätigung erfolgt die Rückzahlung innerhalb von 3-7 Werktagen.',
      sec3Title: '3. Nicht erstattungsfähige Fälle (Verbrauchtes Gold)',
      sec3Desc: 'Wurde auch nur ein Teil des Goldes für Anrufverlängerungen (+60s), Matching oder Geschenke ausgegeben, gilt die Leistung als unwiderruflich erbracht. Teil- oder Vollrückerstattungen sind ausgeschlossen.',
      sec4Title: '4. Kündigung des monatlichen VIP-Passes',
      sec4Desc: 'Sie können Ihre VIP-Mitgliedschaft jederzeit in Ihrem Profil kündigen. Die Vorteile bleiben bis zum Ende des aktuellen Abrechnungszeitraums aktiv.',
      sec5Title: '5. Gesperrte Konten bei Richtlinienverstößen',
      sec5Desc: 'Benutzer, die wegen schwerer Verstöße (Nacktheit, Belästigung, Betrug) gesperrt werden, verlieren jegliches verbleibende Guthaben ohne Anspruch auf Rückzahlung.',
      sec6Title: '6. Doppelabbuchungen & Technische Fehler',
      sec6Desc: 'Bei unbeabsichtigten Doppelbuchungen oder technischen Lieferproblemen erstatten wir den Betrag nach Vorlage des Belegs unverzüglich zurück.',
      sec7Title: '7. Rückerstattung beantragen',
      sec7Desc: 'Senden Sie Ihre Anfrage mit Ihrem Bestellcode (PYN-XXXX) und Benutzernamen an: destek@pyngoo.app'
    },
    privacy: {
      sec1Title: '1. Kamera- und Mikrofonberechtigungen',
      sec1Desc: 'Kamera und Mikrofon werden ausschließlich für verschlüsselte Peer-to-Peer-Echtzeitgespräche (WebRTC) genutzt. Es finden KEINE Aufzeichnungen auf Servern statt.',
      sec2Title: '2. Lokale KI-Gesichtsprüfung',
      sec2Desc: 'Die Identitätsprüfung bei weiblichen Profilen erfolgt rein lokal im Browser zur Fake-Prävention. Keine biometrischen Daten werden extern gespeichert.',
      sec3Title: '3. Kein Datenverkauf',
      sec3Desc: 'Wir verkaufen oder teilen Ihre persönlichen Informationen unter keinen Umständen mit Dritten oder Datenhändlern.',
      sec4Title: '4. Vollständige Datenlöschung',
      sec4Desc: 'Gemäß Apple- und Google-Richtlinien werden beim Klick auf "Konto löschen" sämtliche Profildaten, Chats und Kontakte unwiderruflich gelöscht.'
    },
    kvkk: {
      sec1Title: '1. Verantwortliche Stelle',
      sec1Desc: 'Gemäß DSGVO agiert das Pyngoo-Team als verantwortliche Stelle für die Datenverarbeitung.',
      sec2Title: '2. Betroffenenrechte',
      sec2Desc: 'Sie haben jederzeit das Recht auf Auskunft, Berichtigung oder vollständige Löschung Ihrer Daten.',
      sec3Title: '3. Kontakt & Datenschutzanfragen',
      sec3Desc: 'Bei Fragen zum Datenschutz wenden Sie sich an unseren Support: destek@pyngoo.app'
    },
    cookies: {
      title: 'Verwendung von Cookies & Speicher',
      desc: 'Pyngoo verwendet ausschließlich technisch notwendige Cookies für Sitzungsverwaltung und Spracheinstellungen. Keine Werbe- oder Tracking-Cookies.'
    }
  },

  fr: {
    tabs: { terms: 'Conditions & CLUF', privacy: 'Confidentialité', refund: 'Remboursement', kvkk: 'RGPD', cookies: 'Cookies' },
    zeroTolerance: {
      title: 'POLITIQUE DE TOLÉRANCE ZÉRO (Règle Apple & Google)',
      desc: 'Pyngoo applique une TOLÉRANCE ZÉRO stricte contre le harcèlement, la nudité, les contenus sexuels, l\'exploitation des mineurs, les discours haineux et les activités illicites. Tout compte enfreignant ces règles est banni immédiatement et définitivement.'
    },
    terms: {
      ageTitle: '1. Âge légal requis (18+)',
      ageDesc: 'Vous devez avoir au moins 18 ans pour utiliser Pyngoo. L\'accès est formellement interdit aux personnes mineures.',
      modTitle: '2. Engagement de modération sous 24h',
      modDesc: 'Tous les signalements d\'utilisateurs sont examinés par notre équipe humaine sous 24 heures. Les contrevenants sont immédiatement bannis.',
      blockTitle: '3. Blocage et signalement d\'utilisateurs',
      blockDesc: 'Vous pouvez bloquer tout utilisateur à tout instant lors d\'un appel ou d\'un chat. Un utilisateur bloqué ne pourra plus jamais vous contacter.',
      coinsTitle: '4. Monnaie virtuelle & Achats intégrés',
      coinsDesc: 'L\'or et les diamants sont des biens numériques non remboursables une fois utilisés. Pour les packs intacts, reportez-vous à notre politique de 14 jours.',
      deleteTitle: '5. Droit à l\'effacement du compte',
      deleteDesc: 'Vous pouvez supprimer définitivement votre compte et toutes ses données à tout moment depuis les paramètres du profil.'
    },
    refund: {
      badgeTitle: 'GARANTIE DE REMBOURSEMENT DE 14 JOURS (SOLDE NON UTILISÉ)',
      badgeDesc: 'Si vous n\'avez pas utilisé votre pack d\'or acheté, vous pouvez obtenir un remboursement intégral sous 14 jours.',
      sec1Title: '1. Nature des biens numériques & Droit de rétractation',
      sec1Desc: 'Conformément aux directives de protection des consommateurs sur les contenus numériques fournis instantanément, le droit légal de rétractation prend généralement fin dès la livraison. Cependant, Pyngoo offre un délai de 14 jours pour les packs 100% inutilisés.',
      sec2Title: '2. Conditions de remboursement (Règle des 14 jours)',
      sec2Desc: 'Un remboursement intégral est accordé sous 14 jours à compter de la date d\'achat UNIQUEMENT si le pack n\'a fait l\'objet d\'aucune consommation. Le crédit intervient sous 3 à 7 jours ouvrés.',
      sec3Title: '3. Situations non remboursables (Or consommé)',
      sec3Desc: 'Dès lors qu\'une partie de l\'or a été utilisée pour prolonger un appel (+60s), matcher ou offrir un cadeau, le service est irrévocablement exécuté. Aucun remboursement n\'est alors possible.',
      sec4Title: '4. Résiliation du Pass VIP mensuel',
      sec4Desc: 'Vous pouvez résilier votre abonnement VIP à tout moment depuis votre profil sans frais supplémentaires pour les périodes futures.',
      sec5Title: '5. Comptes bannis pour infraction aux règles',
      sec5Desc: 'Tout compte banni définitivement pour manquement grave (nudité, harcèlement, fraude) perd l\'intégralité de son solde virtuel sans remboursement.',
      sec6Title: '6. Double prélèvement ou Erreur technique',
      sec6Desc: 'En cas de prélèvement bancaire doublé ou de problème technique empêchant la réception des pièces, un remboursement immédiat est accordé sur présentation du reçu.',
      sec7Title: '7. Formuler une demande de remboursement',
      sec7Desc: 'Transmettez votre demande avec votre code de commande (PYN-XXXX) et votre pseudo à : destek@pyngoo.app'
    },
    privacy: {
      sec1Title: '1. Permissions Caméra et Micro',
      sec1Desc: 'La caméra et le micro ne sont utilisés que pour les appels WebRTC en direct de pair à pair. AUCUN enregistrement vidéo ou audio n\'est stocké sur nos serveurs.',
      sec2Title: '2. Vérification faciale par IA locale',
      sec2Desc: 'La vérification des profils féminins s\'exécute localement dans le navigateur pour éradiquer les faux profils. Aucune donnée biométrique n\'est transmise.',
      sec3Title: '3. Engagement de non-vente des données',
      sec3Desc: 'Nous ne vendons ni ne louons vos données personnelles à des publicitaires ou courtiers en données.',
      sec4Title: '4. Suppression définitive des données',
      sec4Desc: 'Conformément aux règles Apple et Google, supprimer votre compte détruit irréversiblement l\'ensemble de vos informations.'
    },
    kvkk: {
      sec1Title: '1. Responsable de traitement',
      sec1Desc: 'Au titre du RGPD, l\'équipe Pyngoo agit en qualité de responsable du traitement de vos données.',
      sec2Title: '2. Vos droits fondamentaux',
      sec2Desc: 'Vous disposez d\'un droit d\'accès, de rectification et d\'effacement complet de vos données.',
      sec3Title: '3. Contact support',
      sec3Desc: 'Pour toute demande d\'ordre juridique ou liée à la confidentialité : destek@pyngoo.app'
    },
    cookies: {
      title: 'Cookies & Stockage local',
      desc: 'Pyngoo n\'utilise que des cookies techniques indispensables à l\'authentification et au maintien de la langue. Aucun traceur publicitaire n\'est employé.'
    }
  },

  es: {
    tabs: { terms: 'Términos y EULA', privacy: 'Privacidad', refund: 'Reembolso', kvkk: 'RGPD', cookies: 'Cookies' },
    zeroTolerance: {
      title: 'POLÍTICA DE TOLERANCIA CERO (Normativa Apple y Google)',
      desc: 'Pyngoo mantiene una política estricta de TOLERANCIA CERO contra el acoso, desnudez, contenido sexual, abuso de menores, incitación al odio y actividades ilícitas. Las cuentas infractoras serán suspendidas de inmediato y para siempre.'
    },
    terms: {
      ageTitle: '1. Requisito de edad (18+)',
      ageDesc: 'Debes tener al menos 18 años para utilizar Pyngoo. Está terminantemente prohibido el acceso a menores de edad.',
      modTitle: '2. Compromiso de revisión en 24 horas',
      modDesc: 'Todas las denuncias son revisadas por moderadores humanos en un plazo máximo de 24 horas. Las cuentas infractoras se cancelan permanentemente.',
      blockTitle: '3. Bloqueo y reporte de usuarios',
      blockDesc: 'Puedes bloquear a cualquier usuario en cualquier instante de una llamada o chat. El usuario bloqueado no podrá contactarte jamás.',
      coinsTitle: '4. Moneda virtual y compras integradas',
      coinsDesc: 'Las monedas de oro y diamantes son bienes digitales. Los saldos consumidos no son reembolsables. Consulta nuestra política de 14 días para packs sin usar.',
      deleteTitle: '5. Derecho a eliminar la cuenta',
      deleteDesc: 'Puedes eliminar tu cuenta y todos sus datos en cualquier momento a través del botón "Eliminar cuenta" en los ajustes de perfil.'
    },
    refund: {
      badgeTitle: 'GARANTÍA DE REEMBOLSO DE 14 DÍAS (SALDO NO UTILIZADO)',
      badgeDesc: 'Si no has utilizado tu paquete de oro adquirido, tienes derecho a un reembolso total dentro de los 14 días posteriores a la compra.',
      sec1Title: '1. Naturaleza de los bienes digitales y Derecho de desistimiento',
      sec1Desc: 'Conforme a la normativa de consumo aplicable a bienes digitales suministrados de inmediato, el derecho legal de desistimiento cesa una vez entregado el producto. Sin embargo, Pyngoo ofrece una garantía de 14 días para paquetes 100% intactos.',
      sec2Title: '2. Condiciones para solicitar reembolso (Plazo de 14 días)',
      sec2Desc: 'Se concederá un reembolso completo dentro de los 14 días naturales siguientes a la compra SIEMPRE Y CUANDO el paquete no haya sido consumido en absoluto. El dinero se reintegra en 3 a 7 días hábiles.',
      sec3Title: '3. Supuestos no reembolsables (Oro consumido)',
      sec3Desc: 'Si parte del oro fue utilizado para extender llamadas (+60s), realizar emparejamientos o enviar regalos a creadores, el servicio se considera consumido y no admite reembolso parcial ni total.',
      sec4Title: '4. Cancelación del Pase VIP mensual',
      sec4Desc: 'Puedes cancelar tu membresía VIP en cualquier momento desde tu perfil. No se realizarán cobros adicionales en el mes siguiente.',
      sec5Title: '5. Cuentas canceladas por infracciones',
      sec5Desc: 'Los usuarios expulsados permanentemente por violar las normas comunitarias (desnudez, acoso, fraude) pierden todo su saldo virtual sin compensación.',
      sec6Title: '6. Cargos duplicados y Errores de entrega',
      sec6Desc: 'Ante cualquier duplicidad en el cargo o fallo técnico comprobable, se realizará un reintegro inmediato tras verificar el comprobante de pago.',
      sec7Title: '7. Cómo solicitar un reembolso',
      sec7Desc: 'Envía tu solicitud con tu código de pedido (PYN-XXXX) y nombre de usuario a: destek@pyngoo.app'
    },
    privacy: {
      sec1Title: '1. Permisos de Cámara y Micrófono',
      sec1Desc: 'La cámara y el micrófono se utilizan exclusivamente para llamadas WebRTC punto a punto. NINGUNA llamada es grabada ni almacenada en servidores.',
      sec2Title: '2. Verificación facial con IA local',
      sec2Desc: 'La verificación en perfiles femeninos se procesa localmente en el navegador para evitar cuentas falsas. No se guardan datos biométricos externos.',
      sec3Title: '3. Garantía de no venta de datos',
      sec3Desc: 'No comercializamos ni cedemos tus datos personales a empresas de publicidad ni a intermediarios de datos.',
      sec4Title: '4. Eliminación definitiva de información',
      sec4Desc: 'Cumpliendo con las directrices de Apple y Google, al eliminar tu cuenta se borran todos tus registros de forma irrevocable.'
    },
    kvkk: {
      sec1Title: '1. Responsable del tratamiento',
      sec1Desc: 'Bajo el RGPD, el equipo de Pyngoo actúa como responsable del tratamiento de los datos del usuario.',
      sec2Title: '2. Derechos del interesado',
      sec2Desc: 'Tienes derecho a acceder, rectificar o exigir la supresión completa de tus datos personales.',
      sec3Title: '3. Soporte y Contacto',
      sec3Desc: 'Para cualquier consulta de privacidad, escribe a: destek@pyngoo.app'
    },
    cookies: {
      title: 'Uso de Cookies y Almacenamiento',
      desc: 'Pyngoo solo utiliza cookies técnicas necesarias para mantener tu sesión activa y recordar tu idioma. No usamos cookies de seguimiento publicitario.'
    }
  },

  ru: {
    tabs: { terms: 'Условия и EULA', privacy: 'Конфиденциальность', refund: 'Возврат средств', kvkk: 'GDPR', cookies: 'Файлы cookie' },
    zeroTolerance: {
      title: 'ПОЛИТИКА НУЛЕВОЙ ТОЛЕРАНТНОСТИ (Правило Apple и Google)',
      desc: 'В приложении Pyngoo действует строгая политика НУЛЕВОЙ ТОЛЕРАНТНОСТИ к оскорблениям, наготе, сексуальному контенту, домогательствам, языку вражды и противоправным действиям. Нарушители блокируются навсегда и без предупреждения.'
    },
    terms: {
      ageTitle: '1. Возрастные ограничения (18+)',
      ageDesc: 'Для использования Pyngoo вам должно быть не менее 18 лет. Несовершеннолетним лицам использование сервиса категорически запрещено.',
      modTitle: '2. Модерация жалоб в течение 24 часов',
      modDesc: 'Все жалобы и доказательства нарушений рассматриваются модераторами в течение 24 часов. Нарушители немедленно блокируются.',
      blockTitle: '3. Блокировка и отправка жалоб',
      blockDesc: 'Вы можете заблокировать любого собеседника во время звонка или чата. Заблокированный пользователь больше никогда с вами не свяжется.',
      coinsTitle: '4. Виртуальная валюта и покупки',
      coinsDesc: 'Золото и алмазы являются цифровыми товарами. Потраченные монеты возврату не подлежат. На неиспользованные пакеты действует 14-дневный срок.',
      deleteTitle: '5. Право на удаление аккаунта',
      deleteDesc: 'Вы можете в любой момент безвозвратно удалить свой аккаунт и все связанные с ним данные в настройках профиля.'
    },
    refund: {
      badgeTitle: '14-ДНЕВНАЯ ГАРАНТИЯ ВОЗВРАТА НЕИСПОЛЬЗОВАННЫХ МОНЕТ',
      badgeDesc: 'Если вы не израсходовали ни одной монеты из купленного пакета, вы можете запросить 100% возврат средств в течение 14 дней.',
      sec1Title: '1. Цифровые товары и отказ от покупки',
      sec1Desc: 'В соответствии с нормами защиты прав потребителей в отношении мгновенно доставляемого цифрового контента, стандартное право отказа аннулируется после доставки. Однако Pyngoo предоставляет 14-дневный срок возврата для абсолютно нетронутых пакетов.',
      sec2Title: '2. Условия возврата средств (Правило 14 дней)',
      sec2Desc: 'Полный возврат оформляется в течение 14 календарных дней со дня оплаты ТОЛЬКО ПРИ УСЛОВИИ, что купленный пакет золота остался 100% нетронутым. Возврат на карту занимает 3-7 рабочих дней.',
      sec3Title: '3. Случаи, не подлежащие возврату (Потраченное золото)',
      sec3Desc: 'Если хотя бы часть золота была использована для продления звонка (+60с), матчинга или подарков стримерам, услуга считается полностью оказанной. Частичный или полный возврат невозможен.',
      sec4Title: '4. Отмена ежемесячной подписки VIP Pass',
      sec4Desc: 'Вы можете отменить подписку VIP в любой момент в профиле. В следующем месяце средства списываться не будут.',
      sec5Title: '5. Аккаунты, заблокированные за нарушения',
      sec5Desc: 'Пользователи, заблокированные за грубые нарушения правил сообщества (нагота, домогательства, мошенничество), теряют весь виртуальный баланс без права на компенсацию.',
      sec6Title: '6. Ошибочные двойные списания',
      sec6Desc: 'При повторном ошибочном списании банком или техническом сбое доставки монет средства возвращаются без комиссий после проверки квитанции.',
      sec7Title: '7. Как подать заявку на возврат',
      sec7Desc: 'Отправьте запрос с кодом заказа (PYN-XXXX) и вашим логином на официальную почту: destek@pyngoo.app'
    },
    privacy: {
      sec1Title: '1. Доступ к камере и микрофону',
      sec1Desc: 'Камера и микрофон используются только для прямых зашифрованных звонков WebRTC. Мы НИКОГДА не записываем и не храним ваши видео- и аудиозвонки.',
      sec2Title: '2. Локальная проверка лиц с помощью ИИ',
      sec2Desc: 'Верификация женских профилей производится локально в браузере для защиты от ботов и фейков. Биометрические данные никуда не отправляются.',
      sec3Title: '3. Защита от продажи данных',
      sec3Desc: 'Мы ни при каких обстоятельствах не продаем и не передаем ваши личные данные рекламным агентствам и третьим лицам.',
      sec4Title: '4. Полное удаление информации',
      sec4Desc: 'Согласно требованиям Apple и Google, при удалении аккаунта все данные, переписки и контакты стираются навсегда.'
    },
    kvkk: {
      sec1Title: '1. Оператор персональных данных',
      sec1Desc: 'В соответствии с регламентом GDPR команда Pyngoo является оператором обработки ваших персональных данных.',
      sec2Title: '2. Права субъекта данных',
      sec2Desc: 'Вы имеете право запросить выгрузку, исправление или полное удаление всех ваших данных.',
      sec3Title: '3. Контакты службы поддержки',
      sec3Desc: 'По всем вопросам конфиденциальности пишите нам на: destek@pyngoo.app'
    },
    cookies: {
      title: 'Использование файлов cookie',
      desc: 'Pyngoo использует только обязательные технические файлы cookie для авторизации и сохранения языка. Мы не используем рекламные трекеры.'
    }
  },

  ar: {
    isRtl: true,
    tabs: { terms: 'الشروط واتفاقية EULA', privacy: 'الخصوصية', refund: 'استرداد الأموال', kvkk: 'حماية البيانات', cookies: 'ملفات تعريف الارتباط' },
    zeroTolerance: {
      title: 'سياسة عدم التسامح مطلقاً (قواعد Apple و Google)',
      desc: 'تطبق منصة Pyngoo سياسة عدم التسامح مطلقاً تجاه التحرش أو العري أو المحتوى الإباحي أو استغلال القاصرين أو خطاب الكراهية. يتم حظر الحسابات المخالفة فوراً ونهائياً.'
    },
    terms: {
      ageTitle: '1. شرط العمر (18+)',
      ageDesc: 'يجب أن يكون عمرك 18 عاماً على الأقل لاستخدام Pyngoo. يُحظر تماماً على القاصرين استخدام هذا التطبيق.',
      modTitle: '2. التزام المراجعة خلال 24 ساعة',
      modDesc: 'تتم مراجعة جميع البلاغات وحالات الانتهاك من قبل فريق المشرفين لدينا خلال 24 ساعة كحد أقصى، ويتم حظر المخالفين نهائياً.',
      blockTitle: '3. حظر المستخدمين والإبلاغ',
      blockDesc: 'يمكنك حظر أي مستخدم في أي وقت أثناء المكالمة أو الدردشة. لن يتمكن المستخدم المحظور من الاتصال بك مرة أخرى مطلقاً.',
      coinsTitle: '4. العملات الافتراضية والمشتريات',
      coinsDesc: 'الذهب والألماس هي سلع رقمية افتراضية. الرصيد المستخدم غير قابل للاسترداد. تطبق سياسة الاسترداد لمدة 14 يوماً على الباقات غير المستخدمة.',
      deleteTitle: '5. حق حذف الحساب',
      deleteDesc: 'يمكنك حذف حسابك وجميع بياناتك نهائياً في أي وقت من خلال زر "حذف الحساب" في إعدادات الملف الشخصي.'
    },
    refund: {
      badgeTitle: 'ضمان استرداد الأموال لمدة 14 يوماً للرصيد غير المستخدم',
      badgeDesc: 'إذا لم تستخدم باقة الذهب المشتراة على الإطلاق، يحق لك استرداد المبلغ كاملاً خلال 14 يوماً.',
      sec1Title: '1. طبيعة السلع الرقمية وحق التراجع',
      sec1Desc: 'وفقاً لقوانين حماية المستهلك الخاصة بالمنتجات الرقمية المسلمة فورياً، يسقط حق التراجع القانوني بمجرد تسليم السلعة. ومع ذلك، توفر Pyngoo مهلة 14 يوماً للباقات غير المستهلكة نهائياً.',
      sec2Title: '2. شروط استرداد الأموال (قاعدة 14 يوماً)',
      sec2Desc: 'يتم منح استرداد كامل خلال 14 يوماً من تاريخ الشراء فقط في حال بقاء باقة الذهب دون أي استخدام (رصيد سليم 100%). يتم إعادة المبلغ خلال 3 إلى 7 أيام عمل.',
      sec3Title: '3. الحالات غير القابلة للاسترداد (الذهب المستهلك)',
      sec3Desc: 'إذا تم إنفاق أي جزء من الذهب لتمديد المكالمات (+60 ثانية) أو المطابقة أو إرسال الهدايا، فإن الخدمة تعتبر قد نُفذت بالكامل ولا يمكن استرداد المبلغ جزئياً أو كلياً.',
      sec4Title: '4. إلغاء اشتراك VIP الشهري',
      sec4Desc: 'يمكنك إلغاء عضوية VIP في أي وقت من ملفك الشخصي ولن يتم خصم أي مبالغ للشهر التالي.',
      sec5Title: '5. الحسابات المحظورة بسبب مخالفة القواعد',
      sec5Desc: 'المستخدمون المحظورون بسبب انتهاكات خطيرة لقواعد الأمان (عري، تحرش، احتيال) يفقدون جميع أرصدتهم الافتراضية دون أي تعويض.',
      sec6Title: '6. الرسوم المكررة والأخطاء الفنية',
      sec6Desc: 'في حال الخصم البنكي المزدوج أو وجود عطل فني في تسليم العملات، يتم رد المبلغ فوراً بعد التحقق من إيصال الدفع.',
      sec7Title: '7. كيفية تقديم طلب الاسترداد',
      sec7Desc: 'أرسل طلبك مع رمز الطلب (PYN-XXXX) واسم المستخدم المسجل إلى البريد الرسمي: destek@pyngoo.app'
    },
    privacy: {
      sec1Title: '1. أذونات الكاميرا والميكروفون',
      sec1Desc: 'تُستخدم الكاميرا والميكروفون فقط للمكالمات المباشرة المشفرة بتقنية WebRTC. لا يتم تسجيل أو تخزين مكالماتك على خوادمنا مطلقاً.',
      sec2Title: '2. التحقق من الوجه بالذكاء الاصطناعي',
      sec2Desc: 'يتم التحقق من الحسابات النسائية محلياً داخل المتصفح لمنع الحسابات الوهمية. لا يتم حفظ أي بيانات بيومترية خارج جهازك.',
      sec3Title: '3. ضمان عدم بيع البيانات',
      sec3Desc: 'نحن لا نبيع أو نشارك معلوماتك الشخصية مع أي شركات إعلانية أو وسطاء بيانات تحت أي ظرف من الظروف.',
      sec4Title: '4. الحذف النهائي للمعلومات',
      sec4Desc: 'امتثالاً لسياسات Apple و Google، يؤدي حذف حسابك إلى مسح كافة بياناتك وسجلات محادثاتك نهائياً وبلا رجعة.'
    },
    kvkk: {
      sec1Title: '1. مسؤول حماية البيانات',
      sec1Desc: 'بموجب اللائحة العامة لحماية البيانات (GDPR)، يعمل فريق Pyngoo كمسؤول عن معالجة البيانات الشخصية.',
      sec2Title: '2. حقوق المستخدم',
      sec2Desc: 'يحق لك في أي وقت طلب الوصول إلى بياناتك أو تصحيحها أو حذفها بالكامل من سجلاتنا.',
      sec3Title: '3. التواصل والدعم الفني',
      sec3Desc: 'لجميع الاستفسارات القانونية والخصوصية، راسلنا عبر: destek@pyngoo.app'
    },
    cookies: {
      title: 'ملفات تعريف الارتباط والتخزين المحلي',
      desc: 'تستخدم منصة Pyngoo فقط ملفات تعريف الارتباط الفنية اللازمة لتسجيل الدخول وحفظ اللغة. لا نستخدم ملفات تتبع إعلانية.'
    }
  },

  az: {
    tabs: { terms: 'İstifadəçi Müqaviləsi', privacy: 'Məxfilik', refund: 'Ləğv və Qaytarma', kvkk: 'GDPR', cookies: 'Kukilər' },
    zeroTolerance: {
      title: 'SIFIR TOLERANTLIQ SİYASƏTİ (Apple və Google Qaydası)',
      desc: 'Pyngoo platformasında təhqir, çılpaqlıq, cinsi məzmun, yetkinlik yaşına çatmayanların istismarı və nifrət nitqinə QƏTİYYƏN SIFIR TOLERANTLIQ göstərilir. Qaydaları pozan istifadəçilər dərhal və həmişəlik bloklanır.'
    },
    terms: {
      ageTitle: '1. Yaş Məhdudiyyəti (18+)',
      ageDesc: 'Pyngoo tətbiqindən istifadə etmək üçün ən azı 18 yaşınız olmalıdır. 18 yaşdan kiçik şəxslərin istifadəsi qəti qadağandır.',
      modTitle: '2. 24 Saat Ərzində Yoxlama Öhdəliyi',
      modDesc: 'İstifadəçilər tərəfindən göndərilən bütün şikayətlər 24 saat ərzində moderatorlarımız tərəfindən araşdırılır və qayda pozuntusu edənlər həmişəlik uzaqlaşdırılır.',
      blockTitle: '3. İstifadəçini Bloklama və Şikayət',
      blockDesc: 'Zəng və ya mesaj ekranındakı "Blokla" düyməsi ilə istəmədiyiniz şəxsi dərhal bloklaya bilərsiniz. Həmin şəxs sizinlə bir daha əlaqə saxlaya bilməz.',
      coinsTitle: '4. Virtual Valyuta və Ödənişlər',
      coinsDesc: 'Qızıllar və almazlar rəqəmsal məhsullardır. Xərclənmiş qızıllar geri qaytarılmır. İstifadə olunmamış paketlər üçün 14 günlük qaytarma siyasətimiz qüvvədədir.',
      deleteTitle: '5. Hesabı Silmək Hüququ',
      deleteDesc: 'Profil bölməsindən "Hesabı Sil" düyməsinə basaraq istənilən vaxt bütün məlumatlarınızı və profilinizi tamamilə silə bilərsiniz.'
    },
    refund: {
      badgeTitle: '14 GÜNLÜK İSTİFADƏ OLUNMAMIŞ BALANSIN QAYTARILMASI ZƏMANƏTİ',
      badgeDesc: 'Satın aldığınız qızıl paketindən istifadə etməmisinizsə, 14 gün ərzində ödənişin tam qaytarılmasını tələb edə bilərsiniz.',
      sec1Title: '1. Rəqəmsal Məhsulların Xüsusiyyəti',
      sec1Desc: 'Elektron mühitdə dərhal təqdim edilən rəqəmsal xidmətlərdə qanunvericiliyə görə imtina hüququ məhdudlaşdırılır. Lakin Pyngoo müştəri məmnuniyyəti prinsipi olaraq 100% toxunulmamış paketlər üçün 14 günlük geri qaytarma hüququ verir.',
      sec2Title: '2. Geri Qaytarıla Bilən Hallar (14 Günlük Qayda)',
      sec2Desc: 'Ödəniş tarixindən etibarən 14 gün ərzində müraciət edildikdə və qızıl paketindən HEÇ BİR İSTİFADƏ EDİLMƏDİYİ təqdirdə məbləğ tam şəkildə geri qaytarılır. Vəsait 3-7 iş günü ərzində kartınıza daxil olur.',
      sec3Title: '3. Qaytarılmayan Hallar (Xərclənmiş Qızıllar)',
      sec3Desc: 'Qızılların az bir hissəsi belə zəngi uzatmağa (+60s), həmsöhbət axtarışına və ya hədiyyələrə sərf olunubsa, xidmət göstərilmiş sayılır və qətiyyən geri qaytarılmır.',
      sec4Title: '4. Aylıq VIP Klubu Abunəliyinin Ləğvi',
      sec4Desc: 'Profilinizdən istədiyiniz vaxt VIP abunəliyinizi ləğv edə bilərsiniz. Növbəti ay üçün kartınızdan heç bir vəsait çıxılmayacaq.',
      sec5Title: '5. Qayda Pozuntusu Səbəbilə Bloklanan Hesablar',
      sec5Desc: 'Təhlükəsizlik qaydalarını (çılpaqlıq, təhqir, fırıldaqçılıq) pozduğu üçün bloklanan istifadəçilərin qalan virtual balansları geri qaytarılmır.',
      sec6Title: '6. Təkrar Çıxarış və Texniki Xətalar',
      sec6Desc: 'Bank və ya sistem xətası nəticəsində təkrar ödəniş çıxıldıqda və ya qızıllar hesaba oturmadıqda, qəbz təqdim edildikdən sonra dərhal tam geri qaytarılır.',
      sec7Title: '7. Müraciət Kanalı',
      sec7Desc: 'Geri qaytarma tələblərinizi sifariş kodunuz (PYN-XXXX) və istifadəçi adınızla rəsmi poçtumuza göndərin: destek@pyngoo.app'
    },
    privacy: {
      sec1Title: '1. Kamera və Mikrofon İcazələri',
      sec1Desc: 'Kamera və mikrofon yalnız WebRTC vasitəsilə canlı görüntülü və səsli danışıq aparmaq üçün istifadə edilir. Zənglər heç bir halda serverlərimizdə yazılmır və saxlanılmır.',
      sec2Title: '2. Yerli Süni İntellekt Yoxlaması',
      sec2Desc: 'Qadın profillərində saxta hesabların qarşısını almaq üçün brauzerdə yerli süni intellekt üz tanıma tətbiq olunur. Şəkilləriniz heç yerə göndərilmir.',
      sec3Title: '3. Məlumatların Satılmaması Zəmanəti',
      sec3Desc: 'Şəxsi məlumatlarınız heç bir halda reklam şirkətlərinə və ya üçüncü tərəflərə satılmır və ötürülmür.',
      sec4Title: '4. Hesabın və Məlumatların Silinməsi',
      sec4Desc: 'Apple və Google qaydalarına uyğun olaraq, hesabınızı sildiyiniz an bütün məlumatlarınız bazadan həmişəlik təmizlənir.'
    },
    kvkk: {
      sec1Title: '1. Məlumat Nəzarətçisi',
      sec1Desc: 'GDPR və müvafiq fərdi məlumatların qorunması qaydalarına əsasən məlumat nəzarətçisi Pyngoo komandasıdır.',
      sec2Title: '2. İstifadəçi Hüquqları',
      sec2Desc: 'İstənilən vaxt məlumatlarınızın silinməsini, düzəldilməsini və ya çıxarışını tələb etmək hüququnuz var.',
      sec3Title: '3. Əlaqə və Dəstək',
      sec3Desc: 'Bütün hüquqi suallar üçün bizə müraciət edin: destek@pyngoo.app'
    },
    cookies: {
      title: 'Kukilərin İstifadəsi',
      desc: 'Pyngoo yalnız təhlükəsiz giriş və dil seçimini saxlamaq üçün zəruri texniki kukilərdən istifadə edir. Reklam izləmə kukisi istifadə olunmur.'
    }
  },

  it: {
    tabs: { terms: 'Termini ed EULA', privacy: 'Privacy', refund: 'Rimborsi', kvkk: 'GDPR', cookies: 'Cookie' },
    zeroTolerance: {
      title: 'POLITICA DI TOLLERANZA ZERO (Regola Apple e Google)',
      desc: 'Pyngoo mantiene una rigorosa politica di TOLLERANZA ZERO contro molestie, nudità, contenuti sessuali, sfruttamento di minori, incitamento all\'odio e atti illeciti. Gli account che violano queste regole vengono bloccati permanentemente e immediatamente.'
    },
    terms: {
      ageTitle: '1. Requisito di età (18+)',
      ageDesc: 'È necessario avere almeno 18 anni per registrarsi e utilizzare Pyngoo. L\'accesso è severamente vietato ai minori.',
      modTitle: '2. Moderazione garantita entro 24 ore',
      modDesc: 'Tutte le segnalazioni inviate dagli utenti vengono esaminate dal nostro team entro 24 ore. Gli account scorretti vengono radiati definitivamente.',
      blockTitle: '3. Blocco e segnalazione degli utenti',
      blockDesc: 'Puoi bloccare qualsiasi utente in qualsiasi momento durante chiamate o chat. L\'utente bloccato non potrà mai più contattarti né abbinarsi a te.',
      coinsTitle: '4. Valuta virtuale e acquisti in-app',
      coinsDesc: 'L\'oro e i diamanti sono beni digitali. I crediti spesi non sono rimborsabili. Per i pacchetti intatti si applica la nostra politica di recesso entro 14 giorni.',
      deleteTitle: '5. Diritto alla cancellazione dell\'account',
      deleteDesc: 'Puoi eliminare definitivamente il tuo account e tutti i dati correlati in qualsiasi momento tramite il pulsante "Elimina account" nel profilo.'
    },
    refund: {
      badgeTitle: 'GARANZIA DI RIMBORSO DI 14 GIORNI PER SALDO INUTILIZZATO',
      badgeDesc: 'Se non hai utilizzato il pacchetto d\'oro acquistato, hai diritto a un rimborso completo al 100% entro 14 giorni.',
      sec1Title: '1. Natura dei beni digitali e Diritto di recesso',
      sec1Desc: 'In conformità con le normative sui diritti dei consumatori relative a beni digitali forniti istantaneamente, il diritto di recesso cessa di norma con la consegna. Tuttavia, Pyngoo concede una garanzia di 14 giorni per pacchetti completamente intatti.',
      sec2Title: '2. Condizioni di rimborso (Regola dei 14 giorni)',
      sec2Desc: 'Il rimborso completo viene accordato entro 14 giorni dall\'acquisto SOLO ED ESCLUSIVAMENTE se il pacchetto non è stato minimamente intaccato. L\'accredito avviene in 3-7 giorni lavorativi.',
      sec3Title: '3. Casi non rimborsabili (Oro utilizzato)',
      sec3Desc: 'Qualora anche solo una frazione dell\'oro sia stata impiegata per estensioni di chiamata (+60s), matchmaking o regali ai creator, il servizio si intende irreversibilmente goduto ed è escluso da rimborso.',
      sec4Title: '4. Disdetta dell\'abbonamento mensile VIP',
      sec4Desc: 'Puoi disdire l\'iscrizione VIP in qualunque momento dal tuo profilo. Nessun addebito verrà effettuato per i mesi successivi.',
      sec5Title: '5. Account sospesi per violazione delle regole',
      sec5Desc: 'Gli utenti radiati definitivamente per gravi violazioni (nudità, molestie, truffa) perdono qualunque saldo virtuale residuo senza possibilità di rimborso.',
      sec6Title: '6. Addebiti doppi ed Errori tecnici',
      sec6Desc: 'In caso di addebito bancario duplicato o mancato accredito delle monete per guasto tecnico, il rimborso viene emesso prontamente previa verifica della ricevuta.',
      sec7Title: '7. Come richiedere il rimborso',
      sec7Desc: 'Invia la tua richiesta con codice ordine (PYN-XXXX) e nome utente all\'indirizzo ufficiale: destek@pyngoo.app'
    },
    privacy: {
      sec1Title: '1. Autorizzazioni Fotocamera e Microfono',
      sec1Desc: 'Fotocamera e microfono sono utilizzati esclusivamente per chiamate WebRTC live peer-to-peer crittografate. NESSUNA chiamata viene registrata né salvata su server.',
      sec2Title: '2. Verifica facciale con IA locale',
      sec2Desc: 'L\'onboarding femminile include un rilevamento facciale IA eseguito in locale nel browser per escludere profili falsi. Nessun dato biometrico viene trasmesso esternamente.',
      sec3Title: '3. Garanzia di non cessione dei dati',
      sec3Desc: 'Non vendiamo, cediamo né condividiamo in alcun caso i tuoi dati personali con aziende pubblicitarie o intermediari terzi.',
      sec4Title: '4. Cancellazione permanente dei dati',
      sec4Desc: 'In conformità con gli standard Apple e Google, l\'eliminazione dell\'account cancella irreversibilmente tutti i tuoi dati, messaggi e collegamenti.'
    },
    kvkk: {
      sec1Title: '1. Titolare del trattamento',
      sec1Desc: 'Ai sensi del GDPR, il team Pyngoo opera in qualità di titolare del trattamento dei dati personali.',
      sec2Title: '2. Diritti dell\'interessato',
      sec2Desc: 'Hai il diritto in qualsiasi momento di richiedere l\'accesso, la rettifica o la cancellazione totale dei tuoi dati personali.',
      sec3Title: '3. Contatti e Assistenza legale',
      sec3Desc: 'Per qualunque richiesta in materia di privacy scrivi a: destek@pyngoo.app'
    },
    cookies: {
      title: 'Uso dei Cookie e Archiviazione Locale',
      desc: 'Pyngoo impiega unicamente cookie tecnici indispensabili all\'accesso e alla memorizzazione della lingua. Non utilizziamo cookie di tracciamento pubblicitario.'
    }
  },

  pt: {
    tabs: { terms: 'Termos e EULA', privacy: 'Privacidade', refund: 'Reembolso', kvkk: 'RGPD', cookies: 'Cookies' },
    zeroTolerance: {
      title: 'POLÍTICA DE TOLERÂNCIA ZERO (Regra Apple e Google)',
      desc: 'O Pyngoo adota uma política rigorosa de TOLERÂNCIA ZERO contra assédio, nudez, conteúdo sexual, exploração de menores, discurso de ódio e ilícitos. Usuários infratores são banidos imediatamente e de forma definitiva.'
    },
    terms: {
      ageTitle: '1. Requisito de Idade (18+)',
      ageDesc: 'Você deve ter pelo menos 18 anos de idade para usar o Pyngoo. O uso por menores de idade é estritamente proibido.',
      modTitle: '2. Compromisso de Moderação em 24 Horas',
      modDesc: 'Todas as denúncias enviadas são analisadas por moderadores humanos em até 24 horas. Contas infratoras são banidas permanentemente.',
      blockTitle: '3. Bloqueio e Denúncia de Usuários',
      blockDesc: 'Você pode bloquear qualquer usuário a qualquer momento durante chamadas ou conversas. O usuário bloqueado nunca mais poderá se conectar a você.',
      coinsTitle: '4. Moeda Virtual e Compras no App',
      coinsDesc: 'Moedas de ouro e diamantes são bens digitais. Saldos consumidos não são reembolsáveis. Para pacotes intactos, consulte nossa política de 14 dias.',
      deleteTitle: '5. Direito de Exclusão de Conta',
      deleteDesc: 'Você pode excluir permanentemente sua conta e todos os dados a qualquer momento pelo botão "Excluir conta" no perfil.'
    },
    refund: {
      badgeTitle: 'GARANTIA DE REEMBOLSO DE 14 DIAS PARA SALDO NÃO UTILIZADO',
      badgeDesc: 'Se você comprou um pacote de ouro e não utilizou nenhuma moeda, tem direito a 100% de reembolso no prazo de 14 dias.',
      sec1Title: '1. Natureza dos Bens Digitais e Direito de Rescisão',
      sec1Desc: 'De acordo com a legislação de defesa do consumidor para produtos digitais entregues instantaneamente, o direito de arrependimento cessa com o fornecimento do item. Contudo, o Pyngoo oferece reembolso no prazo de 14 dias para pacotes 100% intocados.',
      sec2Title: '2. Condições de Reembolso (Regra dos 14 Dias)',
      sec2Desc: 'O reembolso integral é concedido em até 14 dias a partir da compra SOMENTE SE o pacote de ouro adquirido não tiver sido consumido de forma alguma. O crédito é estornado em 3 a 7 dias úteis.',
      sec3Title: '3. Casos Não Reembolsáveis (Ouro Consumido)',
      sec3Desc: 'Caso qualquer fração do ouro tenha sido utilizada em extensões de chamadas (+60s), conexões ou presentes para streamers, o serviço é considerado consumido e não admite reembolso parcial ou total.',
      sec4Title: '4. Cancelamento da Assinatura Mensal VIP',
      sec4Desc: 'Você pode cancelar sua assinatura VIP a qualquer momento pelo seu perfil, sem cobranças para o mês subsequente.',
      sec5Title: '5. Contas Banidas por Violação de Regras',
      sec5Desc: 'Usuários banidos permanentemente por infrações graves (nudez, assédio, fraude) perdem todos os saldos virtuais sem direito a indenização.',
      sec6Title: '6. Cobranças Duplicadas e Falhas Técnicas',
      sec6Desc: 'Em caso de cobrança bancária duplicada ou falha técnica na entrega das moedas, o estorno é realizado prontamente após envio do comprovante.',
      sec7Title: '7. Como Solicitar Reembolso',
      sec7Desc: 'Envie sua solicitação com o código do pedido (PYN-XXXX) e seu nome de usuário para o e-mail oficial: destek@pyngoo.app'
    },
    privacy: {
      sec1Title: '1. Permissões de Câmera e Microfone',
      sec1Desc: 'A câmera e o microfone são acessados estritamente para chamadas ao vivo WebRTC criptografadas ponto a ponto. NENHUMA gravação é armazenada em nossos servidores.',
      sec2Title: '2. Verificação Facial por IA Local',
      sec2Desc: 'A verificação de perfis femininos roda localmente no navegador para coibir fakes e robôs. Nenhum dado biométrico facial é armazenado externamente.',
      sec3Title: '3. Garantia de Não Venda de Dados',
      sec3Desc: 'Não vendemos nem compartilhamos seus dados pessoais com empresas de publicidade ou intermediários de dados sob nenhuma hipótese.',
      sec4Title: '4. Exclusão Definitiva de Informações',
      sec4Desc: 'Em cumprimento às regras da Apple e Google, ao excluir sua conta todos os seus dados, chats e conexões são eliminados permanentemente.'
    },
    kvkk: {
      sec1Title: '1. Controlador de Dados',
      sec1Desc: 'Nos termos da LGPD e do RGPD, a equipe Pyngoo atua como controladora dos dados pessoais processados no aplicativo.',
      sec2Title: '2. Direitos do Titular de Dados',
      sec2Desc: 'Você tem o direito de solicitar a qualquer momento a confirmação, correção ou exclusão completa dos seus dados.',
      sec3Title: '3. Contato de Privacidade',
      sec3Desc: 'Para qualquer assunto relacionado à privacidade, contate nossa equipe: destek@pyngoo.app'
    },
    cookies: {
      title: 'Uso de Cookies e Armazenamento Local',
      desc: 'O Pyngoo utiliza exclusivamente cookies técnicos fundamentais para manter sua sessão conectada e salvar suas preferências de idioma. Não utilizamos rastreadores de anúncios.'
    }
  }
};

export const getLegalContent = (langCode: string): LegalContent => {
  const code = (langCode || 'en').substring(0, 2).toLowerCase();
  return translations[code] || translations['en'];
};
