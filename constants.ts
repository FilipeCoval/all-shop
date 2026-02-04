
import { Product } from './types';

export const STORE_NAME = "Allshop";
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

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 6,
    name: "Xiaomi TV Box S (3ª Geração) - 4K Ultra HD",
    price: 51.49,
    description: "A elite do streaming. Salto de 130% em performance gráfica e 32GB de armazenamento.",
    category: "TV & Streaming",
    stock: 50,
    image: "https://androidpctv.com/wp-content/uploads/2025/04/Xiaomi-TV-Box-S-3rd-gen-review-p012.jpg",
    features: ["Suporte 8K / 4K", "Google TV", "Processador A55 Ultra", "32GB ROM / WiFi 6"]
  }
];
