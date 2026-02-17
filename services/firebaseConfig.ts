
// FIX: Import firebase to resolve UMD global errors
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/messaging';

// 1. CONFIGURAÇÃO GERAL (Base de Dados e Auth)
const firebaseConfig = {
  apiKey: "AIzaSyCayoyBpHeO60v7VHUagX_qAHZ7xIyitpE",
  authDomain: "allshop-store-70851.firebaseapp.com",
  projectId: "allshop-store-70851",
  storageBucket: "allshop-store-70851.firebasestorage.app",
  messagingSenderId: "1066114053908",
  appId: "1:1066114053908:web:34f8ae5e231a5c73f0f401"
};

// Inicializar Firebase
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();

// Inicializar Serviços
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let messaging: firebase.messaging.Messaging | null = null;
try {
  if (firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
  }
} catch (e) {
  console.warn("Firebase Messaging not supported in this environment.", e);
}

// Configurações de Conexão
db.settings({ experimentalForceLongPolling: true });
auth.languageCode = 'pt';

// 2. CONFIGURAÇÃO DE NOTIFICAÇÕES (VAPID Key)
// Chave atualizada fornecida pelo utilizador (Key pair)
const VAPID_KEY = "BJXPk7dP-BS47L-yIHR6mg1R-XIUNqtJwfO6TM78mXPJdzlSDR0QqHIqhWeTOYfEb1pS1FM3dx8st4bLG9LIyf0";

export const requestPushPermission = async (): Promise<string | null> => {
  if (!messaging) return null;
  
  try {
    // Verificação de segurança para evitar crash
    if (!VAPID_KEY || !VAPID_KEY.startsWith('B')) {
        console.error("ERRO CRÍTICO: VAPID Key inválida. Deve começar por 'B'.");
        return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      
      try {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      } catch (swError) {
        console.log("SW Register info:", swError);
      }

      // Obter Token usando a VAPID Key correta
      const token = await messaging.getToken({ vapidKey: VAPID_KEY });
      console.log("Token FCM gerado com sucesso:", token);
      return token;
    }
  } catch (error: any) {
    console.error("Erro ao ativar notificações:", error);
    
    // Tratamento específico para o erro de chave inválida
    if (error.message && error.message.includes('applicationServerKey')) {
        alert("Erro de Configuração: A chave de notificações no site não corresponde à do Firebase Console. Por favor, limpe a cache do navegador e tente novamente.");
    }
    
    return null;
  }
  return null;
};

export { auth, db, storage, messaging, firebase };
