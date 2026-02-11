
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
  const humanRedirectUrl = `${PUBLIC_URL}/#product/${id}`;

  // 1. Se for humano, redireciona logo.
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const isBot = /(telegram|whatsapp|facebook|twitter|linkedin|slack|discord|bot|googlebot)/i.test(userAgent);

  if (!isBot) {
    return res.redirect(302, humanRedirectUrl);
  }

  if (!id || typeof id !== 'string') {
    return res.redirect(302, PUBLIC_URL);
  }

  // 2. Se for Bot, tenta buscar os dados
  let product = { name: STORE_NAME, description: 'Melhor tecnologia ao melhor preço.', image: LOGO_URL, price: 0 };
  
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

  // 3. LÓGICA SIMPLIFICADA DE IMAGEM (Lista de Confiança)
  // Só usamos a imagem do produto se vier de um destes domínios fiáveis.
  // Caso contrário (blogs, sites estranhos), usamos o Logótipo.
  const safeDomains = [
      'firebasestorage.googleapis.com', // As tuas fotos
      'imgur.com',                      // Fotos seguras
      'alicdn.com',                     // AliExpress
      'aliexpress.com',                 // AliExpress
      'kwcdn.com'                       // Temu
  ];

  let finalImage = product.image;
  const isSafe = finalImage && safeDomains.some(domain => finalImage.includes(domain));

  if (!isSafe) {
      finalImage = LOGO_URL;
  }

  // 4. Gerar HTML Simples
  const priceTag = product.price > 0 
    ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.price)
    : '';
    
  const title = priceTag ? `${priceTag} | ${product.name}` : product.name;

  const html = `
<!DOCTYPE html>
<html lang="pt-PT" prefix="og: http://ogp.me/ns#">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="Click para ver detalhes na loja. Envio rápido!">
    <meta property="og:image" content="${finalImage}">
    <meta property="og:url" content="${SHARE_URL}/product/${id}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${finalImage}">
</head>
<body></body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).send(html);
}
