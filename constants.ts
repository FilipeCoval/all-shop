import { Product } from './types';

export const STORE_NAME = "Allshop";
export const CURRENCY = "EUR";
export const LOGO_URL = "https://i.imgur.com/nSiZKBf.png"; 

export const SELLER_PHONE = "351933865907"; 
export const TELEGRAM_LINK = "https://t.me/+EEj0ObcKXzJmNjc8"; 
export const TELEGRAM_BOT_TOKEN = "8486202340:AAEny5gLzHm_obmJmPLeGKyNcjIePR3OBYs";
export const TELEGRAM_CHAT_ID = "-1003494194252"; 

export const ADMIN_EMAILS = [
  "filipe_Coval_90@hotmail.com",
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

export const PRODUCTS: Product[] = [
  {
    id: 6,
    name: "Xiaomi TV Box S (3ª Geração) - 4K Ultra HD",
    price: 55.00,
    description: "A elite do streaming. Salto de 130% em performance gráfica e 32GB de armazenamento. Ideal para quem quer a box mais fluída do mercado com Wi-Fi 6.",
    category: "TV & Streaming",
    image: "https://imiland.ir/wp-content/uploads/2025/05/1748368235_68_Xiaomi-TV-Box-S-3rd-Gen-%F0%9F%93%BA-This-is-the-best-cheap-TV-box-of-2025-_-Review-0-1-screenshot.png",
    images: [
        "https://androidpctv.com/wp-content/uploads/2025/04/Xiaomi-TV-Box-S-3rd-gen-review-p012.jpg"
    ],
    features: ["Suporte 8K / 4K", "Google TV", "Processador A55 Ultra", "32GB ROM / WiFi 6"]
  },
  {
    id: 1,
    name: "Xiaomi TV Box S (2ª Geração) - 4K Ultra HD",
    price: 45.00,
    description: "A clássica e fiável. Certificada para todos os serviços oficiais com Dolby Vision e HDR10+. Excelente custo-benefício para streaming oficial.",
    category: "TV & Streaming",
    image: "https://img-eu.kwcdn.com/local-goods-img/1264551a/41694471-1dc9-46fa-a4c5-321128414baa/68ed8f290bfd34e1ddf65e3bd07b44ee.jpeg?imageView2/2/w/800/q/70/format/avif",
    images: [
        "https://img-eu.kwcdn.com/local-goods-img/9e2a8bf4/181dba50-df8c-40d7-8f55-113ff7035b0c/d0cdc06c38e740afc67072e21df0ac74.jpeg?imageView2/2/w/800/q/70/format/avif"
    ],
    features: ["4K Ultra HD", "Google TV Integrado", "Dolby Vision & HDR10+", "Comando por Voz"]
  },
  {
    id: 2,
    name: "TV Box H96 Max M2 - Android 13",
    price: 35.00,
    description: "Liberdade total. Android 13 'puro' com 64GB de espaço. Perfeita para IPTV e aplicações externas (APKs) devido ao seu sistema aberto.",
    category: "TV & Streaming",
    image: "https://img.kwcdn.com/product/fancy/d53c3efc-59aa-4ac2-bd40-201b43f0cc98.jpg?imageView2/2/w/800/q/70/format/avif",
    images: [
        "https://img.kwcdn.com/product/fancy/ac195306-fbbf-4116-8b1a-ff0d85fbdcfd.jpg?imageView2/2/w/800/q/70/format/avif"
    ],
    features: ["Android 13.0", "4GB RAM + 64GB ROM", "WiFi 6 Rápido", "Instalação Livre APK"]
  },
  {
    id: 3,
    name: "Cabo HDMI 2.1 Ultra Speed (2m)",
    price: 6.99,
    description: "A qualidade máxima de imagem. Essencial para PS5, Xbox Series X e TVs 4K/8K para tirar proveito de 120Hz.",
    category: "Cabos",
    image: "https://img.kwcdn.com/product/fancy/0f34dd80-9343-4437-a5e2-b8f09672f205.jpg?imageView2/2/w/800/q/70/format/avif",
    images: [
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
        "https://img.kwcdn.com/product/fancy/ee3ca530-c421-47db-80b2-a2b74dbd7709.jpg?imageView2/2/w/800/q/70/format/avif"
    ],
    features: ["Gigabit Ethernet (1000Mbps)", "USB 3.0 Rápido", "Plug & Play", "Design Compacto"]
  },
  {
    id: 7,
    name: "Carregador Turbo (Kit c/ Cabo)",
    price: 5.99,
    description: "Carregamento ultra-rápido compatível com Xiaomi. Disponível em várias potências para se adaptar ao seu modelo. Inclui cabo USB-C Turbo de 6A.",
    category: "Acessórios",
    image: "https://s.alicdn.com/@sc04/kf/Hac03a0dd00374cf9a345b52b8c6a446dq.jpg?avif=close&webp=close",
    images: [
        "https://s.alicdn.com/@sc04/kf/H449959a037d9422aa3d28f242af3d0bel.jpg"
    ],
    features: ["Tecnologia GaN", "Proteção Contra Sobrecarga", "Inclui Cabo 6A", "Compatível Xiaomi"],
    variantLabel: "Escolha a Potência",
    variants: [
        { 
            name: "33W Turbo", 
            price: 5.99, 
            image: "https://s.alicdn.com/@sc04/kf/H6194355092934d33aa1e0c39f9199e66m.jpg?avif=close&webp=close"
        },
        { 
            name: "67W Max", 
            price: 9.99,
            image: "https://s.alicdn.com/@sc04/kf/H449959a037d9422aa3d28f242af3d0bel.jpg"
        },
        { 
            name: "120W Turbo", 
            price: 14.99,
            image: "https://s.alicdn.com/@sc04/kf/Hac03a0dd00374cf9a345b52b8c6a446dq.jpg?avif=close&webp=close"
        }
    ]
  },
  {
    id: 8,
    name: "Carregador Xiaomi Turbo Original (Kit)",
    price: 14.99,
    description: "Carregador original Xiaomi disponível em 33W e 67W. Ideal para carregamento rápido (Turbo Charge) de modelos Redmi Note, POCO e Mi. Inclui cabo USB-C de 6A robusto.",
    category: "Acessórios",
    image: "https://ae01.alicdn.com/kf/S39f8f02511234451b329c5c8860fb790m.jpg",
    images: [
        "https://ae-pic-a1.aliexpress-media.com/kf/S555171f359404ae89c4d848cc2fe87d9k.jpg_960x960q75.jpg_.avif"
    ],
    features: ["Carregamento Turbo", "Cabo USB-C 6A Incluído", "Compatível com POCO/Redmi", "Proteção Inteligente"],
    variantLabel: "Escolha a Potência",
    variants: [
        {
            name: "33W Turbo",
            price: 14.99,
            image: "https://ae01.alicdn.com/kf/S39f8f02511234451b329c5c8860fb790m.jpg"
        },
        {
            name: "67W Max",
            price: 18.99,
            image: "https://ae-pic-a1.aliexpress-media.com/kf/S743b4ba68517490bae3380429127f3e8b.jpg_960x960q75.jpg_.avif"
        }
    ]
  },
  {
    id: 9,
    name: "Cabo Xiaomi Turbo USB-C para USB-C (120W)",
    price: 3.99,
    description: "Cabo de dados e carregamento rápido com dupla ponta USB-C. Suporta protocolo HyperCharge 120W da Xiaomi e transferência de dados rápida. Ideal para carregar smartphones, tablets e portáteis modernos.",
    category: "Cabos",
    image: "https://ae-pic-a1.aliexpress-media.com/kf/Scd9ec99f95dc4efb8b3f82634c835943C.jpg_960x960q75.jpg_.avif",
    images: [
        "https://ae-pic-a1.aliexpress-media.com/kf/Sad41e1921649498fb062d77d60d4824dg.jpg_220x220q75.jpg_.avif"
    ],
    features: ["Suporta 120W HyperCharge", "USB-C para USB-C", "Alta Resistência", "Transferência de Dados"]
  }
];
