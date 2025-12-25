
import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { InventoryProduct } from '../types';

export const useStock = () => {
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPermissionError, setHasPermissionError] = useState(false);

  useEffect(() => {
    const unsubscribe = db.collection('products_inventory').onSnapshot(
      (snapshot) => {
        const items: InventoryProduct[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as InventoryProduct);
        });
        setInventory(items);
        setLoading(false);
        setHasPermissionError(false);
      },
      (error) => {
        // Log discreto para não alarmar o utilizador final
        console.debug("Stock sync restricted. Mode: Infinite Stock.");
        setLoading(false);
        setHasPermissionError(true);
      }
    );

    return () => unsubscribe();
  }, []);

  const getStockForProduct = (publicId: number, variantName?: string): number => {
    // FALLBACK: Se permissões negadas ou erro de rede, devolve 999 (Stock não gerido)
    if (hasPermissionError) return 999;
    if (loading) return 999;

    const relevantBatches = inventory.filter(p => {
        const isSameProduct = p.publicProductId === publicId;
        if (!isSameProduct) return false;

        if (variantName) {
            const inventoryVariant = (p.variant || '').trim().toLowerCase();
            const requestedVariant = variantName.trim().toLowerCase();
            return inventoryVariant === requestedVariant;
        }
        return true;
    });
    
    if (relevantBatches.length === 0) return 999; 

    const totalStock = relevantBatches.reduce((acc, batch) => {
      const remaining = batch.quantityBought - batch.quantitySold;
      return acc + Math.max(0, remaining);
    }, 0);

    return totalStock;
  };

  return { getStockForProduct, loading };
};
