
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PUBLIC_URL, STORE_NAME } from '../constants';

// --- A FONTE DE VERDADE PARA OS CARDS DE PARTILHA ---
// IMPORTANTE: Se adicionar/alterar um produto na loja, atualize-o aqui também.
const PRODUCTS = [
  {
    id: 17, name: "Xiaomi Redmi Buds 6 Play TWS Bluetooth 5.4", price: 24.99, description: "Auriculares de última geração com Bluetooth 5.4 para uma conexão ultra-estável. Incluem redução de ruído por IA para chamadas cristalinas e uma bateria de longa duração com carregamento rápido. Design leve e ergonómico.", category: "Audio", comingSoon: true, stock: 0, image: "https://ae-pic-a1.aliexpress-media.com/kf/S697d3f549e66498fbd43dddce27314a1C.jpg_960x960q75.jpg_.avif", images: ["https://ae-pic-a1.aliexpress-media.com/kf/S5f439034a59e41aeae77f667f32d5314Q.jpg_960x960q75.jpg_.avif"], features: ["Bluetooth 5.4", "Redução de Ruído com IA", "Até 36h de Autonomia"]
  },
  {
    id: 16, name: "Lenovo LivePods LP40 TWS Wireless Earbuds", price: 11.99, description: "Auriculares originais Lenovo com design ultra-leve, Bluetooth 5.0 e controlo tátil. Som estéreo de alta fidelidade e resistência ao suor, ideais para desporto e uso diário.", category: "Audio", comingSoon: true, stock: 0, image: "https://img.kwcdn.com/product/fancy/25abdacb-27d9-4a63-8103-13d3d01a5ce8.jpg?imageView2/2/w/800/q/70", images: ["https://img.kwcdn.com/product/fancy/697e1a4e-72a9-40a0-afd9-38aba3645c78.jpg?imageView2/2/w/800/q/70"], features: ["Bluetooth 5.0", "Controlo Tátil", "Resistência IPX4"]
  },
  {
    id: 15, name: "Logitech G502 HERO Master Wired Gaming Mouse", price: 41.99, description: "O rato gaming mais vendido do mundo. Equipado com o sensor óptico HERO 25K para máxima precisão, 11 botões programáveis e pesos ajustáveis.", category: "Acessórios", comingSoon: true, stock: 0, image: "https://ae-pic-a1.aliexpress-media.com/kf/S03f27e919ec04bc08d82d6152d4ccc969.jpg_960x960q75.jpg_.avif", images: ["https://ae-pic-a1.aliexpress-media.com/kf/Sdbf942f2734b45e38592e870c27452f3I.jpg_960x960q75.jpg_.avif"], features: ["Sensor HERO 25K", "11 Botões Programáveis", "Pesos Ajustáveis"]
  },
  {
    id: 13, name: "Tapete Gaming Mouse Pad XL - Sports Car Edition", price: 13.99, description: "Grande tapete de mesa com design Sports Car. Superfície estendida de alta precisão de 900x400mm com base antiderrapante.", category: "Acessórios", comingSoon: true, stock: 0, image: "https://ae-pic-a1.aliexpress-media.com/kf/Sda4625e2048542d4b9be0a13a15342eeH.png_960x960.png_.avif", images: [], features: ["900x400x2mm", "Base Antiderrapante", "Bordas Reforçadas"]
  },
  {
    id: 6, name: "Xiaomi TV Box S (3ª Geração) - 4K Ultra HD", price: 51.49, description: "A elite do streaming. Salto de 130% em performance gráfica e 32GB de armazenamento. Ideal para quem quer a box mais fluída do mercado com Wi-Fi 6.", category: "TV & Streaming", stock: 50, image: "https://androidpctv.com/wp-content/uploads/2025/04/Xiaomi-TV-Box-S-3rd-gen-review-p012.jpg", images: ["https://techxreviews.com/wp-content/uploads/2025/05/Xiaomi-TV-Box-S-3rd-Gen-%F0%9F%93%BA-This-is-the-best-cheap-TV-box-of-2025-_-Review-0-1-screenshot.png"], features: ["Suporte 8K / 4K", "Google TV", "Processador A55 Ultra", "32GB ROM / WiFi 6"]
  },
  {
    id: 1, name: "Xiaomi TV Box S (2ª Geração) - 4K Ultra HD", price: 42.50, description: "A clássica e fiável. Certificada para todos os serviços oficiais com Dolby Vision e HDR10+. Excelente custo-benefício para streaming oficial.", category: "TV & Streaming", stock: 50, image: "https://img-eu.kwcdn.com/local-goods-img/1264551a/41694471-1dc9-46fa-a4c5-321128414baa/68ed8f290bfd34e1ddf65e3bd07b44ee.jpeg?imageView2/2/w/800/q/70", images: ["https://img-eu.kwcdn.com/local-goods-img/9e2a8bf4/181dba50-df8c-40d7-8f55-113ff7035b0c/d0cdc06c38e740afc67072e21df0ac74.jpeg?imageView2/2/w/800/q/70"], features: ["4K Ultra HD", "Google TV Integrado", "Dolby Vision & HDR10+", "Comando por Voz"]
  },
  {
    id: 2, name: "TV Box H96 Max M2 - Android 13", price: 29.95, description: "Liberdade total. Android 13 'puro' com 64GB de espaço. Perfeita para IPTV e aplicações externas (APKs) devido ao seu sistema aberto.", category: "TV & Streaming", stock: 50, image: "https://img.kwcdn.com/product/fancy/d53c3efc-59aa-4ac2-bd40-201b43f0cc98.jpg?imageView2/2/w/800/q/70", images: ["https://img.kwcdn.com/product/fancy/ac195306-fbbf-4116-8b1a-ff0d85fbdcfd.jpg?imageView2/2/w/800/q/70"], features: ["Android 13.0", "4GB RAM + 64GB ROM", "WiFi 6 Rápido", "Instalação Livre APK"]
  },
  {
    id: 8, name: "Carregador Xiaomi Turbo Original (Kit)", price: 14.99, description: "Carregador original Xiaomi disponível em 33W e 67W. Ideal para carregamento rápido (Turbo Charge) de modelos Redmi Note, POCO e Mi. Inclui cabo USB-C de 6A robusto.", category: "Acessórios", stock: 50, image: "https://ae01.alicdn.com/kf/S39f8f02511234451b329c5c8860fb790m.jpg", images: ["https://ae-pic-a1.aliexpress-media.com/kf/S555171f359404ae89c4d848cc2fe87d9k.jpg_960x960q75.jpg_.avif"], features: ["Carregamento Turbo", "Cabo USB-C 6A Incluído", "Compatível com POCO/Redmi", "Proteção Inteligente"]
  },
  {
    id: 3, name: "Cabo HDMI 2.1 Ultra Speed (2m)", price: 6.99, description: "A qualidade máxima de imagem. Essencial para PS5, Xbox Series X e TVs 4K/8K para tirar proveito de 120Hz.", category: "Cabos", stock: 50, image: "https://img.kwcdn.com/product/fancy/0f34dd80-9343-4437-a5e2-b8f09672f205.jpg?imageView2/2/w/800/q/70", images: ["https://img.kwcdn.com/product/fancy/eba4ff93-b8ef-4e88-ab42-0d39cd20dfbe.jpg?imageView2/2/w/800/q/70"], features: ["48Gbps Largura de Banda", "8K @ 60Hz / 4K @ 120Hz", "eARC e VRR", "Conectores Gold"]
  },
  {
    id: 4, name: "Cabo de Rede Ethernet Cat8 (10m)", price: 12.50, description: "Internet sem falhas. O cabo mais rápido do mercado, blindado contra interferências. Perfeito para gaming e streaming pesado.", category: "Cabos", stock: 50, image: "https://img.kwcdn.com/product/fancy/e6cfaa4a-9144-462c-ab3c-ebcd3d4f014b.jpg?imageView2/2/w/800/q/70", images: ["https://img.kwcdn.com/product/fancy/e2ee21d8-ceb2-4d98-9292-68834046f810.jpg?imageView2/2/w/800/q/70"], features: ["Velocidade até 40Gbps", "2000MHz Frequência", "Blindagem S/FTP", "10 Metros"]
  },
  {
    id: 9, name: "Cabo Xiaomi Turbo USB-C para USB-C (120W)", price: 3.99, description: "Cabo original para HyperCharge 120W da Xiaomi. Ideal para tirar o máximo proveito dos carregadores turbo originais.", category: "Cabos", stock: 50, image: "https://ae-pic-a1.aliexpress-media.com/kf/Scd9ec99f95dc4efb8b3f82634c835943C.jpg_960x960q75.jpg_.avif", images: ["https://ae-pic-a1.aliexpress-media.com/kf/Sad41e1921649498fb062d77d60d4824dg.jpg_220x220q75.jpg_.avif"], features: ["Suporta 120W HyperCharge", "Chip Original Xiaomi", "Alta Resistência", "Ideal para Série Mi e POCO"]
  },
  {
    id: 7, name: "Carregador Turbo (Sem Cabo)", price: 5.99, description: "Carregamento ultra-rápido compatível com Xiaomi e outras marcas. Disponível em várias potências para se adaptar ao seu modelo. Inclui cabo USB-C Turbo de 6A.", category: "Acessórios", stock: 50, image: "https://s.alicdn.com/@sc04/kf/Hac03a0dd00374cf9a345b52b8c6a446dq.jpg", images: ["https://s.alicdn.com/@sc04/kf/H449959a037d9422aa3d28f242af3d0bel.jpg"], features: ["Tecnologia GaN", "Proteção Contra Sobrecarga", "Inclui Cabo 6A", "Compatível Xiaomi"]
  },
  {
    id: 5, name: "Hub Acer USB-A para Ethernet LAN", price: 7.00, description: "Conectividade fiável. Adicione uma porta de rede Gigabit ao seu portátil ou PC via USB com a qualidade Acer.", category: "Adaptadores", stock: 50, image: "https://img.kwcdn.com/product/fancy/769740de-1fd9-4a79-a1d9-de36003c9316.jpg?imageView2/2/w/800/q/70", images: ["https://img.kwcdn.com/product/fancy/ee3ca530-c421-47db-80b2-a2b74dbd7709.jpg?imageView2/2/w/800/q/70"], features: ["Gigabit Ethernet (1000Mbps)", "USB 3.0 Rápido", "Plug & Play", "Design Compacto Acer"]
  }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const storeUrl = `${PUBLIC_URL}/#product/${id}`;

  if (!id || isNaN(parseInt(id as string))) {
    return res.redirect(301, PUBLIC_URL);
  }

  try {
    const productId = parseInt(id as string, 10);
    
    const product = PRODUCTS.find(p => p.id === productId);

    let title: string;
    let description: string;
    let finalImage: string;
    let price: number | null;

    if (product) {
      title = product.name;
      description = product.description;
      finalImage = product.image;
      price = product.price;
    } else {
      title = `${STORE_NAME} | Produto não encontrado`;
      description = `Visite a ${STORE_NAME} para ver as nossas ofertas em eletrónica e gadgets.`;
      finalImage = 'https://i.imgur.com/nSiZKBf.png';
      price = null;
    }
    
    const formattedPrice = price ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price) : '';
    const seoTitle = price ? `${formattedPrice} 🔥 ${title}` : title;
    const seoDesc = price ? `⭐️⭐️⭐️⭐️⭐️ (4.9/5) | ${description.substring(0, 150)}...\n\n✅ Entrega Rápida em Portugal\n✅ Garantia de 3 Anos` : description;
    
    const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="UTF-8">
    <title>${seoTitle}</title>
    <meta name="description" content="${seoDesc}">

    <meta property="og:site_name" content="${STORE_NAME}">
    <meta property="og:title" content="${seoTitle}">
    <meta property="og:description" content="${seoDesc}">
    <meta property="og:image" content="${finalImage}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:type" content="product">
    <meta property="og:url" content="${PUBLIC_URL}/p/${id}">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${seoTitle}">
    <meta name="twitter:description" content="${seoDesc}">
    <meta name="twitter:image" content="${finalImage}">

    <link rel="canonical" href="${storeUrl}" />
</head>
<body style="font-family: sans-serif; text-align: center; margin-top: 50px; background-color: #f0f2f5;">
    <p>A redirecionar para a nossa loja...</p>
    <script>window.location.href = "${storeUrl}";</script>
    <noscript>
        <p>Por favor, clique <a href="${storeUrl}" style="color: #3b82f6; font-weight: bold;">aqui</a> para continuar.</p>
    </noscript>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Força a não utilização de cache para garantir que os bots recebem sempre a versão mais recente
    res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    return res.status(200).send(html);

  } catch (error) {
    console.error(`[API/OG] FATAL: Unhandled exception for ID ${id}:`, error);
    return res.redirect(301, storeUrl);
  }
}

