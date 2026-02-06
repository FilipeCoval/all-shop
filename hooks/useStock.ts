
import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { InventoryProduct, StockReservation, Order, OrderItem } from '../types';

export const useStock = () => {
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPermissionError, setHasPermissionError] = useState(false);

  useEffect(() => {
    // 1. Escutar Inventário Físico
    const unsubInv = db.collection('products_inventory').onSnapshot(
      (snapshot) => {
        const items: InventoryProduct[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as InventoryProduct);
        });
        setInventory(items);
        setHasPermissionError(false);
      },
      (error) => {
        if (error.code === 'permission-denied') setHasPermissionError(true);
      }
    );

    // 2. Escutar Reservas Temporárias em Carrinhos
    const unsubRes = db.collection('stock_reservations')
      .where('expiresAt', '>', Date.now())
      .onSnapshot((snapshot) => {
        const resList: StockReservation[] = [];
        snapshot.forEach(doc => {
            resList.push({ id: doc.id, ...doc.data() } as StockReservation);
        });
        setReservations(resList);
      });

    // 3. Escutar Encomendas que ainda não foram abatidas manualmente no inventário
    const unsubOrders = db.collection('orders')
      .where('status', 'in', ['Processamento', 'Pago'])
      .onSnapshot((snapshot) => {
          const ordersList: Order[] = [];
          snapshot.forEach(doc => {
              ordersList.push({ id: doc.id, ...doc.data() } as Order);
          });
          setPendingOrders(ordersList);
          setLoading(false);
      });

    return () => {
        unsubInv();
        unsubRes();
        unsubOrders();
    };
  }, []);

  const getStockForProduct = (publicId: number, variantName?: string): number => {
    if (hasPermissionError || loading) return 999;

    const allBatchesForProduct = inventory.filter(p => p.publicProductId === publicId);
    if (allBatchesForProduct.length === 0) return 0;
    
    // EDGE CASE FIX: Detecta se existe apenas um lote de stock e se esse lote não tem variante definida.
    // Isto acontece quando o stock é adicionado para um produto com variantes, mas sem especificar qual.
    const hasOnlyGenericStockBatch = allBatchesForProduct.length === 1 && (!allBatchesForProduct[0].variant || allBatchesForProduct[0].variant.trim() === '');

    // A. Stock Físico
    const physicalStock = allBatchesForProduct
      .filter(p => {
          if (!variantName) return true; // Para stock total, incluir todos os lotes
          const itemVariant = (p.variant || '').trim().toLowerCase();
          const requestedVariant = variantName.trim().toLowerCase();
          // Corresponde se a variante for igual, OU se houver apenas um lote genérico
          return itemVariant === requestedVariant || (hasOnlyGenericStockBatch && itemVariant === '');
      })
      .reduce((acc, batch) => acc + Math.max(0, (batch.quantityBought || 0) - (batch.quantitySold || 0)), 0);

    // B. Subtrair Reservas Temporárias (Carrinhos)
    const totalReservedInCarts = reservations
        .filter(r => r.productId === publicId)
        .filter(r => {
            if (!variantName) return true; // Para stock total, subtrair todas as reservas
            const itemVariant = (r.variantName || '').trim().toLowerCase();
            const requestedVariant = variantName.trim().toLowerCase();
            // Subtrai se a variante for igual, OU se a reserva for genérica e o stock também for
            return itemVariant === requestedVariant || (hasOnlyGenericStockBatch && itemVariant === '');
        })
        .reduce((acc, r) => acc + (r.quantity || 0), 0);

    // C. Subtrair Itens de Encomendas efetuadas mas pendentes de envio
    let totalPendingInOrders = 0;
    pendingOrders.forEach(order => {
        const items = Array.isArray(order.items) ? order.items : [];
        items.forEach(item => {
            if (typeof item === 'object' && item !== null) {
                const orderItem = item as OrderItem;
                if (orderItem.productId === publicId) {
                    if (!variantName) { // Para stock total, subtrair todas as variantes
                        totalPendingInOrders += (orderItem.quantity || 1);
                    } else { // Para stock específico
                        const itemVariant = (orderItem.selectedVariant || '').trim().toLowerCase();
                        const requestedVariant = variantName.trim().toLowerCase();
                         // Subtrai se a variante for igual, OU se o item da encomenda for genérico e o stock também for
                        if (itemVariant === requestedVariant || (hasOnlyGenericStockBatch && itemVariant === '')) {
                            totalPendingInOrders += (orderItem.quantity || 1);
                        }
                    }
                }
            }
        });
    });

    return Math.max(0, physicalStock - totalReservedInCarts - totalPendingInOrders);
  };

  return { getStockForProduct, loading };
};
