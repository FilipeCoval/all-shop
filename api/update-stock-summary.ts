
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// INICIALIZAÇÃO DO SDK ADMIN (SINGLETON)
if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_PRIVATE_KEY) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
        }
    } catch (e) {
        console.error("Erro ao inicializar Firebase Admin:", e);
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const db = admin.firestore();
        const { publicProductId } = req.body;

        if (!publicProductId) {
             return res.status(400).json({ error: 'Missing publicProductId' });
        }

        // 1. Get Inventory
        const inventorySnap = await db.collection('products_inventory')
            .where('publicProductId', '==', Number(publicProductId))
            .get();

        let physicalStock = 0;
        inventorySnap.forEach(doc => {
            const data = doc.data();
            physicalStock += (data.quantityBought || 0) - (data.quantitySold || 0);
        });

        // 2. Get Cart Reservations
        const resSnap = await db.collection('stock_reservations')
            .where('productId', '==', Number(publicProductId))
            .where('type', '==', 'CART')
            .where('expiresAt', '>', Date.now())
            .get();
        let reservedInCart = 0;
        resSnap.forEach(doc => reservedInCart += (doc.data().quantity || 0));

        // 3. Get Pending Orders
        const ordersSnap = await db.collection('orders')
            .where('status', 'in', ['Pendente', 'Processamento', 'Pago'])
            .get();
        
        // This is a naive client-side-like filtering, needs adjustment for server-side
        let pendingInOrders = 0;
        ordersSnap.forEach(doc => {
            const order = doc.data();
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach((item: any) => {
                    if (item.productId === Number(publicProductId)) {
                        pendingInOrders += (item.quantity || 1);
                    }
                });
            }
        });

        const available = Math.max(0, physicalStock - reservedInCart - pendingInOrders);

        // 4. Update the actual products_public which frontend listens to
        await db.collection('products_public').doc(String(publicProductId)).set({
            stock: available
        }, { merge: true });

        // Update Summary (Secure - optional but keeping it just in case)
        await db.collection('public_stock_summary').doc(String(publicProductId)).set({
            publicProductId: Number(publicProductId),
            availableStock: available,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.status(200).json({ success: true, available });

    } catch (error: any) {
        console.error('Erro na API de Stock:', error);
        return res.status(500).json({ error: error.message });
    }
}
