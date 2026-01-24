import type { VercelRequest, VercelResponse } from '@vercel/node';
import { INITIAL_PRODUCTS } from '../constants';

// Configuração Vital
const PROJECT_ID = "allshop-store-70851";
// MELHORIA DE SEGURANÇA: Usar a variável de ambiente da Vercel
const API_KEY = process.env.API_KEY;

// Helper: Proxy de Imagem Inteligente
const proxyImage = (url: string) => {
    if (!url) return 'https://i.imgur.com/nSiZKBf.png';
    
    // --- REGRA DE OURO ---
    // Se a imagem estiver hospedada no Firebase Storage (sua), usamos DIRETAMENTE.
    // Isto evita o "proxy" e garante que o WhatsApp recebe a imagem original sem bloqueios.
    if (url.includes('firebasestorage.googleapis.com')) {
        // Apenas adicionamos parâmetros de otimização se não os tiver já
        if (url.includes('?')) return url;
        return `${url}?alt=media`; // O ?alt=media é crucial para o link direto
    }
    
    // Se a imagem já estiver a passar pelo proxy, não mexemos
    if (url.includes('wsrv.nl')) return url;
    
    // Para imagens externas (AliExpress, etc), continuamos a usar o proxy como "curativo"
    // Mas a solução definitiva é o Admin fazer upload da imagem no Dashboard.
    let cleanUrl = url;
    if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
    
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&w=1200&h=630&fit=cover&output=jpg&n=-1`;
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
  const host = req.headers.host;

  if (!id) {
    return res.status(400).send('ID Required');
  }

  // Verificação de segurança
  if (!API_KEY) {
      console.error("FATAL: API_KEY environment variable is not set for OG image generator.");
      // Devolve uma imagem de fallback se a chave não estiver configurada
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

    // 1. Tentar encontrar na lista estática
    const staticProduct = INITIAL_PRODUCTS.find(p => p.id === productId);
    
    if (staticProduct) {
        title = staticProduct.name;
        description = staticProduct.description;
        rawImage = staticProduct.image;
        price = staticProduct.price;
    } else {
        // 2. Buscar via REST API do Firestore
        try {
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products_public/${id}?key=${API_KEY}`;
            const apiRes = await fetch(firestoreUrl);
            
            if (apiRes.ok) {
                const json = await apiRes.json();
                if (json.fields) {
                    title = parseFirestoreField(json.fields.name) || title;
                    description = parseFirestoreField(json.fields.description) || description;
                    rawImage = parseFirestoreField(json.fields.image) || rawImage;
                    price = parseFirestoreField(json.fields.price);
                }
            } else {
                console.error(`Product ${id} lookup failed via REST`);
            }
        } catch (err) {
            console.error("Firestore REST Error:", err);
        }
    }

    // 3. Processar Imagem (Decide entre Firebase Directo ou Proxy)
    const finalImage = proxyImage(rawImage);

    // 4. Formatação Final
    const safeDesc = description ? (description.substring(0, 150) + (description.length > 150 ? '...' : '')) : '';
    const safeTitle = price ? `${title} (${price}€)` : title;
    
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const cleanUrl = `${protocol}://${host}/product/${id}`;
    const storeUrl = `${protocol}://${host}/#product/${id}`;

    // 5. HTML Otimizado
    const html = `
      <!DOCTYPE html>
      <html lang="pt-PT" prefix="og: http://ogp.me/ns#">
      <head>
        <meta charset="UTF-8">
        <title>${safeTitle}</title>
        <meta name="description" content="${safeDesc}">
        
        <!-- Open Graph / Facebook / WhatsApp -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="${cleanUrl}">
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

        <!-- Delay para garantir leitura dos bots -->
        <meta http-equiv="refresh" content="2;url=${storeUrl}">
      </head>
      <body style="font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #f8fafc; color: #334155;">
        <img src="https://i.imgur.com/nSiZKBf.png" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 20px; opacity: 0.5;">
        <p style="font-size: 18px; font-weight: 500;">A abrir ${safeTitle}...</p>
        <div style="margin-top: 15px; width: 24px; height: 24px; border: 3px solid #cbd5e1; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">Redirecionando...</p>
        
        <script>
            setTimeout(function() {
                window.location.href = "${storeUrl}";
            }, 1500);
        </script>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate'); 
    return res.status(200).send(html);

  } catch (error) {
    console.error('OG Generation Error:', error);
    return res.status(500).send('Server Error');
  }
}
