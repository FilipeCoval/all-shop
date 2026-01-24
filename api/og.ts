import type { VercelRequest, VercelResponse } from '@vercel/node';
import { INITIAL_PRODUCTS, PUBLIC_URL } from '../constants';

// Configuração Vital
const PROJECT_ID = "allshop-store-70851";
// MELHORIA DE SEGURANÇA: Usar a variável de ambiente da Vercel
const API_KEY = process.env.API_KEY;

// Helper: Proxy de Imagem Inteligente (VERSÃO FINAL E SEGURA)
const proxyImage = (url: string) => {
    const FALLBACK_IMAGE = 'https://i.imgur.com/nSiZKBf.png';
    if (!url) return FALLBACK_IMAGE;

    // --- REGRA DE OURO #1: IMAGENS SEGURAS SÃO USADAS DIRETAMENTE ---
    // Se a imagem estiver hospedada no Firebase Storage, usamos o link direto.
    if (url.includes('firebasestorage.googleapis.com')) {
        // O ?alt=media é crucial para o link direto em vez de uma página de visualização.
        return url.includes('?') ? url : `${url}?alt=media`;
    }
    
    // Se a imagem for de um serviço conhecido e público (como Imgur), também é segura.
    if (url.includes('imgur.com')) {
        return url;
    }

    // --- REGRA DE OURO #2: NUNCA USAR PROXY PARA OG:IMAGE ---
    // Para qualquer outra imagem externa (AliExpress, kwcdn, etc.), não arriscamos
    // passar por um proxy que pode ser bloqueado. Usamos o fallback seguro.
    // A solução a longo prazo é o admin fazer upload de todas as imagens para o Firebase.
    return FALLBACK_IMAGE;
};

// Helper: Limpar campos do Firestore
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

  if (!id) {
    return res.status(400).send('ID Required');
  }

  if (!API_KEY) {
      console.error("FATAL: API_KEY environment variable is not set for OG image generator.");
      const fallbackHtml = `
        <!DOCTYPE html><html><head><title>Erro de Configuração</title></head>
        <body>Erro: A API Key do servidor não está configurada.</body></html>
      `;
      return res.status(500).send(fallbackHtml);
  }

  try {
    const productId = parseInt(id as string, 10);
    
    let title = 'Allshop Store';
    let description = 'As melhores ofertas em tecnologia.';
    let rawImage = 'https://i.imgur.com/nSiZKBf.png'; 
    let price = null;

    // Buscar via REST API do Firestore (fonte de verdade)
    try {
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products_public/${id}?key=${API_KEY}`;
        const apiRes = await fetch(firestoreUrl);
        
        if (apiRes.ok) {
            const json = await apiRes.json();
            if (json.fields) {
                title = parseFirestoreField(json.fields.name) || title;
                description = parseFirestoreField(json.fields.description) || description;
                rawImage = parseFirestoreField(json.fields.image) || rawImage;
                price = parseFirestoreField(json.fields.price) || price;
            }
        } else {
             // Fallback para a lista estática se a API falhar ou não encontrar
            const staticProduct = INITIAL_PRODUCTS.find(p => p.id === productId);
            if (staticProduct) {
                title = staticProduct.name;
                description = staticProduct.description;
                rawImage = staticProduct.image;
                price = staticProduct.price;
            }
            console.error(`Product ${id} lookup failed via REST, used static fallback.`);
        }
    } catch (err) {
        console.error("Firestore REST Error:", err);
    }
    
    // Processar Imagem (Decide entre Link Direto ou Fallback)
    const finalImage = proxyImage(rawImage);

    // Formatação Final
    const safeDesc = description ? (description.substring(0, 150) + (description.length > 150 ? '...' : '')) : '';
    const safeTitle = price ? `${title} (${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price)})` : title;
    
    // --- CORREÇÃO #2: URL CANÓNICO CORRETO ---
    const canonicalUrl = `${PUBLIC_URL}/product/${id}`; // O URL "bonito" para os bots
    const storeUrl = `${PUBLIC_URL}/#product/${id}`;    // O URL com hash para a SPA
    
    // HTML Otimizado
    const html = `
      <!DOCTYPE html>
      <html lang="pt-PT" prefix="og: http://ogp.me/ns#">
      <head>
        <meta charset="UTF-8">
        <title>${safeTitle}</title>
        <meta name="description" content="${safeDesc}">
        
        <!-- Open Graph / Facebook / WhatsApp -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="${canonicalUrl}">
        <meta property="og:title" content="${safeTitle}">
        <meta property="og:description" content="${safeDesc}">
        <meta property="og:image" content="${finalImage}">
        <meta property="og:image:secure_url" content="${finalImage}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta property="og:site_name" content="Allshop Store">

        <!-- Twitter -->
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:title" content="${safeTitle}">
        <meta property="twitter:description" content="${safeDesc}">
        <meta property="twitter:image" content="${finalImage}">

        <!-- Redirecionamento Imediato para o utilizador -->
        <meta http-equiv="refresh" content="0;url=${storeUrl}">
      </head>
      <body style="font-family: system-ui, sans-serif; text-align: center; padding-top: 50px; background-color: #f8fafc; color: #334155;">
        <h1>A redirecionar...</h1>
        <p>A abrir ${safeTitle}</p>
        <a href="${storeUrl}">Clique aqui se não for redirecionado.</a>
        <script>window.location.href = "${storeUrl}";</script>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Cache curta para permitir atualizações rápidas, mas ainda assim ter performance
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600'); 
    return res.status(200).send(html);

  } catch (error) {
    console.error('OG Generation Error:', error);
    return res.status(500).send('Server Error');
  }
}
