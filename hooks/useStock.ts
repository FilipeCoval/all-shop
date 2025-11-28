
import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { InventoryProduct } from '../types';

export const useStock = () => {
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscrever à coleção 'products_inventory' para ter dados sempre frescos
    const unsubscribe = db.collection('products_inventory').onSnapshot(
      (snapshot) => {
        const items: InventoryProduct[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as InventoryProduct);
        });
        setInventory(items);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao ler stock:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Função que calcula o stock real de um produto público
  // Soma todas as compras e subtrai todas as vendas de todos os lotes ligados a esse ID
  const getStockForProduct = (publicId: number): number => {
    if (loading) return 999; // Assume stock infinito enquanto carrega para não bloquear UI

    const relevantBatches = inventory.filter(p => p.publicProductId === publicId);
    
    // Se não houver registos no inventário ligados a este produto, assumimos que há stock (modo não gerido)
    // Para forçar "Esgotado" se não houver registo, mude para return 0;
    // Aqui retornamos 999 para produtos que ainda não adicionou ao Dashboard não ficarem indisponíveis.
    if (relevantBatches.length === 0) return 999; 

    const totalStock = relevantBatches.reduce((acc, batch) => {
      const remaining = batch.quantityBought - batch.quantitySold;
      return acc + Math.max(0, remaining);
    }, 0);

    return totalStock;
  };

  return { getStockForProduct, loading };
};
