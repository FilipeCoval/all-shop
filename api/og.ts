
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- CONSTANTES ---
const STORE_NAME = "All-Shop";
const LOGO_URL = "https://i.imgur.com/nSiZKBf.png";
const PUBLIC_URL = "https://www.all-shop.net";
const SHARE_URL = "https://share.all-shop.net";
const FIREBASE_PROJECT_ID = "allshop-store-70851";

// Banner de alta qualidade para a Home (Mesma imagem do index.html)
const HOME_BANNER = "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?q=80&w=1200&auto=format&fit=crop";

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

  // Se não houver ID, manda para a home
  if (!productId) {
    return res.redirect(302, PUBLIC_URL);
  }

  let product = { 
      name: STORE_NAME, 
      description: 'As melhores ofertas em tecnologia.', 
      image: LOGO_URL, 
      price: 0,
      category: 'Oferta'
  };
  
  let destinationUrl = `${PUBLIC_URL}/#product/${productId}`;
  let seoTitle = "";
  let description = "";
  let finalImage = "";

  // --- LÓGICA ESPECIAL: HOME / LOJA / ALLPOINTS ---
  if (productId === 'home') {
      product.name = "All-Shop Oficial";
      product.description = "A sua loja de tecnologia favorita. TV Boxes, Cabos e Gadgets com stock nacional e garantia de 3 anos.";
      product.image = HOME_BANNER;
      product.category = "Loja Online";
      
      destinationUrl = PUBLIC_URL;
      
      seoTitle = `${STORE_NAME} | Tecnologia ao Melhor Preço`;
      description = `🇵🇹 Stock Nacional • Entrega 24h\n⭐️ Garantia 3 Anos • Suporte Premium\n🔥 As melhores TV Boxes e Gadgets estão aqui!\n👇 Toque para visitar a loja.`;
      finalImage = HOME_BANNER;
  
  } else if (productId === 'allpoints') {
      product.name = "AllPoints - Clube de Fidelidade";
      product.description = "Ganhe pontos em todas as compras e troque por descontos exclusivos.";
      product.image = HOME_BANNER; // Pode ser alterado para uma imagem específica de fidelidade
      product.category = "Fidelidade";

      destinationUrl = `${PUBLIC_URL}/#allpoints`;

      seoTitle = `AllPoints | Ganhe Descontos Reais`;
      description = `💎 Ganhe 1 ponto por cada 1€ gasto\n🎁 Troque pontos por Vouchers de Desconto\n🎂 Bónus de Aniversário e Reviews\n👇 Comece a poupar hoje mesmo!`;
      finalImage = HOME_BANNER;

  } else {
      // --- LÓGICA PADRÃO: PRODUTO ---
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

      // Preparação Visual Produto
      const priceVal = product.price || 0;
      const formattedPrice = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(priceVal);
      seoTitle = `${formattedPrice} | ${product.name}`;
      description = `⭐️ 4.9/5 • ${product.category}\n🔥 OFERTA RELÂMPAGO! Stock Nacional 🇵🇹\n🚚 Entrega 24h • Garantia 3 Anos\n👇 Toque aqui para ver detalhes!`;
      
      // Fallback de segurança para imagem do produto
      const safeDomains = ['firebasestorage.googleapis.com', 'imgur.com', 'alicdn.com', 'aliexpress.com', 'kwcdn.com', 'images.unsplash.com'];
      finalImage = product.image;
      const isSafe = finalImage && safeDomains.some(domain => finalImage.includes(domain));
      if (!isSafe) finalImage = LOGO_URL;
  }

  // --- HTML MÁGICO ---
  const html = `
<!DOCTYPE html>
<html lang="pt-PT" prefix="og: http://ogp.me/ns#">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${seoTitle}</title>
    
    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${SHARE_URL}/${productId === 'home' ? 'home' : `product/${productId}`}">
    <meta property="og:title" content="${seoTitle}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${finalImage}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="${STORE_NAME}">

    <!-- Twitter Large Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:domain" content="${SHARE_URL.replace('https://', '')}">
    <meta name="twitter:url" content="${SHARE_URL}/${productId === 'home' ? 'home' : `product/${productId}`}">
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
        ${productId !== 'home' ? `<h2 style="color: #e60023; font-size: 32px; margin: 0 0 20px;">${seoTitle.split('|')[0]}</h2>` : ''}
        <a href="${destinationUrl}" style="display: block; background: #e60023; color: white; text-decoration: none; padding: 15px; border-radius: 30px; font-weight: bold; font-size: 18px;">
            ${productId === 'home' ? 'Entrar na Loja' : 'Ver na Loja'}
        </a>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">A redirecionar...</p>
    </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  
  return res.status(200).send(html);
}
