import type { VercelRequest, VercelResponse } from '@vercel/node';
import { INITIAL_PRODUCTS } from '../constants';
// Importação segura para ambiente Node.js na Vercel
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// Configuração do Firebase In-Line para evitar dependências de ambiente complexas no Edge
const firebaseConfig = {
  apiKey: "AIzaSyCayoyBpHeO60v7VHUagX_qAHZ7xIyitpE",
  authDomain: "allshop-store-70851.firebaseapp.com",
  projectId: "allshop-store-70851",
  storageBucket: "allshop-store-70851.firebasestorage.app",
  messagingSenderId: "1066114053908",
  appId: "1:1066114053908:web:34f8ae5e231a5c73f0f401"
};

// Inicialização segura do Firebase (Singleton)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app(); // Se já existe, usa a existente
}

const db = firebase.firestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const host = req.headers.host;

  if (!id) {
    return res.status(400).send('ID Required');
  }

  try {
    const productId = parseInt(id as string, 10);
    
    // --- 1. Procura na Lista Estática (Ultra Rápido) ---
    // Isto cobre os produtos iniciais sem gastar leituras da BD
    let productData = INITIAL_PRODUCTS.find(p => p.id === productId);
    
    let title = productData ? productData.name : 'Produto Allshop';
    let description = productData ? productData.description : 'Descubra este produto na nossa loja.';
    let image = productData ? productData.image : 'https://i.imgur.com/nSiZKBf.png';
    let price = productData ? productData.price : null;

    // --- 2. Procura na Base de Dados (Para Produtos Novos) ---
    // Se não encontrou na estática, vai ao Firestore buscar os dados reais
    if (!productData) {
        try {
            // Tenta encontrar pelo campo 'id' (número) na coleção pública
            // Nota: Os IDs públicos são strings na chave do documento, mas vamos tentar ler
            const docRef = db.collection('products_public').doc(id as string);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                const data = docSnap.data();
                if (data) {
                    title = data.name;
                    description = data.description || description;
                    image = data.image || image;
                    price = data.price;
                }
            } else {
                // Fallback: Tenta pesquisar se o ID for numérico mas o doc for diferente
                // (Caso raro de inconsistência de IDs)
                console.log(`Produto ${id} não encontrado diretamente, a tentar query...`);
            }
        } catch (dbError) {
            console.error("Erro ao ler da BD no Serverless:", dbError);
            // Em caso de erro, mantém os valores genéricos (imagem roxa)
            // mas o link funciona na mesma.
        }
    }

    // --- 3. Formatação Final ---
    // Corta descrições gigantes
    const safeDesc = description.substring(0, 150) + (description.length > 150 ? '...' : '');
    const safeTitle = price ? `${title} (${price}€)` : title;
    
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const cleanUrl = `${protocol}://${host}/product/${id}`;
    const storeUrl = `${protocol}://${host}/#product/${id}`;

    // --- 4. Geração do HTML ---
    // Este HTML é o que o WhatsApp/Facebook lêem.
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

        <!-- Redirecionamento Automático para a App (SPA) -->
        <script>
            window.location.href = "${storeUrl}";
        </script>
        <!-- Fallback meta refresh se JS estiver desativado -->
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
    // Cache de 1 hora no CDN para ser rápido na próxima vez
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); 
    return res.status(200).send(html);

  } catch (error) {
    console.error('OG Generation Error:', error);
    return res.status(500).send('Server Error');
  }
}
