import type { VercelRequest, VercelResponse } from '@vercel/node';
import { INITIAL_PRODUCTS } from '../constants';

// ID do Projeto Firebase (Retirado do firebaseConfig)
const PROJECT_ID = "allshop-store-70851";

// Helper para limpar campos do Firestore REST API
// A API devolve: { fields: { name: { stringValue: "..." }, price: { doubleValue: 10 } } }
// Nós queremos apenas: { name: "...", price: 10 }
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
  const host = req.headers.host;

  if (!id) {
    return res.status(400).send('ID Required');
  }

  try {
    const productId = parseInt(id as string, 10);
    
    let title = 'Allshop Store';
    let description = 'As melhores ofertas em tecnologia.';
    let image = 'https://i.imgur.com/nSiZKBf.png'; // Logo por defeito
    let price = null;

    // 1. Tentar encontrar na lista estática primeiro (Zero latência)
    const staticProduct = INITIAL_PRODUCTS.find(p => p.id === productId);
    
    if (staticProduct) {
        title = staticProduct.name;
        description = staticProduct.description;
        image = staticProduct.image;
        price = staticProduct.price;
    } else {
        // 2. Se não estiver na estática, buscar via REST API do Firestore
        // Isto funciona com QUALQUER link de imagem que você tenha salvo no Dashboard
        try {
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products_public/${id}`;
            const apiRes = await fetch(firestoreUrl);
            
            if (apiRes.ok) {
                const json = await apiRes.json();
                if (json.fields) {
                    title = parseFirestoreField(json.fields.name) || title;
                    description = parseFirestoreField(json.fields.description) || description;
                    image = parseFirestoreField(json.fields.image) || image;
                    price = parseFirestoreField(json.fields.price);
                }
            } else {
                console.error(`Product ${id} not found in DB via REST`);
            }
        } catch (err) {
            console.error("Firestore REST Error:", err);
        }
    }

    // 3. Formatação Final
    const safeDesc = description ? (description.substring(0, 150) + (description.length > 150 ? '...' : '')) : '';
    const safeTitle = price ? `${title} (${price}€)` : title;
    
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const cleanUrl = `${protocol}://${host}/product/${id}`;
    const storeUrl = `${protocol}://${host}/#product/${id}`;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-PT">
      <head>
        <meta charset="UTF-8">
        <title>${safeTitle}</title>
        <meta name="description" content="${safeDesc}">
        
        <!-- Open Graph / Facebook / WhatsApp -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="${cleanUrl}">
        <meta property="og:title" content="${safeTitle}">
        <meta property="og:description" content="${safeDesc}">
        <meta property="og:image" content="${image}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta property="og:site_name" content="Allshop Store">

        <!-- Twitter -->
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:title" content="${safeTitle}">
        <meta property="twitter:description" content="${safeDesc}">
        <meta property="twitter:image" content="${image}">

        <!-- Redirecionamento Automático para a App -->
        <script>
            window.location.href = "${storeUrl}";
        </script>
        <!-- Fallback -->
        <meta http-equiv="refresh" content="0;url=${storeUrl}">
      </head>
      <body style="font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #f8fafc; color: #334155;">
        <img src="https://i.imgur.com/nSiZKBf.png" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 20px; opacity: 0.5;">
        <p style="font-size: 18px; font-weight: 500;">A abrir ${safeTitle}...</p>
        <div style="margin-top: 15px; width: 24px; height: 24px; border: 3px solid #cbd5e1; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate'); 
    return res.status(200).send(html);

  } catch (error) {
    console.error('OG Generation Error:', error);
    return res.status(500).send('Server Error');
  }
}
