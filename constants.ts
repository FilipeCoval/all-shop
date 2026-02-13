
import { Product } from './types';

export const STORE_NAME = "All-Shop";
export const CURRENCY = "EUR";
export const LOGO_URL = "https://i.imgur.com/nSiZKBf.png"; 

// URL OFICIAL DA LOJA
export const PUBLIC_URL = "https://www.all-shop.net";
// NOVO DOMÍNIO DEDICADO À PARTILHA
export const SHARE_URL = "https://share.all-shop.net";

export const SELLER_PHONE = "351933865907"; 
export const TELEGRAM_LINK = "https://t.me/+EEj0ObcKXzJmNjc8"; 
export const TELEGRAM_BOT_TOKEN = "8486202340:AAEny5gLzHm_obmJmPLeGKyNcjIePR3OBYs";
export const TELEGRAM_CHAT_ID = "-1003494194252"; 

// --- DADOS DA ASSISTENTE IA ---
export const BOT_NAME = "Rofi";
export const BOT_AVATAR_URL = "https://firebasestorage.googleapis.com/v0/b/allshop-store-70851.firebasestorage.app/o/profile_pictures%2FMascote%20rob%C3%B4%20futurista%20da%20All%20Shop.png?alt=media&token=43e3cbc4-215a-409f-8a48-db4e48e00a72";

/**
 * IMPORTANTE: Lista de emails com permissão de administrador.
 */
export const ADMIN_EMAILS = [
  "filipe_coval_90@hotmail.com",
  "mcpoleca@gmail.com",
  "filipe@teste.com"
];

export const LOYALTY_TIERS = {
    BRONZE: { threshold: 0, multiplier: 1, label: 'Bronze' },
    SILVER: { threshold: 250, multiplier: 3, label: 'Prata' },
    GOLD: { threshold: 600, multiplier: 5, label: 'Ouro' }
};

export const LOYALTY_REWARDS = [
    { id: 'vouch_2', title: 'Vale de 2€', value: 2, cost: 200, minPurchase: 10 },
    { id: 'vouch_5', title: 'Vale de 5€', value: 5, cost: 500, minPurchase: 20 },
    { id: 'vouch_10', title: 'Vale de 10€', value: 10, cost: 1000, minPurchase: 50 },
    { id: 'vouch_25', title: 'Vale de 25€', value: 25, cost: 2500, minPurchase: 100 },
];

// LISTA LIMPA: Os produtos antigos foram removidos para evitar confusão.
// A loja carrega tudo da Firebase.
export const INITIAL_PRODUCTS: Product[] = [];

