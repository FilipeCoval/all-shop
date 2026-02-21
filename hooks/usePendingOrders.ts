
import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { Order } from '../types';

export const usePendingOrders = (isAdmin: boolean) => {
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      setPendingOrders([]);
      setLoading(false);
      return;
    }

    // Escutar encomendas que ainda não foram enviadas ou processadas no inventário físico
    // Incluímos 'Enviado' e 'Entregue' porque se o admin ainda não "Registou a Venda" no inventário, 
    // o stock físico ainda está lá e precisa de ser subtraído para o público.
    const unsubscribe = db.collection('orders')
      .where('status', 'in', ['Processamento', 'Pago', 'Enviado', 'Entregue'])
      .onSnapshot((snapshot) => {
        const orders: Order[] = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Order;
          const orderDate = new Date(data.date);
          const now = new Date();
          const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

          const isExplicitlyPending = data.stockDeducted === false;
          const isOldButStuck = data.stockDeducted === undefined && 
                               ['Processamento', 'Pago'].includes(data.status) && 
                               orderDate > thirtyDaysAgo;
          
          if (isExplicitlyPending || isOldButStuck) {
            orders.push({ ...data, id: doc.id } as Order);
          }
        });
        setPendingOrders(orders);
        setLoading(false);
      }, (error) => {
        console.error("Erro ao escutar encomendas pendentes:", error);
        setLoading(false);
      });

    return () => unsubscribe();
  }, []);

  return { pendingOrders, loading };
};
