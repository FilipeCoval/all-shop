
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
  const storeUrl = `${PUBLIC_URL}/#product/${id}`;

  if (!id) {
    return res.redirect(301, PUBLIC_URL);
  }

  try {
    const productId = parseInt(id as string, 10);
    let title = 'Produto indisponível';
    let description = `Visite a ${STORE_NAME} para ver outras ofertas.`;
    let finalImage = 'https://i.imgur.com/nSiZKBf.png'; // Logotipo como fallback
    let price: number | null = null;
    let productFound = false;

    // 1. Tentar buscar no Firestore
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
                    productFound = true;
                }
            } else {
                 console.error(`[API/OG] Firestore fetch failed for ID ${id}:`, apiRes.status, await apiRes.text());
            }
        } catch (err) {
            console.error(`[API/OG] CRITICAL: Firestore request crashed for ID ${id}:`, err);
        }
    } else {
        console.error("[API/OG] CRITICAL: A variável de ambiente API_KEY não está configurada na Vercel.");
    }

    // 2. Fallback para os produtos estáticos se a API falhar ou não encontrar
    if (!productFound) {
        const staticProduct = INITIAL_PRODUCTS.find(p => p.id === productId);
        if (staticProduct) {
            title = staticProduct.name;
            description = staticProduct.description;
            finalImage = staticProduct.image;
            price = staticProduct.price;
        }
    }
    
    // Formatação "Estilo Temu"
    const formattedPrice = price ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price) : '';
    const seoTitle = price ? `${formattedPrice} 🔥 ${title}` : `${STORE_NAME} | ${title}`;
    const seoDesc = `⭐️⭐️⭐️⭐️⭐️ (4.9/5) | ${description.substring(0, 150)}...\n\n✅ Entrega Rápida em Portugal\n✅ Garantia de 3 Anos`;
    
    const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="UTF-8">
    <title>${seoTitle}</title>
    <meta name="description" content="${seoDesc}">

    <!-- Redirecionamento para humanos é feito via JS no body -->
    <!-- A remoção do 'meta refresh' garante que os bots leiam as tags abaixo -->

    <!-- Open Graph (O que o Telegram/WhatsApp/etc. lê) -->
    <meta property="og:site_name" content="${STORE_NAME}">
    <meta property="og:title" content="${seoTitle}">
    <meta property="og:description" content="${seoDesc}">
    <meta property="og:image" content="${finalImage}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:type" content="product">
    <meta property="og:url" content="${PUBLIC_URL}/p/${id}">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${seoTitle}">
    <meta name="twitter:description" content="${seoDesc}">
    <meta name="twitter:image" content="${finalImage}">

    <!-- Link canónico para SEO, aponta para a página real da SPA -->
    <link rel="canonical" href="${storeUrl}" />
</head>
<body style="font-family: sans-serif; text-align: center; margin-top: 50px; background-color: #f0f2f5;">
    <p>A redirecionar para a nossa loja...</p>
    
    <!-- Redirecionamento via JavaScript para humanos. Bots geralmente não executam isto. -->
    <script>window.location.href = "${storeUrl}";</script>

    <!-- Fallback para utilizadores com JS desativado -->
    <noscript>
        <p>Parece que o JavaScript está desativado. Por favor, clique <a href="${storeUrl}" style="color: #3b82f6; font-weight: bold;">aqui</a> para continuar.</p>
    </noscript>
</body>
</html>`;

    // Devolve o HTML com status 200 (OK)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).send(html);

  } catch (error) {
    console.error(`[API/OG] FATAL: Unhandled exception for ID ${id}:`, error);
    // Se tudo falhar, redireciona para a loja
    return res.redirect(301, storeUrl);
  }
}

