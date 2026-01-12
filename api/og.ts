import { VercelRequest, VercelResponse } from '@vercel/node';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCayoyBpHeO60v7VHUagX_qAHZ7xIyitpE",
  authDomain: "allshop-store-70851.firebaseapp.com",
  projectId: "allshop-store-70851",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id) return res.status(400).send('ID Required');

  try {
    const productDoc = await db.collection('products_public').doc(id as string).get();
    
    if (!productDoc.exists) {
      return res.status(404).send('Product Not Found');
    }

    const product = productDoc.data();
    const title = `${product?.name} | Allshop Store`;
    const description = `${product?.description?.substring(0, 150)}...`;
    const image = product?.image || 'https://i.imgur.com/nSiZKBf.png';
    const cleanUrl = `https://allshop-store.vercel.app/product/${id}`;
    const storeUrl = `https://allshop-store.vercel.app/#product/${id}`;

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
    return res.status(500).send('Error');
  }
}
