import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { InventoryProduct } from '../types';

export const useStock = () => {
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPermissionError, setHasPermissionError] = useState(false);

  useEffect(() => {
    // Escutamos o inventário. Se as regras do Firestore permitirem leitura pública, 
    // teremos stock real no site. Caso contrário, usamos o modo fallback.
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
        // Silenciamos erro para utilizadores não-admin para evitar ruído no site público
        if (error.code === 'permission-denied') {
            setHasPermissionError(true);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const getStockForProduct = (publicId: number, variantName?: string): number => {
    // Se não temos permissão de leitura pública, assumimos stock ilimitado (999) 
    // para não bloquear as vendas do site.
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
    
    // Se o produto não consta no inventário mas está no catálogo fixo, devolvemos 999
    if (relevantBatches.length === 0) return 999; 

    const totalStock = relevantBatches.reduce((acc, batch) => {
      const remaining = batch.quantityBought - batch.quantitySold;
      return acc + Math.max(0, remaining);
    }, 0);

    return totalStock;
  };

  return { getStockForProduct, loading };
};
