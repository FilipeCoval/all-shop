import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { Product } from '../types';
import { PRODUCTS as FALLBACK_PRODUCTS } from '../constants';

export const usePublicProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    // Tenta obter os produtos da base de dados em tempo real.
    const unsubscribe = db.collection('products_public').onSnapshot(
      (snapshot) => {
        if (!isActive) return;
        
        const items: Product[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          items.push({ 
            ...data,
            // O ID no Firestore é uma string, mas a nossa app usa número.
            id: parseInt(doc.id, 10),
          } as Product);
        });

        // Se a base de dados estiver vazia (ex: primeira utilização) ou a
        // leitura falhar, usamos a lista de produtos estática como um fallback seguro.
        if (items.length === 0) {
            console.warn("A base de dados pública está vazia ou inacessível. A carregar produtos de fallback.");
            setProducts(FALLBACK_PRODUCTS);
        } else {
            // Ordena por ID decrescente para mostrar os mais recentes primeiro
            items.sort((a, b) => b.id - a.id);
            setProducts(items);
        }
        setLoading(false);
      },
      (err) => {
        // Em caso de erro (ex: permissões, offline), carregamos os produtos de fallback.
        console.error("Erro ao obter produtos públicos, a usar fallback:", err);
        if (isActive) {
            setProducts(FALLBACK_PRODUCTS);
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
