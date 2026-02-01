
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { INITIAL_PRODUCTS, PUBLIC_URL, STORE_NAME } from '../constants';

const PROJECT_ID = "allshop-store-70851";
const API_KEY = process.env.API_KEY;

const proxyImage = (url: string) => {
    const FALLBACK_IMAGE = 'https://i.imgur.com/nSiZKBf.png';
    if (!url) return FALLBACK_IMAGE;
    if (url.includes('firebasestorage.googleapis.com')) {
        return url.includes('?') ? url : `${url}?alt=media`;
    }
    if (url.includes('imgur.com')) return url;
    // Se a imagem for externa, o ideal seria ter um serviço de resize/proxy, 
    // mas por agora usamos a original para o bot ver algo.
    return url;
};

const parseFirestoreField = (field: any) => {
    if (!field) return null;
    if (field.stringValue) return field.stringValue;
    if (field.integerValue) return parseInt(field.integerValue);
    if (field.doubleValue) return parseFloat(field.doubleValue);
    if (field.arrayValue && field.arrayValue.values) {
        return field.arrayValue.values.map((v: any) => parseFirestoreField(v));
    }
    return null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id) return res.status(400).send('ID Required');

  try {
    const productId = parseInt(id as string, 10);
    let title = 'Allshop Store';
    let description = 'Descubra as melhores ofertas em gadgets e eletrónica.';
    let rawImage = 'https://i.imgur.com/nSiZKBf.png'; 
    let price: number | null = null;

    // Buscar via REST API do Firestore
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
        } catch (err) { console.error("Firestore REST Error:", err); }
    }

    // Fallback estático
    if (title === 'Allshop Store') {
        const staticProduct = INITIAL_PRODUCTS.find(p => p.id === productId);
        if (staticProduct) {
            title = staticProduct.name;
            description = staticProduct.description;
            rawImage = staticProduct.image;
            price = staticProduct.price;
        }
    }
    
    const finalImage = proxyImage(rawImage);
    const formattedPrice = price ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price) : '';
    
    // ESTILO TEMU: O título contém o preço em destaque para o card aparecer rico
    const seoTitle = price ? `${formattedPrice} - ${title}` : title;
    const seoDesc = `🛍️ Compre na ${STORE_NAME}: ${description.substring(0, 160)}${description.length > 160 ? '...' : ''} | Entrega rápida em Portugal!`;
    
    const storeUrl = `${PUBLIC_URL}/#product/${id}`;
    const canonicalUrl = `${PUBLIC_URL}/p/${id}`;
    
    const html = `
      <!DOCTYPE html>
      <html lang="pt-PT">
      <head>
        <meta charset="UTF-8">
        <title>${seoTitle}</title>
        <meta name="description" content="${seoDesc}">
        
        <!-- Open Graph / Social Media (O segredo do card bonito) -->
        <meta property="og:type" content="product">
        <meta property="og:site_name" content="${STORE_NAME}">
        <meta property="og:url" content="${canonicalUrl}">
        <meta property="og:title" content="${seoTitle}">
        <meta property="og:description" content="${seoDesc}">
        <meta property="og:image" content="${finalImage}">
        <meta property="og:image:secure_url" content="${finalImage}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta property="product:price:amount" content="${price || ''}">
        <meta property="product:price:currency" content="EUR">

        <!-- Twitter -->
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:title" content="${seoTitle}">
        <meta property="twitter:description" content="${seoDesc}">
        <meta property="twitter:image" content="${finalImage}">

        <!-- Redirecionamento para humanos -->
        <meta http-equiv="refresh" content="0;url=${storeUrl}">
        <script>window.location.href = "${storeUrl}";</script>
      </head>
      <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #f4f4f4;">
        <img src="${finalImage}" style="width: 100px; border-radius: 10px; margin-bottom: 20px;">
        <h2>A abrir produto na ${STORE_NAME}...</h2>
        <p>Se não for redirecionado, <a href="${storeUrl}">clique aqui</a>.</p>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200'); 
    return res.status(200).send(html);

  } catch (error) {
    return res.status(500).send('Error rendering preview');
  }
}
