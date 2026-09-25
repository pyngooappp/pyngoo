/* Pyngoo — web bildirimleri için servis çalışanı.
   Site kapalıyken gelen "takip ettiğin kişi çevrimiçi / canlı" bildirimlerini gösterir.
   Aşağıdaki değerler gizli değildir (Firebase web yapılandırması). */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCb46rAvE73HPx9MNBj9u0utZXLGBJevvQ',
  authDomain: 'pyngoo-ce491.firebaseapp.com',
  projectId: 'pyngoo-ce491',
  storageBucket: 'pyngoo-ce491.firebasestorage.app',
  messagingSenderId: '673577776513',
  appId: '1:673577776513:web:18e6fcb6d53b551bbb2480',
});

// Bildirim başlığı/metni sunucudan "notification" alanıyla geldiği için Firebase otomatik gösterir;
// tıklanınca sunucunun verdiği bağlantı (fcm_options.link) açılır.
firebase.messaging();
