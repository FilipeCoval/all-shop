import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
const app = initializeApp(firebaseConfig);

// Inicializar Serviços
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };