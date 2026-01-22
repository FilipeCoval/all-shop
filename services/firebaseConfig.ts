// FIX: Import firebase to resolve UMD global errors
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

// Configuração do Firebase da Allshop Store
// Estas chaves são públicas e necessárias para o browser comunicar com o Firebase.
const firebaseConfig = {
  // Tenta ler do ambiente, senão usa uma string vazia (o que causará erro claro na consola em vez de erro de permissão silencioso)
  apiKey: process.env.API_KEY || "AIzaSyCayoyBpHeO60v7VHUagX_qAHZ7xIyitpE", // Mantive esta apenas porque o utilizador pode não ter .env configurado localmente ainda
  authDomain: "allshop-store-70851.firebaseapp.com",
  projectId: "allshop-store-70851",
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

// CORREÇÃO DE ERRO DE LIGAÇÃO:
// Força o uso de Long Polling em vez de WebSockets. 
// Isto resolve o erro "Backend didn't respond within 10 seconds" em muitas redes.
db.settings({ experimentalForceLongPolling: true });

// Forçar idioma para Português (ajuda nos emails de recuperação e verificação)
auth.languageCode = 'pt';

// Exportar 'firebase' para acesso a FieldValue.increment/arrayUnion sem conflitos de importação
export { auth, db, storage, firebase };
