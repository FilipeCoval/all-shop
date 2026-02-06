
import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { InventoryProduct, StockReservation, Order, OrderItem } from '../types';

export const useStock = (isAdmin: boolean) => {
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Se o utilizador não for admin, não tenta aceder a dados privados.
    if (!isAdmin) {
      setLoading(false);
      return () => {}; // Retorna uma função de limpeza vazia
    }

    setLoading(true);

    // 1. Escutar Inventário Físico (Apenas Admin)
    const unsubInv = db.collection('products_inventory').onSnapshot(
      (snapshot) => {
        const items: InventoryProduct[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as InventoryProduct);
        });
        setInventory(items);
      },
      (error) => {
        console.error("Erro no listener de inventário (Admin):", error);
      }
    );

    // 2. Escutar Reservas Temporárias em Carrinhos (Apenas Admin)
    const unsubRes = db.collection('stock_reservations')
      .where('expiresAt', '>', Date.now())
      .onSnapshot((snapshot) => {
        const resList: StockReservation[] = [];
        snapshot.forEach(doc => {
            resList.push({ id: doc.id, ...doc.data() } as StockReservation);
        });
        setReservations(resList);
      });

    // 3. Escutar Encomendas Pendentes (Apenas Admin)
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
  }, [isAdmin]); // O efeito depende do estado de admin

  const getStockForProduct = (publicId: number, variantName?: string): number => {
    // Se não for admin, não faz cálculo. A lógica principal está no App.tsx.
    if (!isAdmin) return 0; 
    
    // Para admin, continua a usar a lógica de tempo real
    if (loading) return 999; // Retorna 999 durante o carregamento para evitar bloquear vendas no admin

    const allBatchesForProduct = inventory.filter(p => p.publicProductId === publicId);
    if (allBatchesForProduct.length === 0) return 0;
    
    const hasOnlyGenericStockBatch = allBatchesForProduct.length === 1 && (!allBatchesForProduct[0].variant || allBatchesForProduct[0].variant.trim() === '');

    // A. Stock Físico
    const physicalStock = allBatchesForProduct
      .filter(p => {
          if (!variantName) return true;
          const itemVariant = (p.variant || '').trim().toLowerCase();
          const requestedVariant = variantName.trim().toLowerCase();
          return itemVariant === requestedVariant || (hasOnlyGenericStockBatch && itemVariant === '');
      })
      .reduce((acc, batch) => acc + Math.max(0, (batch.quantityBought || 0) - (batch.quantitySold || 0)), 0);

    // B. Subtrair Reservas Temporárias (Carrinhos)
    const totalReservedInCarts = reservations
        .filter(r => r.productId === publicId)
        .filter(r => {
            if (!variantName) return true;
            const itemVariant = (r.variantName || '').trim().toLowerCase();
            const requestedVariant = variantName.trim().toLowerCase();
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
                    if (!variantName) {
                        totalPendingInOrders += (orderItem.quantity || 1);
                    } else {
                        const itemVariant = (orderItem.selectedVariant || '').trim().toLowerCase();
                        const requestedVariant = variantName.trim().toLowerCase();
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
