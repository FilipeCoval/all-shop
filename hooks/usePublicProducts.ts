import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { Product } from '../types';
import { INITIAL_PRODUCTS } from '../constants';

import { PRODUCT_SPECS, CATEGORY_DEFAULT_SPECS } from '../src/constants/productSpecs';

const getSpecsForProduct = (product: Product): Record<string, string | boolean> => {
    if (PRODUCT_SPECS[product.id]) {
        return PRODUCT_SPECS[product.id];
    }
    const categorySpecs = CATEGORY_DEFAULT_SPECS[product.category] || CATEGORY_DEFAULT_SPECS['Acessórios'];
    return categorySpecs;
};

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
          // Use the docId as a fallback if 'id' field is missing
          const docIdNum = parseInt(doc.id, 10);
          const productId = (data.id !== undefined && data.id !== null) ? Number(data.id) : (isNaN(docIdNum) ? null : docIdNum);
          
          if (data && productId !== null) {
             const product = { ...data, id: productId } as Product;
             // MERGE SPECS: Se o produto não tiver specs na DB, injeta as specs mockadas/hardcoded
             if (!product.specs || Object.keys(product.specs).length === 0) {
                 product.specs = getSpecsForProduct(product);
             }
             items.push(product);
          } else {
            console.warn(`[usePublicProducts] Documento '${doc.id}' foi ignorado por não ter um ID válido.`);
          }
        });

        if (items.length === 0) {
            console.log("Base de dados vazia ou sem produtos válidos, a carregar produtos iniciais como fallback...");
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

