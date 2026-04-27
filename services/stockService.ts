
import { db } from './firebaseConfig';
import { InventoryProduct, StockReservation, Order } from '../types';

export const calculateAvailableStock = async (
    publicProductId: number,
    inventoryProducts: InventoryProduct[]
): Promise<number> => {
    // 1. Total Físico (Batches)
    const productBatches = inventoryProducts.filter(p => p.publicProductId === publicProductId);
    const totalPhysical = productBatches.reduce((acc, p) => acc + (p.quantityBought - p.quantitySold), 0);

    // 2. Reservas de Carrinho (ativas, < 15min)
    const now = Date.now();
    const cartReservationsSnapshot = await db.collection('reservations')
        .where('productId', '==', publicProductId)
        .where('type', '==', 'CART')
        .where('expiresAt', '>', now)
        .get();
    
    const totalCartReservations = cartReservationsSnapshot.docs.reduce((acc, doc) => acc + (doc.data().quantity || 0), 0);

    // 3. Reservas de Encomendas (Pendentes)
    const ordersSnapshot = await db.collection('orders')
        .where('status', 'in', ['Pendente', 'Processamento', 'Pago'])
        .get();
    
    let totalOrderReservations = 0;
    ordersSnapshot.docs.forEach(doc => {
        const order = doc.data() as Order;
        order.items.forEach(item => {
            if (typeof item !== 'string' && item.productId === publicProductId) {
                totalOrderReservations += item.quantity;
            }
        });
    });

    return totalPhysical - totalCartReservations - totalOrderReservations;
};
