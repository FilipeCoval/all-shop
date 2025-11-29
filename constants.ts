

import { Product } from './types';

export const STORE_NAME = "Allshop";
export const CURRENCY = "EUR";
// Link direto para o logo
export const LOGO_URL = "https://i.imgur.com/nSiZKBf.png"; 

// Contactos para Checkout
export const SELLER_PHONE = "351999999999"; // WhatsApp (sem +)

// Coloque aqui o link do seu Grupo, Canal ou Utilizador do Telegram
// Exemplo: "https://t.me/+kjsdhfksdf" ou "https://t.me/seunome"
export const TELEGRAM_LINK = "https://t.me/+EEj0ObcKXzJmNjc8"; 

// CREDENCIAIS TELEGRAM BOT (Notificações de Venda)
export const TELEGRAM_BOT_TOKEN = "8486202340:AAEny5gLzHm_obmJmPLeGKyNcjIePR3OBYs";

// ==================================================================================
// ⚠️ ATENÇÃO: TELEGRAM_CHAT_ID (Para onde a mensagem vai)
// ==================================================================================
// ID CONFIRMADO DO UTILIZADOR (ADMIN)
// ==================================================================================
export const TELEGRAM_CHAT_ID = "1003494194252"; 

// LISTA DE ADMINISTRADORES
// Adicione aqui os emails que podem aceder ao Dashboard / Backoffice
export const ADMIN_EMAILS = [
  "filipe_Coval_90@hotmail.com",     // Substitua pelo seu email de login
  "socio@allshop.com",     // Substitua pelo email do sócio
  "filipe@teste.com"       // Exemplo
];

