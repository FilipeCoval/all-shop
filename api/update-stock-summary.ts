
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
        let variantStock: Record<string, number> = {};

        inventorySnap.forEach(doc => {
            const data = doc.data();
            const qty = Math.max(0, (data.quantityBought || 0) - (data.quantitySold || 0));
            physicalStock += qty;
            
            const variant = (data.variant || '').trim();
            if (!variantStock[variant]) variantStock[variant] = 0;
            variantStock[variant] += qty;
        });

        // 2. Get Cart Reservations
        // NOTA: Removido subtrair do summary porque o cliente App.tsx já tem listener
        // de 'stock_reservations' e os subtrai em realtime no getStockForProduct().
        // Se as subtrairmos aqui, causará "double-dip" (dupla dedução) sempre que
        // houver uma sincronização.
        let reservedInCart = 0;
        let variantReserved: Record<string, number> = {};

        // 3. Get Pending Orders
        const ordersSnap = await db.collection('orders')
            .where('status', 'in', ['Pendente', 'Processamento', 'Pago', 'Enviado', 'Entregue'])
            .get();
        
        // Use logic similar to usePendingOrders
        let pendingInOrders = 0;
        let variantPending: Record<string, number> = {};
        
        const now = new Date();
        const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

        ordersSnap.forEach(doc => {
            const order = doc.data();
            const orderDate = new Date(order.date || now);
            
            const isExplicitlyPending = order.stockDeducted === false;
            const isOldButStuck = order.stockDeducted === undefined && 
                                 ['Pendente', 'Processamento', 'Pago'].includes(order.status) && 
                                 orderDate > thirtyDaysAgo;

            if (isExplicitlyPending || isOldButStuck) {
                if (order.items && Array.isArray(order.items)) {
                    order.items.forEach((item: any) => {
                        if (typeof item === 'object' && item.productId === Number(publicProductId)) {
                            const qty = item.quantity || 1;
                            pendingInOrders += qty;
                            const variant = (item.selectedVariant || '').trim();
                            if (!variantPending[variant]) variantPending[variant] = 0;
                            variantPending[variant] += qty;
                        }
                    });
                }
            }
        });

        const available = Math.max(0, physicalStock - reservedInCart - pendingInOrders);

        // 4. Update the actual products_public which frontend listens to
        const publicRef = db.collection('products_public').doc(String(publicProductId));
        const publicDoc = await publicRef.get();
        
        if (publicDoc.exists) {
            const publicData = publicDoc.data() || {};
            const updatedVariants: any[] = [];
            
            const allVariantNames = new Set<string>();
            Object.keys(variantStock).forEach(v => { if (v) allVariantNames.add(v); });
            (publicData.variants || []).forEach((v: any) => { if (v && v.name) allVariantNames.add(v.name.trim()); });

            const currentVariantsMap = new Map();
            (publicData.variants || []).forEach((v: any) => { if (v && v.name) currentVariantsMap.set(v.name.trim(), v); });

            allVariantNames.forEach(vName => {
                const physical = variantStock[vName] || 0;
                const reserved = (variantReserved[vName] || 0) + (variantPending[vName] || 0);
                const variantAvailable = Math.max(0, physical - reserved);
                
                const existing = currentVariantsMap.get(vName) || {};
                updatedVariants.push({
                    name: vName,
                    price: Number(existing.price) || 0,
                    image: existing.image || null, // Firebase não aceita undefined
                    stock: variantAvailable
                });
            });
            
            // Remove null properties
            const cleanVariants = updatedVariants.map(v => {
                const cleaned = { ...v };
                if (cleaned.image === null) delete cleaned.image;
                return cleaned;
            });

            const updateData: any = { stock: available };
            if (cleanVariants.length > 0) {
                updateData.variants = cleanVariants;
            } else if (publicData.variants) {
                updateData.variants = admin.firestore.FieldValue.delete();
            }

            await publicRef.set(updateData, { merge: true });
        } else {
             // Just update stock if document doesn't exist? Normally it should.
             await publicRef.set({ stock: available }, { merge: true });
        }

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
