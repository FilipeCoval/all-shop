
import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { StockReservation } from '../types';

export const useStockReservations = () => {
  const [reservations, setReservations] = useState<StockReservation[]>([]);

  useEffect(() => {
    // Escuta apenas reservas que ainda não expiraram.
    const unsub = db.collection('stock_reservations')
      .where('expiresAt', '>', Date.now())
      .onSnapshot((snapshot) => {
        const resList: StockReservation[] = [];
        snapshot.forEach(doc => {
            resList.push({ id: doc.id, ...doc.data() } as StockReservation);
        });
        setReservations(resList);
      }, (error) => {
        console.warn("Não foi possível aceder às reservas de stock (pode ser normal para convidados com regras restritas, mas o checkout pode falhar):", error.message);
      });
    
    return () => unsub();
  }, []);

  return { reservations };
}
