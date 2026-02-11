
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PUBLIC_URL, STORE_NAME, SHARE_URL, LOGO_URL } from '../constants';

const FIREBASE_PROJECT_ID = "allshop-store-70851";

// Função auxiliar para processar dados do Firestore
const parseFirestoreField = (field: any) => {
    if (!field) return null;
    if (field.stringValue) return field.stringValue;
    if (field.doubleValue) return parseFloat(field.doubleValue);
    if (field.integerValue) return parseInt(field.integerValue);
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
  
  // URL para onde o humano é redirecionado ao clicar
  const humanRedirectUrl = `${PUBLIC_URL}/#product/${id}`;

  // 1. DETEÇÃO DE BOTS (Telegram, WhatsApp, Facebook, etc.)
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const isBot = /(telegram|whatsapp|facebook|twitter|linkedin|slack|discord|bot|googlebot)/i.test(userAgent);

  // Se for uma pessoa real num browser, redireciona logo para a loja
  if (!isBot) {
    return res.redirect(302, humanRedirectUrl);
  }

  if (!id || typeof id !== 'string') {
    return res.redirect(302, PUBLIC_URL);
  }

  // 2. BUSCAR DADOS AO FIREBASE
  let product = { 
      name: STORE_NAME, 
      description: 'As melhores ofertas em tecnologia.', 
      image: LOGO_URL, 
      price: 0,
      category: 'Tecnologia'
  };
  
  try {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products_public/${id}`;
      const response = await fetch(firestoreUrl);
      
      if (response.ok) {
          const data = await response.json();
          if (data && data.fields) {
              const p = parseFirestoreDoc(data.fields);
              product = { ...product, ...p };
          }
      }
  } catch (error) {
      console.error("Erro OG:", error);
  }

  // 3. SEGURANÇA DE IMAGEM (Evitar erros roxos no Telegram)
  const safeDomains = [
      'firebasestorage.googleapis.com', 
      'imgur.com',                      
      'alicdn.com',                     
      'aliexpress.com',                 
      'kwcdn.com'                       
  ];

  let finalImage = product.image;
  // Se a imagem não vier de um domínio seguro conhecido, usa o logótipo para garantir que o link funciona.
  const isSafe = finalImage && safeDomains.some(domain => finalImage.includes(domain));
  if (!isSafe) {
      finalImage = LOGO_URL;
  }

  // 4. PREPARAR DADOS ESTILO "TEMU"
  const priceVal = product.price || 0;
  const formattedPrice = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(priceVal);

  // ESTRATÉGIA TEMU:
  // 1. Preço no Título para destaque imediato.
  // 2. Estrelas e "Envio Grátis/Rápido" na descrição.
  
  const seoTitle = `${formattedPrice} | ${product.name}`;
  
  // Criar uma descrição apelativa com emojis
  const description = `⭐️ 4.9/5 (Excelente) • ${product.category}\n🔥 Oferta Limitada! Stock Nacional 🇵🇹\n🚚 Envio Rápido em 24h • Garantia 3 Anos\n\nClique para ver detalhes na ${STORE_NAME}.`;

  const html = `
<!DOCTYPE html>
<html lang="pt-PT" prefix="og: http://ogp.me/ns#">
<head>
    <meta charset="UTF-8">
    <title>${seoTitle}</title>
    
    <!-- Open Graph (Facebook, WhatsApp, LinkedIn) -->
    <meta property="og:site_name" content="${STORE_NAME} | Ofertas Relâmpago">
    <meta property="og:type" content="product">
    <meta property="og:url" content="${SHARE_URL}/product/${id}">
    <meta property="og:title" content="${seoTitle}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${finalImage}">
    <meta property="og:image:width" content="1000">
    <meta property="og:image:height" content="1000">
    <meta property="product:price:amount" content="${priceVal}">
    <meta property="product:price:currency" content="EUR">
    <meta property="product:availability" content="in stock">

    <!-- Twitter / Telegram Large Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:domain" content="${SHARE_URL.replace('https://', '')}">
    <meta name="twitter:url" content="${SHARE_URL}/product/${id}">
    <meta name="twitter:title" content="${seoTitle}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${finalImage}">
    
    <!-- Dados Extra para Telegram -->
    <meta name="twitter:label1" content="Preço">
    <meta name="twitter:data1" content="${formattedPrice}">
    <meta name="twitter:label2" content="Avaliação">
    <meta name="twitter:data2" content="⭐️⭐️⭐️⭐️⭐️">
</head>
<body>
    <div style="padding: 40px; text-align: center; font-family: sans-serif;">
        <img src="${finalImage}" style="max-width: 300px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
        <h1 style="color: #333;">${product.name}</h1>
        <h2 style="color: #e60023; font-size: 32px;">${formattedPrice}</h2>
        <p style="color: #666;">${description}</p>
        <a href="${humanRedirectUrl}" style="background: #e60023; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; margin-top: 20px;">Ver na Loja</a>
    </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).send(html);
}
