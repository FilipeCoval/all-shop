// FIX: Import firebase to resolve UMD global errors
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

// Configuração do Firebase da Allshop Store
// Estas chaves são públicas e necessárias para o browser comunicar com o Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyCayoyBpHeO60v7VHUagX_qAHZ7xIyitpE",
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

// Forçar idioma para Português (ajuda nos emails de recuperação e verificação)
auth.languageCode = 'pt';

// Exportar 'firebase' para acesso a FieldValue.increment/arrayUnion sem conflitos de importação
export { auth, db, storage, firebase };
