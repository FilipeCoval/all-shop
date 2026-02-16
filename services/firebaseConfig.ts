
// FIX: Import firebase to resolve UMD global errors
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/messaging';

// Configuração do Firebase da Allshop Store
// Estas chaves são públicas e necessárias para o browser comunicar com o Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyCayoyBpHeO60v7VHUagX_qAHZ7xIyitpE",
  authDomain: "allshop-store-70851.firebaseapp.com",
  projectId: "allshop-store-70851",
  // CORREÇÃO: O nome do bucket estava errado. O correto usa 'firebasestorage.app'
  storageBucket: "allshop-store-70851.firebasestorage.app",
  messagingSenderId: "1066114053908",
  appId: "1:1066114053908:web:34f8ae5e231a5c73f0f401"
};

// Inicializar Firebase
// Verifica se já existe uma app inicializada para evitar erros
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();

// Inicializar Serviços
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Inicializar Messaging (Push Notifications) de forma segura
// O Messaging não é suportado em todos os browsers (ex: Safari antigo)
let messaging: firebase.messaging.Messaging | null = null;
try {
  if (firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
  }
} catch (e) {
  console.warn("Firebase Messaging not supported in this environment.", e);
}

// CORREÇÃO DE ERRO DE LIGAÇÃO:
// Força o uso de Long Polling em vez de WebSockets. 
// Isto resolve o erro "Backend didn't respond within 10 seconds" em muitas redes.
db.settings({ experimentalForceLongPolling: true });

// Forçar idioma para Português (ajuda nos emails de recuperação e verificação)
auth.languageCode = 'pt';

// Helper para pedir permissão
export const requestPushPermission = async (): Promise<string | null> => {
  if (!messaging) {
    console.warn("Messaging não suportado neste browser.");
    return null;
  }
  
  try {
    // 1. Pedir permissão ao browser
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log("Permissão de notificação concedida.");
      
      // 2. Registar o Service Worker explicitamente para garantir que é encontrado
      let registration;
      try {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log("Service Worker registado com sucesso:", registration);
      } catch (swError) {
        console.error("Falha ao registar Service Worker:", swError);
        // Tenta continuar mesmo sem registo explícito (fallback do firebase)
      }

      // 3. Obter o Token
      // VAPID Key pública é necessária para gerar o token
      const token = await messaging.getToken({ 
        vapidKey: "YX94bDjvlMF63hKGvY0HOTNiYXO_PBdzFIurMldtpxk",
        serviceWorkerRegistration: registration
      }); 
      
      console.log("Token FCM gerado:", token);
      return token;
    } else {
      console.warn("Permissão de notificação negada ou fechada.");
      return null;
    }
  } catch (error) {
    console.error("ERRO CRÍTICO ao pedir notificação:", error);
    return null;
  }
};

// Exportar 'firebase' para acesso a FieldValue.increment/arrayUnion sem conflitos de importação
export { auth, db, storage, messaging, firebase };
