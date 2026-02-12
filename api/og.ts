
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- CONSTANTES ---
const STORE_NAME = "Allshop";
const LOGO_URL = "https://i.imgur.com/nSiZKBf.png";
const PUBLIC_URL = "https://www.all-shop.net";
const SHARE_URL = "https://share.all-shop.net";
const FIREBASE_PROJECT_ID = "allshop-store-70851";

// Helpers para Firestore REST
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
  const productId = Array.isArray(id) ? id[0] : id; // Garante string

  // URL final para onde o cliente será enviado
  const destinationUrl = `${PUBLIC_URL}/#product/${productId}`;

  // Se não houver ID, manda para a home
  if (!productId) {
    return res.redirect(302, PUBLIC_URL);
  }

  // --- DADOS DO PRODUTO ---
  let product = { 
      name: STORE_NAME, 
      description: 'As melhores ofertas em tecnologia.', 
      image: LOGO_URL, 
      price: 0,
      category: 'Oferta'
  };
  
  try {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products_public/${productId}`;
      const response = await fetch(firestoreUrl);
      
      if (response.ok) {
          const data = await response.json();
          if (data && data.fields) {
              const p = parseFirestoreDoc(data.fields);
              product = { ...product, ...p };
          }
      }
  } catch (error) {
      console.error("Erro OG Fetch:", error);
  }

  // --- PREPARAÇÃO VISUAL (ESTILO TEMU) ---
  const priceVal = product.price || 0;
  const formattedPrice = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(priceVal);
  
  // Título: PREÇO PRIMEIRO para chamar atenção
  const seoTitle = `${formattedPrice} | ${product.name}`;
  
  // Descrição: Emojis e urgência
  const description = `⭐️ 4.9/5 • ${product.category}\n🔥 OFERTA RELÂMPAGO! Stock Nacional 🇵🇹\n🚚 Entrega 24h • Garantia 3 Anos\n👇 Toque aqui para ver detalhes!`;

  // Imagem: Fallback de segurança
  const safeDomains = ['firebasestorage.googleapis.com', 'imgur.com', 'alicdn.com', 'aliexpress.com', 'kwcdn.com'];
  let finalImage = product.image;
  const isSafe = finalImage && safeDomains.some(domain => finalImage.includes(domain));
  if (!isSafe) finalImage = LOGO_URL;

  // --- HTML MÁGICO ---
  // Este HTML é servido a TODOS. 
  // 1. Os Robôs (Facebook/WhatsApp) lêem as meta tags e ignoram o script.
  // 2. Os Humanos executam o script e são redirecionados em 50ms.
  const html = `
<!DOCTYPE html>
<html lang="pt-PT" prefix="og: http://ogp.me/ns#">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${seoTitle}</title>
    
    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${SHARE_URL}/product/${productId}">
    <meta property="og:title" content="${seoTitle}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${finalImage}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="${STORE_NAME}">

    <!-- Twitter Large Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:domain" content="${SHARE_URL.replace('https://', '')}">
    <meta name="twitter:url" content="${SHARE_URL}/product/${productId}">
    <meta name="twitter:title" content="${seoTitle}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${finalImage}">

    <!-- Redirecionamento Automático para Humanos -->
    <script>
        setTimeout(function() {
            window.location.href = "${destinationUrl}";
        }, 50);
    </script>
</head>
<body style="font-family: sans-serif; text-align: center; padding: 40px; background: #f8fafc;">
    <div style="max-width: 500px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <img src="${finalImage}" style="width: 100%; max-height: 400px; object-fit: contain; border-radius: 8px;">
        <h1 style="font-size: 20px; color: #333; margin: 20px 0 10px;">${product.name}</h1>
        <h2 style="color: #e60023; font-size: 32px; margin: 0 0 20px;">${formattedPrice}</h2>
        <a href="${destinationUrl}" style="display: block; background: #e60023; color: white; text-decoration: none; padding: 15px; border-radius: 30px; font-weight: bold; font-size: 18px;">
            Ver na Loja
        </a>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">A redirecionar...</p>
    </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Cache-Control: Publico, mas revalida frequentemente para atualizar preços
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  
  return res.status(200).send(html);
}
