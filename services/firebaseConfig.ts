
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
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // VAPID Key pública é necessária para gerar o token
      // Se não tiver uma gerada, o firebase usa a default se configurada no console
      const token = await messaging.getToken({ 
        vapidKey: "BHAN25TjCBO3kai3pN3fd71nQbMYC_FU7dnHxe1cNpkeGqEey9nO7bewnRUu9t37q3iGxaAY9xlXSbzfwRTe3CI" 
      }); 
      return token;
    }
    return null;
  } catch (error) {
    console.error("Erro ao pedir permissão de notificação:", error);
    return null;
  }
};

// Exportar 'firebase' para acesso a FieldValue.increment/arrayUnion sem conflitos de importação
export { auth, db, storage, messaging, firebase };

