import type { VercelRequest, VercelResponse } from '@vercel/node';
import { INITIAL_PRODUCTS } from '../constants';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const host = req.headers.host;

  if (!id) {
    return res.status(400).send('ID Required');
  }

  try {
    const productId = parseInt(id as string, 10);
    // Usa os produtos iniciais como base para os previews sociais.
    // Para ser 100% dinâmico aqui, seria necessário o firebase-admin SDK com service accounts,
    // o que é mais complexo. Esta solução "estática" serve para os links mais importantes.
    const product = INITIAL_PRODUCTS.find(p => p.id === productId);
    
    // Se não encontrar no estático, usa uma imagem genérica
    const title = product ? `${product.name} | Allshop Store` : 'Produto Allshop';
    const description = product ? `${product.description.substring(0, 150)}...` : 'Veja este produto incrível na nossa loja.';
    const image = product?.image || 'https://i.imgur.com/nSiZKBf.png';
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const cleanUrl = `${protocol}://${host}/product/${id}`;
    const storeUrl = `${protocol}://${host}/#product/${id}`;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-PT">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <meta name="description" content="${description}">
        
        <!-- Open Graph -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="${cleanUrl}">
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="${description}">
        <meta property="og:image" content="${image}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">

        <!-- Twitter -->
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:title" content="${title}">
        <meta property="twitter:description" content="${description}">
        <meta property="twitter:image" content="${image}">

        <!-- Se um humano entrar aqui, mandamos para a App -->
        <meta http-equiv="refresh" content="0;url=${storeUrl}">
      </head>
      <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh;">
        <p>A redirecionar para Allshop Store...</p>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); 
    return res.status(200).send(html);

  } catch (error) {
    console.error('OG Generation Error:', error);
    return res.status(500).send('Server Error');
  }
}
