import { useState, useEffect } from 'react';
import { Product } from '../types';
import { PRODUCTS as FALLBACK_PRODUCTS } from '../constants';

export const usePublicProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // FOCO NA ESTABILIDADE: Removemos a ligação à base de dados temporariamente
    // para garantir que a lista de produtos base (do ficheiro constants.ts)
    // é sempre carregada, eliminando qualquer instabilidade.
    setProducts(FALLBACK_PRODUCTS);
    setLoading(false);
  }, []);

  return { products, loading };
};
