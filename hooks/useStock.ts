
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
  // Se 'variantName' for fornecido, filtra apenas os lotes dessa variante.
  // Se não for, soma TUDO (útil para listagens gerais).
  const getStockForProduct = (publicId: number, variantName?: string): number => {
    if (loading) return 999; // Assume stock infinito enquanto carrega para não bloquear UI

    const relevantBatches = inventory.filter(p => {
        const isSameProduct = p.publicProductId === publicId;
        if (!isSameProduct) return false;

        // Se o frontend pede uma variante específica (ex: "33W")
        if (variantName) {
            // Normaliza as strings (trim e lowercase) para evitar erros com espaços invisíveis ou letras maiusculas
            const inventoryVariant = (p.variant || '').trim().toLowerCase();
            const requestedVariant = variantName.trim().toLowerCase();
            
            // Só retorna lotes que ou têm essa variante exata
            return inventoryVariant === requestedVariant;
        }

        // Se não pede variante, retorna tudo deste produto
        return true;
    });
    
    // Se não houver registos no inventário ligados a este produto, assumimos que há stock (modo não gerido)
    if (relevantBatches.length === 0) return 999; 

    const totalStock = relevantBatches.reduce((acc, batch) => {
      const remaining = batch.quantityBought - batch.quantitySold;
      return acc + Math.max(0, remaining);
    }, 0);

    return totalStock;
  };

  return { getStockForProduct, loading };
};