export const PRODUCTS: Product[] = [
  {
    id: 6,
    name: "Xiaomi TV Box S (3ª Geração)",
    price: 50.00,
    description: "A mais recente inovação da Xiaomi. Processador mais rápido, suporte para 8K e a melhor experiência Google TV para transformar a sua sala num cinema.",
    category: "TV & Streaming",
    image: "https://imiland.ir/wp-content/uploads/2025/05/1748368235_68_Xiaomi-TV-Box-S-3rd-Gen-%F0%9F%93%BA-This-is-the-best-cheap-TV-box-of-2025-_-Review-0-1-screenshot.png",
    images: [
        "https://imiland.ir/wp-content/uploads/2025/05/1748368235_68_Xiaomi-TV-Box-S-3rd-Gen-%F0%9F%93%BA-This-is-the-best-cheap-TV-box-of-2025-_-Review-0-1-screenshot.png",
        "https://androidpctv.com/wp-content/uploads/2025/04/Xiaomi-TV-Box-S-3rd-gen-review-p012.jpg"
    ],
    features: ["Suporte 8K", "Google TV", "Processador Ultra Rápido", "WiFi 6"]
  },
  {
    id: 1,
    name: "Xiaomi TV Box S (2ª Geração)",
    price: 45.00,
    description: "Transforme a sua TV numa Smart TV completa. Acesso à Netflix, YouTube e milhares de apps com qualidade 4K e Google TV.",
    category: "TV & Streaming",
    image: "https://img-eu.kwcdn.com/local-goods-img/1264551a/41694471-1dc9-46fa-a4c5-321128414baa/68ed8f290bfd34e1ddf65e3bd07b44ee.jpeg?imageView2/2/w/800/q/70/format/avif",
    images: [
        "https://img-eu.kwcdn.com/local-goods-img/1264551a/41694471-1dc9-46fa-a4c5-321128414baa/68ed8f290bfd34e1ddf65e3bd07b44ee.jpeg?imageView2/2/w/800/q/70/format/avif",
        "https://img-eu.kwcdn.com/local-goods-img/9e2a8bf4/181dba50-df8c-40d7-8f55-113ff7035b0c/d0cdc06c38e740afc67072e21df0ac74.jpeg?imageView2/2/w/800/q/70/format/avif"
    ],
    features: ["4K Ultra HD", "Google TV Integrado", "Dolby Vision & HDR10+", "Comando por Voz"]
  },
  {
    id: 2,
    name: "TV Box H96 Max M2",
    price: 35.00,
    description: "Potência pura para entretenimento. Processador rápido ideal para IPTV, streaming e jogos Android na sua televisão.",
    category: "TV & Streaming",
    image: "https://img.kwcdn.com/product/fancy/d53c3efc-59aa-4ac2-bd40-201b43f0cc98.jpg?imageView2/2/w/800/q/70/format/avif",
    images: [
        "https://img.kwcdn.com/product/fancy/d53c3efc-59aa-4ac2-bd40-201b43f0cc98.jpg?imageView2/2/w/800/q/70/format/avif",
        "https://img.kwcdn.com/product/fancy/ac195306-fbbf-4116-8b1a-ff0d85fbdcfd.jpg?imageView2/2/w/800/q/70/format/avif"
    ],
    features: ["Android 13", "WiFi 6 Rápido", "4GB RAM / 32GB ROM", "Suporte 4K"]
  },
  {
    id: 3,
    name: "Cabo HDMI 2.1 Ultra Speed (2m)",
    price: 6.99,
    description: "A qualidade máxima de imagem. Essencial para PS5, Xbox Series X e TVs 4K/8K para tirar proveito de 120Hz.",
    category: "Cabos",
    image: "https://img.kwcdn.com/product/fancy/0f34dd80-9343-4437-a5e2-b8f09672f205.jpg?imageView2/2/w/800/q/70/format/avif",
    images: [
        "https://img.kwcdn.com/product/fancy/0f34dd80-9343-4437-a5e2-b8f09672f205.jpg?imageView2/2/w/800/q/70/format/avif",
        "https://img.kwcdn.com/product/fancy/eba4ff93-b8ef-4e88-ab42-0d39cd20dfbe.jpg?imageView2/2/w/800/q/70/format/avif"
    ],
    features: ["48Gbps Largura de Banda", "8K @ 60Hz / 4K @ 120Hz", "eARC e VRR", "Conectores Gold"]
  },
  {
    id: 4,
    name: "Cabo de Rede Ethernet Cat8 (10m)",
    price: 12.50,
    description: "Internet sem falhas. O cabo mais rápido do mercado, blindado contra interferências. Perfeito para gaming e streaming pesado.",
    category: "Cabos",
    image: "https://img.kwcdn.com/product/fancy/e6cfaa4a-9144-462c-ab3c-ebcd3d4f014b.jpg?imageView2/2/w/800/q/70/format/avif",
    images: [
        "https://img.kwcdn.com/product/fancy/e6cfaa4a-9144-462c-ab3c-ebcd3d4f014b.jpg?imageView2/2/w/800/q/70/format/avif",
        "https://img.kwcdn.com/product/fancy/e2ee21d8-ceb2-4d98-9292-68834046f810.jpg?imageView2/2/w/800/q/70/format/avif"
    ],
    features: ["Velocidade até 40Gbps", "2000MHz Frequência", "Blindagem S/FTP", "10 Metros"]
  },
  {
    id: 5,
    name: "Hub Acer USB-A para Ethernet LAN",
    price: 7.00,
    description: "Conectividade fiável. Adicione uma porta de rede Gigabit ao seu portátil ou PC via USB com a qualidade Acer.",
    category: "Adaptadores",
    image: "https://img.kwcdn.com/product/fancy/769740de-1fd9-4a79-a1d9-de36003c9316.jpg?imageView2/2/w/800/q/70/format/avif",
    images: [
        "https://img.kwcdn.com/product/fancy/769740de-1fd9-4a79-a1d9-de36003c9316.jpg?imageView2/2/w/800/q/70/format/avif",
        "https://img.kwcdn.com/product/fancy/ee3ca530-c421-47db-80b2-a2b74dbd7709.jpg?imageView2/2/w/800/q/70/format/avif"
    ],
    features: ["Gigabit Ethernet (1000Mbps)", "USB 3.0 Rápido", "Plug & Play", "Design Compacto"]
  }
];
