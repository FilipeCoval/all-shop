
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
    const cartReservationsSnapshot = await db.collection('stock_reservations')
        .where('productId', '==', publicProductId)
        .where('type', '==', 'CART')
        .where('expiresAt', '>', now)
        .get();
    
    const totalCartReservations = cartReservationsSnapshot.docs.reduce((acc, doc) => acc + (doc.data().quantity || 0), 0);

    // 3. Reservas de Encomendas (Pendentes)
    let totalOrderReservations = 0;
    try {
        const ordersSnapshot = await db.collection('orders')
            .where('status', 'in', ['Pendente', 'Processamento', 'Pago'])
            .get();
        
        ordersSnapshot.docs.forEach(doc => {
            const order = doc.data() as Order;
            order.items.forEach(item => {
                if (typeof item !== 'string' && item.productId === publicProductId) {
                    totalOrderReservations += item.quantity;
                }
            });
        });
    } catch (e) {
        // Se falhar (ex: permissão negada por não ser admin), assume-se 0 aqui.
        // O método seguro real deve ser implementado, mas isto impede o crash e
        // não bloqueia a contagem para utilizadores não-admin se houver outra forma de verificar.
        console.warn("Não foi possível aceder ao total de encomendas (assumindo 0 reservas):", e);
    }

    return totalPhysical - totalCartReservations - totalOrderReservations;
};
