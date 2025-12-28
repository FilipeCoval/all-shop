import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { InventoryProduct } from '../types';
import { PRODUCTS } from '../constants';

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

    // Primeiro, encontra todos os lotes de inventário que correspondem ao ID do produto público.
    const allBatchesForProduct = inventory.filter(p => p.publicProductId === publicId);

    // Se o produto não estiver de todo a ser rastreado no inventário, está esgotado.
    if (allBatchesForProduct.length === 0) {
        return 0;
    }

    // Se uma variante específica for solicitada, filtramos esses lotes.
    // Caso contrário, usamos todos os lotes encontrados (somando o stock de todas as variantes).
    const relevantBatches = variantName
        ? allBatchesForProduct.filter(p => 
            (p.variant || '').trim().toLowerCase() === variantName.trim().toLowerCase()
          )
        : allBatchesForProduct;

    // Calcula o stock total restante dos lotes relevantes.
    const totalStock = relevantBatches.reduce((acc, batch) => {
      const remaining = batch.quantityBought - batch.quantitySold;
      return acc + Math.max(0, remaining);
    }, 0);

    return totalStock;
  };

  return { getStockForProduct, loading };
};
