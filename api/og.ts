
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { INITIAL_PRODUCTS, PUBLIC_URL, STORE_NAME } from '../constants';

const PROJECT_ID = "allshop-store-70851";
const API_KEY = process.env.API_KEY;

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
  
  const isBot = /bot|telegram|whatsapp|facebook|twitter|slack|discord|crawler|spider/i.test(userAgent);
  const storeUrl = `${PUBLIC_URL}/#product/${id}`;

  if (!id) return res.redirect(PUBLIC_URL);

  if (!isBot) {
    return res.status(301).redirect(storeUrl);
  }

  try {
    const productId = parseInt(id as string, 10);
    let title = 'Produto';
    let description = 'Veja os detalhes deste produto na Allshop.';
    let finalImage = 'https://i.imgur.com/nSiZKBf.png'; 
    let price: number | null = null;

    if (API_KEY) {
        try {
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products_public/${id}?key=${API_KEY}`;
            const apiRes = await fetch(firestoreUrl);
            if (apiRes.ok) {
                const json = await apiRes.json();
                if (json.fields) {
                    title = parseFirestoreField(json.fields.name) || title;
                    description = parseFirestoreField(json.fields.description) || description;
                    finalImage = parseFirestoreField(json.fields.image) || finalImage;
                    price = parseFirestoreField(json.fields.price) || null;
                }
            } else {
                 // Adiciona log para sabermos porque falhou
                 console.error(`[API/OG] Firestore fetch failed for ID ${id}:`, apiRes.status, await apiRes.text());
            }
        } catch (err) {
            // Log do erro para depuração na Vercel
            console.error(`[API/OG] CRITICAL: Firestore request crashed for ID ${id}:`, err);
        }
    } else {
        console.error("[API/OG] CRITICAL: A variável de ambiente API_KEY não está configurada na Vercel.");
    }

    if (title === 'Produto') {
        const staticProduct = INITIAL_PRODUCTS.find(p => p.id === productId);
        if (staticProduct) {
            title = staticProduct.name;
            description = staticProduct.description;
            finalImage = staticProduct.image;
            price = staticProduct.price;
        }
    }
    
    const formattedPrice = price ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price) : '';
    
    const seoTitle = price ? `${formattedPrice} 🔥 ${title}` : title;
    const seoDesc = `🚚 Entrega Rápida em Portugal | 🛡️ 3 Anos de Garantia\n\n${description.substring(0, 150)}...`;
    
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

    <meta http-equiv="refresh" content="0;url=${storeUrl}">
</head>
<body>
    <script>window.location.href = "${storeUrl}";</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=1800');
    return res.status(200).send(html);

  } catch (error) {
    console.error(`[API/OG] FATAL: Unhandled exception for ID ${id}:`, error);
    return res.status(301).redirect(storeUrl);
  }
}
