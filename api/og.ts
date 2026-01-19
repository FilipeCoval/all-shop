import type { VercelRequest, VercelResponse } from '@vercel/node';
import { INITIAL_PRODUCTS } from '../constants';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id, title: qTitle, image: qImage, desc: qDesc, price: qPrice } = req.query;
  const host = req.headers.host;

  if (!id) {
    return res.status(400).send('ID Required');
  }

  try {
    const productId = parseInt(id as string, 10);
    
    // 1. Tentar obter dados dos Parâmetros do URL (Método Dinâmico para novos produtos)
    // Isto resolve o problema da "Imagem Roxa" para produtos criados no Backoffice
    let title = qTitle ? (Array.isArray(qTitle) ? qTitle[0] : qTitle) : null;
    let image = qImage ? (Array.isArray(qImage) ? qImage[0] : qImage) : null;
    let description = qDesc ? (Array.isArray(qDesc) ? qDesc[0] : qDesc) : null;
    const price = qPrice ? (Array.isArray(qPrice) ? qPrice[0] : qPrice) : null;

    // 2. Se não houver params, tentar o catálogo estático (Fallback para produtos iniciais)
    if (!title || !image) {
        const staticProduct = INITIAL_PRODUCTS.find(p => p.id === productId);
        if (staticProduct) {
            title = staticProduct.name;
            description = staticProduct.description;
            image = staticProduct.image;
        }
    }

    // 3. Fallbacks finais (Genérico)
    title = title ? `${title} | Allshop Store` : 'Produto Allshop';
    description = description ? description.substring(0, 150) + (description.length > 150 ? '...' : '') : 'Veja este produto incrível na nossa loja.';
    
    // Adicionar preço ao título se disponível
    if (price) {
        title = `${title} (${price}€)`;
    }

    // Se a imagem falhar, usa a genérica
    const finalImage = image || 'https://i.imgur.com/nSiZKBf.png';
    
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    
    // O URL "clean" para o OpenGraph (o que aparece no cartão)
    const cleanUrl = `${protocol}://${host}/product/${id}`;
    
    // O URL de destino real para o utilizador (Redireciona para a App)
    const storeUrl = `${protocol}://${host}/#product/${id}`;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-PT">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <meta name="description" content="${description}">
        
        <!-- Open Graph / Facebook / WhatsApp -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="${cleanUrl}">
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="${description}">
        <meta property="og:image" content="${finalImage}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta property="og:site_name" content="Allshop Store">

        <!-- Twitter -->
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:title" content="${title}">
        <meta property="twitter:description" content="${description}">
        <meta property="twitter:image" content="${finalImage}">

        <!-- Redirecionamento Automático para a App (SPA) -->
        <script>
            window.location.href = "${storeUrl}";
        </script>
        <!-- Fallback meta refresh se JS estiver desativado -->
        <meta http-equiv="refresh" content="0;url=${storeUrl}">
      </head>
      <body style="font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #f8fafc; color: #334155;">
        <img src="https://i.imgur.com/nSiZKBf.png" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 20px; opacity: 0.5;">
        <p style="font-size: 18px; font-weight: 500;">A abrir ${title}...</p>
        <div style="margin-top: 15px; width: 24px; height: 24px; border: 3px solid #cbd5e1; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Cache curto para garantir que atualizações de imagem se propagam rápido
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate'); 
    return res.status(200).send(html);

  } catch (error) {
    console.error('OG Generation Error:', error);
    return res.status(500).send('Server Error');
  }
}
