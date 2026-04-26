import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { Product } from '../types';
import { INITIAL_PRODUCTS } from '../constants';
import { getSpecsForProduct } from '../data/productSpecs';

export const usePublicProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    // Acede à coleção pública 'products_public'
    const unsubscribe = db.collection('products_public').onSnapshot(
      (snapshot) => {
        if (!isActive) return;
        
        const items: Product[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const docId = parseInt(doc.id, 10);
          
          if (data && (typeof data.id === 'number' || !isNaN(docId))) {
             const product = { ...data, id: data.id || docId } as Product;
             // MERGE SPECS: Se o produto não tiver specs na DB, injeta as specs mockadas/hardcoded
             if (!product.specs || Object.keys(product.specs).length === 0) {
                 product.specs = getSpecsForProduct(product);
             }
             items.push(product);
          } else {
            console.warn(`[usePublicProducts] Documento '${doc.id}' foi ignorado por não ter um campo 'id' numérico válido.`);
          }
        });

        if (items.length === 0) {
            console.log("Base de dados vazia ou sem produtos válidos, a carregar produtos iniciais como fallback...");
            // MELHORIA: Usar a lista de produtos do utilizador como fallback em vez de uma lista de exemplos.
            setProducts(INITIAL_PRODUCTS);
        } else {
            // Ordena por ID decrescente (mais recentes primeiro)
            items.sort((a, b) => b.id - a.id);
            setProducts(items);
        }
        setLoading(false);
      },
      (err) => {
        console.warn("A usar produtos de fallback devido a erro:", err);
        if (isActive) {
            // MELHORIA: Usar a lista de produtos do utilizador como fallback.
            setProducts(INITIAL_PRODUCTS);
            setLoading(false);
        }
      }
    );

    return () => {
        isActive = false;
        unsubscribe();
    };
  }, []);

  return { products, loading };
};
