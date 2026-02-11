
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PUBLIC_URL, STORE_NAME, SHARE_URL, LOGO_URL } from '../constants';

// ID do Projeto Firebase (retirado do firebaseConfig.ts)
const FIREBASE_PROJECT_ID = "allshop-store-70851";

// Função auxiliar para limpar os campos estranhos do Firestore REST API
// Ex: { name: { stringValue: "Box" } } -> { name: "Box" }
const parseFirestoreField = (field: any) => {
    if (!field) return null;
    if (field.stringValue) return field.stringValue;
    if (field.doubleValue) return parseFloat(field.doubleValue);
    if (field.integerValue) return parseInt(field.integerValue);
    if (field.booleanValue) return field.booleanValue;
    if (field.arrayValue) return (field.arrayValue.values || []).map(parseFirestoreField);
    if (field.mapValue) return parseFirestoreDoc(field.mapValue.fields);
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
  
  // URL final para onde os humanos serão redirecionados (App React)
  const humanRedirectUrl = `${PUBLIC_URL}/#product/${id}`;

  if (!id || typeof id !== 'string') {
    return res.redirect(301, PUBLIC_URL);
  }

  // 1. DETEÇÃO DE BOTS (Telegram, WhatsApp, Facebook, etc.)
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const isBot = /(telegram|whatsapp|facebook|twitter|linkedin|slack|discord|bot|googlebot|bingbot|yandex|craw)/i.test(userAgent);

  // Se for um humano no browser, redireciona IMEDIATAMENTE para a loja
  if (!isBot) {
    res.redirect(302, humanRedirectUrl);
    return;
  }

  // 2. SE FOR UM ROBÔ: Buscar dados reais ao Firebase via REST API (Super Rápido)
  // Usamos a API REST para não precisar configurar admin SDK com chaves privadas no Vercel
  let product = null;
  
  try {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products_public/${id}`;
      const response = await fetch(firestoreUrl);
      
      if (response.ok) {
          const data = await response.json();
          if (data && data.fields) {
              product = parseFirestoreDoc(data.fields);
          }
      } else {
          console.error(`Erro ao buscar produto ${id}:`, response.statusText);
      }
  } catch (error) {
      console.error("Erro fetch firestore:", error);
  }

  // Se o produto não existir na DB, redireciona para a home
  if (!product) {
      return res.redirect(302, PUBLIC_URL);
  }

  // 3. PREPARAR DADOS PARA O CARTÃO SOCIAL
  const formattedPrice = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.price || 0);
  const seoTitle = `${formattedPrice} | ${product.name}`;
  
  // Limpar descrição para SEO (remover markdown ou quebras excessivas)
  const cleanDesc = (product.description || "").replace(/[\r\n]+/g, " ").substring(0, 160) + "...";
  const seoDesc = `⭐️ Stock Nacional ✅ Entrega Rápida 🛡️ Garantia 3 Anos. ${cleanDesc}`;

  // Garantir imagem válida (usa a do produto ou o logo da loja como fallback)
  // O Telegram odeia imagens .webp ou links relativos. Tem de ser .jpg/.png absoluto.
  let ogImageUrl = product.image || LOGO_URL;
  
  // Truque: Se for imagem do Imgur/AliExpress que bloqueia bots, usar o nosso logo como fallback de segurança
  // Mas como agora vem do Firebase Storage (que tu usas), deve funcionar 100%.
  
  const html = `
<!DOCTYPE html>
<html lang="pt-PT" prefix="og: http://ogp.me/ns#">
<head>
    <meta charset="UTF-8">
    <title>${seoTitle}</title>
    <meta name="description" content="${seoDesc}">
    <meta name="theme-color" content="#3b82f6">

    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="product">
    <meta property="og:site_name" content="${STORE_NAME}">
    <meta property="og:url" content="${SHARE_URL}/product/${id}">
    <meta property="og:title" content="${seoTitle}">
    <meta property="og:description" content="${seoDesc}">
    <meta property="og:image" content="${ogImageUrl}">
    <meta property="og:image:width" content="800">
    <meta property="og:image:height" content="800">
    <meta property="product:price:amount" content="${(product.price || 0).toFixed(2)}">
    <meta property="product:price:currency" content="EUR">

    <!-- Twitter / Telegram -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:domain" content="all-shop.net">
    <meta name="twitter:url" content="${SHARE_URL}/product/${id}">
    <meta name="twitter:title" content="${seoTitle}">
    <meta name="twitter:description" content="${seoDesc}">
    <meta name="twitter:image" content="${ogImageUrl}">

    <!-- Redirecionamento JS como fallback -->
    <script>
        // Se por acaso um humano ver esta página, manda-o para a loja real
        window.location.href = "${humanRedirectUrl}";
    </script>
</head>
<body>
    <div style="padding: 20px; font-family: sans-serif;">
        <h1>${product.name}</h1>
        <img src="${ogImageUrl}" style="max-width: 100%; border-radius: 10px;" />
        <p><strong>${formattedPrice}</strong></p>
        <p>${seoDesc}</p>
        <a href="${humanRedirectUrl}">Ver na Loja</a>
    </div>
</body>
</html>`;

  // Headers cruciais para o Telegram não fazer cache da versão "roxa" antiga
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // Força atualização
  return res.status(200).send(html);
}
