
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

    // 3. Escutar Encomendas Pendentes (que ainda não deram baixa no inventário físico)
    // Consideramos apenas encomendas que VOCÊ ainda não deu como "Enviado" ou "Vendido"
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

    // A. Stock Físico Real (O que está nas prateleiras segundo o Inventário)
    const allBatchesForProduct = inventory.filter(p => p.publicProductId === publicId);
    if (allBatchesForProduct.length === 0) return 0;

    const relevantBatches = variantName
        ? allBatchesForProduct.filter(p => (p.variant || '').trim().toLowerCase() === variantName.trim().toLowerCase())
        : allBatchesForProduct;

    const physicalStock = relevantBatches.reduce((acc, batch) => {
      const remaining = (batch.quantityBought || 0) - (batch.quantitySold || 0);
      return acc + Math.max(0, remaining);
    }, 0);

    // B. Subtrair Reservas Temporárias de utilizadores com itens no carrinho
    const activeRes = reservations.filter(r => 
        r.productId === publicId && 
        (variantName ? (r.variantName || '').trim().toLowerCase() === variantName.trim().toLowerCase() : true)
    );
    const totalReservedInCarts = activeRes.reduce((acc, r) => acc + (r.quantity || 0), 0);

    // C. Subtrair Itens de Encomendas efetuadas mas ainda não processadas manualmente
    let totalPendingInOrders = 0;
    pendingOrders.forEach(order => {
        const items = Array.isArray(order.items) ? order.items : [];
        items.forEach(item => {
            if (typeof item === 'object' && item !== null) {
                const orderItem = item as OrderItem;
                const idMatch = orderItem.productId === publicId;
                const variantMatch = variantName 
                    ? (orderItem.selectedVariant || '').trim().toLowerCase() === variantName.trim().toLowerCase()
                    : !orderItem.selectedVariant;
                
                if (idMatch && variantMatch) {
                    totalPendingInOrders += (orderItem.quantity || 1);
                }
            }
        });
    });

    // Stock Disponível = Físico - Carrinhos - Encomendas Pendentes
    return Math.max(0, physicalStock - totalReservedInCarts - totalPendingInOrders);
  };

  return { getStockForProduct, loading };
};
