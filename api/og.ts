
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { INITIAL_PRODUCTS, PUBLIC_URL, STORE_NAME } from '../constants';

const PROJECT_ID = "allshop-store-70851";
const API_KEY = process.env.API_KEY;

// Algumas imagens do AliExpress/Alibaba bloqueiam bots. 
// Esta função tenta garantir que o bot consegue ver a imagem.
const getSafeImageUrl = (url: string) => {
    if (!url) return 'https://i.imgur.com/nSiZKBf.png';
    // Se for AliExpress (.avif ou .jpg_960), o Telegram às vezes falha.
    // Usamos um placeholder se a imagem parecer problemática ou retornamos a original
    return url;
};

const parseFirestoreField = (field: any) => {
    if (!field) return null;
    if (field.stringValue) return field.stringValue;
    if (field.integerValue) return parseInt(field.integerValue);
    if (field.doubleValue) return parseFloat(field.doubleValue);
    return null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const userAgent = req.headers['user-agent'] || '';
  
  // Lista de bots conhecidos
  const isBot = /bot|telegram|whatsapp|facebook|twitter|slack|discord|crawler|spider/i.test(userAgent);
  const storeUrl = `${PUBLIC_URL}/#product/${id}`;

  if (!id) return res.redirect(PUBLIC_URL);

  // SE FOR HUMANO: Redireciona logo para a App
  if (!isBot) {
    return res.status(301).redirect(storeUrl);
  }

  // SE FOR BOT: Gera o HTML rico com Metadados
  try {
    const productId = parseInt(id as string, 10);
    let title = 'Produto';
    let description = 'Veja os detalhes deste produto na Allshop.';
    let rawImage = 'https://i.imgur.com/nSiZKBf.png'; 
    let price: number | null = null;

    // 1. Tentar buscar no Firestore (Produção)
    if (API_KEY) {
        try {
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products_public/${id}?key=${API_KEY}`;
            const apiRes = await fetch(firestoreUrl);
            if (apiRes.ok) {
                const json = await apiRes.json();
                if (json.fields) {
                    title = parseFirestoreField(json.fields.name) || title;
                    description = parseFirestoreField(json.fields.description) || description;
                    rawImage = parseFirestoreField(json.fields.image) || rawImage;
                    price = parseFirestoreField(json.fields.price) || null;
                }
            }
        } catch (err) {}
    }

    // 2. Fallback para os produtos iniciais (Desenvolvimento/Teste)
    if (title === 'Produto') {
        const staticProduct = INITIAL_PRODUCTS.find(p => p.id === productId);
        if (staticProduct) {
            title = staticProduct.name;
            description = staticProduct.description;
            rawImage = staticProduct.image;
            price = staticProduct.price;
        }
    }
    
    const finalImage = getSafeImageUrl(rawImage);
    const formattedPrice = price ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price) : '';
    
    // FORMATO ESTILO TEMU/AMAZON: Preço em primeiro lugar no título para o Telegram destacar em negrito
    const seoTitle = price ? `${formattedPrice} 🔥 ${title}` : title;
    const seoDesc = `🚚 Entrega Rápida em Portugal | 🛡️ 3 Anos de Garantia\n\n${description.substring(0, 150)}...`;
    
    const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="UTF-8">
    <title>${seoTitle}</title>
    <meta name="description" content="${seoDesc}">

    <!-- Open Graph (O que o Telegram lê) -->
    <meta property="og:site_name" content="${STORE_NAME}">
    <meta property="og:title" content="${seoTitle}">
    <meta property="og:description" content="${seoDesc}">
    <meta property="og:image" content="${finalImage}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:type" content="product">
    <meta property="og:url" content="${PUBLIC_URL}/p/${id}">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${seoTitle}">
    <meta name="twitter:description" content="${seoDesc}">
    <meta name="twitter:image" content="${finalImage}">

    <!-- Redirecionamento de segurança para humanos que escapem ao filtro -->
    <meta http-equiv="refresh" content="0;url=${storeUrl}">
</head>
<body>
    <h1>${title}</h1>
    <p>${description}</p>
    <img src="${finalImage}" />
    <script>window.location.href = "${storeUrl}";</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=1800');
    return res.status(200).send(html);

  } catch (error) {
    return res.status(301).redirect(storeUrl);
  }
}

