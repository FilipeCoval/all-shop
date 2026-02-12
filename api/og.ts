
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- CONSTANTES INTERNAS (Para evitar erros de importação no Serverless) ---
const STORE_NAME = "Allshop";
const LOGO_URL = "https://i.imgur.com/nSiZKBf.png";
const PUBLIC_URL = "https://www.all-shop.net";
const SHARE_URL = "https://share.all-shop.net";
const FIREBASE_PROJECT_ID = "allshop-store-70851";

// Função auxiliar para processar dados do Firestore REST API
const parseFirestoreField = (field: any) => {
    if (!field) return null;
    if (field.stringValue) return field.stringValue;
    if (field.doubleValue) return parseFloat(field.doubleValue);
    if (field.integerValue) return parseInt(field.integerValue);
    if (field.arrayValue && field.arrayValue.values) {
        return field.arrayValue.values.map((v: any) => parseFirestoreField(v));
    }
    return null;
};

const parseFirestoreDoc = (fields: any) => {
    const obj: any = {};
    for (const key in fields) {
        obj[key] = parseFirestoreField(fields[key]);
    }
    return obj;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const humanRedirectUrl = `${PUBLIC_URL}/#product/${id}`;

  // 1. DETEÇÃO DE BOTS
  // Se não for um bot social, redireciona imediatamente para a loja
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const isBot = /(telegram|whatsapp|facebook|twitter|linkedin|slack|discord|bot|googlebot|pinterest)/i.test(userAgent);

  if (!isBot) {
    return res.redirect(302, humanRedirectUrl);
  }

  if (!id || typeof id !== 'string') {
    return res.redirect(302, PUBLIC_URL);
  }

  // 2. DADOS PADRÃO (Fallback)
  let product = { 
      name: STORE_NAME, 
      description: 'As melhores ofertas em tecnologia e gadgets.', 
      image: LOGO_URL, 
      price: 0,
      category: 'Oferta Especial'
  };
  
  // 3. BUSCAR DADOS AO FIREBASE (REST API)
  try {
      // Nota: O ID na URL deve corresponder ao ID do Documento no Firestore
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products_public/${id}`;
      const response = await fetch(firestoreUrl);
      
      if (response.ok) {
          const data = await response.json();
          if (data && data.fields) {
              const p = parseFirestoreDoc(data.fields);
              product = { ...product, ...p };
          }
      } else {
          console.error("Firestore Error:", response.status, response.statusText);
      }
  } catch (error) {
      console.error("Fetch Error:", error);
  }

  // 4. SEGURANÇA DE IMAGEM
  const safeDomains = [
      'firebasestorage.googleapis.com', 
      'imgur.com', 'alicdn.com', 'aliexpress.com', 'kwcdn.com'                       
  ];

  let finalImage = product.image;
  const isSafe = finalImage && safeDomains.some(domain => finalImage.includes(domain));
  if (!isSafe) finalImage = LOGO_URL;

  // 5. FORMATAÇÃO ESTILO "TEMU"
  const priceVal = product.price || 0;
  const formattedPrice = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(priceVal);
  
  // Título agressivo com preço
  const seoTitle = `${formattedPrice} | ${product.name}`;
  
  // Descrição rica com emojis
  const description = `⭐️ 4.9/5 • ${product.category}\n🔥 OFERTA RELÂMPAGO! Stock Nacional 🇵🇹\n🚚 Entrega 24h • Garantia 3 Anos\n👇 Toque aqui para comprar agora!`;

  // HTML Otimizado para Preview
  const html = `
<!DOCTYPE html>
<html lang="pt-PT" prefix="og: http://ogp.me/ns#">
<head>
    <meta charset="UTF-8">
    <title>${seoTitle}</title>
    
    <!-- Open Graph (Facebook, WhatsApp, LinkedIn) -->
    <meta property="og:site_name" content="${STORE_NAME}">
    <meta property="og:type" content="product">
    <meta property="og:url" content="${SHARE_URL}/product/${id}">
    <meta property="og:title" content="${seoTitle}">
    <meta property="og:description" content="${description}">
    
    <!-- Forçar Imagem Grande -->
    <meta property="og:image" content="${finalImage}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${product.name}">

    <!-- Twitter Cards (Telegram usa isto frequentemente) -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:domain" content="${SHARE_URL.replace('https://', '')}">
    <meta name="twitter:url" content="${SHARE_URL}/product/${id}">
    <meta name="twitter:title" content="${seoTitle}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${finalImage}">
    
    <!-- Dados de Preço para Rich Snippets -->
    <meta property="product:price:amount" content="${priceVal}">
    <meta property="product:price:currency" content="EUR">
    <meta property="product:availability" content="in stock">
</head>
<body style="font-family: sans-serif; text-align: center; padding: 20px;">
    <!-- Conteúdo visual caso algum bot renderize a página -->
    <img src="${finalImage}" style="max-width: 100%; height: auto; border-radius: 10px; max-height: 400px;">
    <h1 style="font-size: 24px; margin: 10px 0;">${product.name}</h1>
    <h2 style="color: #e60023; font-size: 36px; margin: 5px 0;">${formattedPrice}</h2>
    <p style="color: #666;">${description}</p>
    <a href="${humanRedirectUrl}" style="display: inline-block; background: #e60023; color: white; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 30px; margin-top: 10px;">COMPRAR AGORA</a>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Cache curto para garantir que atualizações de preço refletem rápido
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300'); 
  return res.status(200).send(html);
}

