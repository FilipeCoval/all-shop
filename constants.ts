
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

// Helper para evitar bloqueios de imagem em redes sociais
const proxyImg = (url: string) => `https://images.weserv.nl/?url=${encodeURIComponent(url.replace('https://', ''))}&default=${encodeURIComponent(LOGO_URL)}`;

export const PRODUCTS: Product[] = [
  {
    id: 17,
    name: "Xiaomi Redmi Buds 6 Play TWS Bluetooth 5.4",
    price: 24.99,
    description: "Auriculares de última geração com Bluetooth 5.4 para uma conexão ultra-estável. Incluem redução de ruído por IA para chamadas cristalinas e uma bateria de longa duração com carregamento rápido. Design leve e ergonómico.",
    category: "Audio",
    comingSoon: true,
    image: proxyImg("ae-pic-a1.aliexpress-media.com/kf/S697d3f549e66498fbd43dddce27314a1C.jpg"),
    images: [
      proxyImg("ae-pic-a1.aliexpress-media.com/kf/S5f439034a59e41aeae77f667f32d5314Q.jpg"),
      proxyImg("ae-pic-a1.aliexpress-media.com/kf/S76c39334876945bea9e717758760ae9dZ.jpg")
    ],
    variantLabel: "Escolha a Cor",
    variants: [
      {
        name: "Preto",
        price: 24.99,
        image: proxyImg("ae-pic-a1.aliexpress-media.com/kf/Sc3fd2cc394224207816e8a000322702e2.jpg")
      },
      {
        name: "Branco",
        price: 24.99,
        image: proxyImg("ae-pic-a1.aliexpress-media.com/kf/S3fa13df2c427401993d90cd746e54602T.jpg")
      }
    ],
    features: ["Bluetooth 5.4 Ultra-Rápido", "Redução de Ruído com IA", "Até 36h de Autonomia Total", "Driver Dinâmico de 10mm", "Proteção IPX4"]
  },
  {
    id: 16,
    name: "Lenovo LivePods LP40 TWS Wireless Earbuds",
    price: 11.99,
    description: "Auriculares originais Lenovo com design ultra-leve, Bluetooth 5.0 e controlo tátil. Som estéreo de alta fidelidade e resistência ao suor, ideais para desporto e uso diário.",
    category: "Audio",
    comingSoon: true,
    image: proxyImg("ae-pic-a1.aliexpress-media.com/kf/H373ed0e5b37540fab33a0e6277954888T.jpg"),
    images: [
      proxyImg("ae-pic-a1.aliexpress-media.com/kf/Hbb0fed2da7994d65a054f68b411ed309Q.jpg")
    ],
    variantLabel: "Escolha a Cor",
    variants: [
      {
        name: "Branco",
        price: 11.99,
        image: proxyImg("ae-pic-a1.aliexpress-media.com/kf/H3dccd4fcdf4543c6b7e1144dd11820bdI.jpg")
      },
      {
        name: "Preto",
        price: 11.99,
        image: proxyImg("ae-pic-a1.aliexpress-media.com/kf/Sb3b7433868b74dba98b4aa074d3290670.jpg")
      }
    ],
    features: ["Bluetooth 5.0", "Controlo Tátil Inteligente", "Resistência à Água IPX4", "Carregamento USB-C", "Design Ergonómico e Leve"]
  },
  {
    id: 6,
    name: "Xiaomi TV Box S (3ª Geração) - 4K Ultra HD",
    price: 55.00,
    description: "A elite do streaming. Salto de 130% em performance gráfica e 32GB de armazenamento. Ideal para quem quer a box mais fluída do mercado com Wi-Fi 6.",
    category: "TV & Streaming",
    image: "https://i.imgur.com/nSiZKBf.png", 
    images: [
        proxyImg("androidpctv.com/wp-content/uploads/2025/04/Xiaomi-TV-Box-S-3rd-gen-review-p012.jpg")
    ],
    features: ["Suporte 8K / 4K", "Google TV", "Processador A55 Ultra", "32GB ROM / WiFi 6"]
  },
  {
    id: 1,
    name: "Xiaomi TV Box S (2ª Geração) - 4K Ultra HD",
    price: 45.00,
    description: "A clássica e fiável. Certificada para todos os serviços oficiais com Dolby Vision e HDR10+. Excelente custo-benefício para streaming oficial.",
    category: "TV & Streaming",
    image: proxyImg("ae01.alicdn.com/kf/S8f96717a696249e0a8117769532d1646Q.jpg"),
    images: [
        proxyImg("ae01.alicdn.com/kf/S8f96717a696249e0a8117769532d1646Q.jpg")
    ],
    features: ["4K Ultra HD", "Google TV Integrado", "Dolby Vision & HDR10+", "Comando por Voz"]
  },
  {
    id: 2,
    name: "TV Box H96 Max M2 - Android 13",
    price: 35.00,
    description: "Liberdade total. Android 13 'puro' com 64GB de espaço. Perfeita para IPTV e aplicações externas (APKs) devido ao seu sistema aberto.",
    category: "TV & Streaming",
    image: proxyImg("ae01.alicdn.com/kf/S26665767b43a49709a34105268686689o.jpg"),
    images: [
        proxyImg("ae01.alicdn.com/kf/S26665767b43a49709a34105268686689o.jpg")
    ],
    features: ["Android 13.0", "4GB RAM + 64GB ROM", "WiFi 6 Rápido", "Instalação Livre APK"]
  },
  {
    id: 8,
    name: "Carregador Xiaomi Turbo Original (Kit)",
    price: 14.99,
    description: "Carregador original Xiaomi disponível em 33W e 67W. Ideal para carregamento rápido (Turbo Charge) de modelos Redmi Note, POCO e Mi. Inclui cabo USB-C de 6A robusto.",
    category: "Acessórios",
    image: proxyImg("ae01.alicdn.com/kf/S39f8f02511234451b329c5c8860fb790m.jpg"),
    features: ["Carregamento Turbo", "Cabo USB-C 6A Incluído", "Compatível com POCO/Redmi"],
    variantLabel: "Escolha a Potência",
    variants: [
        {
            name: "33W Turbo",
            price: 14.99,
            image: proxyImg("ae01.alicdn.com/kf/S39f8f02511234451b329c5c8860fb790m.jpg")
        },
        {
            name: "67W Max",
            price: 18.99,
            image: proxyImg("ae01.alicdn.com/kf/S743b4ba68517490bae3380429127f3e8b.jpg")
        }
    ]
  },
  {
    id: 13,
    name: "Tapete Gaming Mouse Pad XL - Sports Car Edition",
    price: 13.99,
    description: "Grande tapete de mesa com design Sports Car. Superfície estendida de alta precisão de 900x400mm com base antiderrapante.",
    category: "Acessórios",
    comingSoon: true,
    image: proxyImg("ae-pic-a1.aliexpress-media.com/kf/Sda4625e2048542d4b9be0a13a15342eeH.png"),
    variantLabel: "Escolha o Design",
    variants: [
      {
        name: "Design Branco Clássico (V1)",
        price: 13.99,
        image: proxyImg("ae-pic-a1.aliexpress-media.com/kf/Sda4625e2048542d4b9be0a13a15342eeH.png")
      },
      {
        name: "Design Futurista (V2)",
        price: 13.99,
        image: proxyImg("ae-pic-a1.aliexpress-media.com/kf/S56b9fec6534d4a6b8d6bb97561c7c49ez.png")
      }
    ],
    features: ["Tamanho XL: 900x400x2mm", "Base de Borracha Antiderrapante", "Design Sports Car Exclusivo", "Bordas Reforçadas"]
  },
  {
    id: 15,
    name: "Logitech G502 HERO Master Wired Gaming Mouse",
    price: 41.99,
    description: "O rato gaming mais vendido do mundo. Equipado com o sensor óptico HERO 25K para máxima precisão, 11 botões programáveis e pesos ajustáveis para uma experiência personalizada.",
    category: "Acessórios",
    comingSoon: true,
    image: proxyImg("ae-pic-a1.aliexpress-media.com/kf/S03f27e919ec04bc08d82d6152d4ccc969.jpg"),
    features: ["Sensor HERO 25K (25.600 DPI)", "11 Botões Programáveis", "Pesos Ajustáveis (5x 3.6g)"]
  },
  {
    id: 3,
    name: "Cabo HDMI 2.1 Ultra Speed (2m)",
    price: 6.99,
    description: "A qualidade máxima de imagem. Essencial para PS5, Xbox Series X e TVs 4K/8K para tirar proveito de 120Hz.",
    category: "Cabos",
    image: proxyImg("ae01.alicdn.com/kf/S663675765b43a49709a34105268686689o.jpg"),
    features: ["48Gbps Largura de Banda", "8K @ 60Hz / 4K @ 120Hz"]
  },
  {
    id: 4,
    name: "Cabo de Rede Ethernet Cat8 (10m)",
    price: 12.50,
    description: "Internet sem falhas. O cabo mais rápido do mercado, blindado contra interferências. Perfeito para gaming e streaming pesado.",
    category: "Cabos",
    image: proxyImg("ae01.alicdn.com/kf/Sa2665767b43a49709a34105268686689o.jpg"),
    features: ["Velocidade até 40Gbps", "2000MHz Frequência"]
  },
  {
    id: 9,
    name: "Cabo Xiaomi Turbo USB-C para USB-C (120W)",
    price: 3.99,
    description: "Cabo original para HyperCharge 120W da Xiaomi. Ideal para tirar o máximo proveito dos carregadores turbo originais.",
    category: "Cabos",
    image: proxyImg("ae-pic-a1.aliexpress-media.com/kf/Scd9ec99f95dc4efb8b3f82634c835943C.jpg"),
    features: ["Suporta 120W HyperCharge", "Chip Original Xiaomi"]
  },
  {
    id: 7,
    name: "Carregador Turbo (Sem Cabo)",
    price: 5.99,
    description: "Carregamento ultra-rápido compatível com Xiaomi e outras marcas. Disponível em várias potências.",
    category: "Acessórios",
    image: proxyImg("s.alicdn.com/@sc04/kf/Hac03a0dd00374cf9a345b52b8c6a446dq.jpg"),
    variantLabel: "Escolha a Potência",
    variants: [
        { name: "33W Turbo", price: 5.99, image: proxyImg("s.alicdn.com/@sc04/kf/H6194355092934d33aa1e0c39f9199e66m.jpg") },
        { name: "67W Max", price: 9.99, image: proxyImg("s.alicdn.com/@sc04/kf/H449959a037d9422aa3d28f242af3d0bel.jpg") },
        { name: "120W Turbo", price: 14.99, image: proxyImg("s.alicdn.com/@sc04/kf/Hac03a0dd00374cf9a345b52b8c6a446dq.jpg") }
    ],
    features: ["Tecnologia GaN", "Proteção Contra Sobrecarga"]
  },
  {
    id: 5,
    name: "Hub Acer USB-A para Ethernet LAN",
    price: 7.00,
    description: "Conectividade fiável. Adicione uma porta de rede Gigabit ao seu portátil ou PC via USB com a qualidade Acer.",
    category: "Adaptadores",
    image: proxyImg("ae01.alicdn.com/kf/S769740de1fd94a79a1d9de36003c9316o.jpg"),
    features: ["Gigabit Ethernet (1000Mbps)", "USB 3.0 Rápido"]
  }
];
