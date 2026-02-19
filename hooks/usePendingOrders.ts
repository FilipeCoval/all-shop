
import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { Order } from '../types';

export const usePendingOrders = () => {
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escutar encomendas que ainda não foram enviadas (e portanto ainda não foram descontadas no inventário físico como 'SOLD')
    const unsubscribe = db.collection('orders')
      .where('status', 'in', ['Processamento', 'Pago'])
      .onSnapshot((snapshot) => {
        const orders: Order[] = [];
        snapshot.forEach(doc => {
          orders.push({ id: doc.id, ...doc.data() } as Order);
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
