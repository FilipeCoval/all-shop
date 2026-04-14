
import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { InventoryProduct, Product, ProductVariant } from '../types';

export const useInventory = (isAdmin: boolean = false) => {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const unsubscribe = db.collection('products_inventory').onSnapshot(
      (snapshot) => {
        const items: InventoryProduct[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as InventoryProduct);
        });
        setProducts(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn("Firestore Access Restricted:", err.message);
        if (err.code === 'permission-denied') {
            setError('permission-denied');
        } else {
            setError(err.message);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  // --- FUNÇÃO DE SINCRONIZAÇÃO AUTOMÁTICA ---
  // Esta função garante que o stock público é sempre a soma de todos os lotes
  const refreshPublicProductStock = async (publicIdRaw: number | string) => {
      try {
          const publicId = Number(publicIdRaw);
          if (isNaN(publicId)) return;

          const idStr = publicId.toString();
          
          // 0. Buscar dados atuais do produto público para preservar variantes e imagens manuais
          const publicDoc = await db.collection('products_public').doc(idStr).get();
          const publicData = publicDoc.exists ? publicDoc.data() as Product : null;

          // 1. Buscar todos os lotes deste produto
          const snapshot = await db.collection('products_inventory')
              .where('publicProductId', '==', publicId)
              .get();

          if (snapshot.empty) {
              // Se não houver lotes, coloca stock a 0 mas não apaga o produto (para manter SEO/Histórico)
              // Preservamos as variantes existentes mas com stock 0
              await db.collection('products_public').doc(idStr).set({ stock: 0 }, { merge: true }).catch(() => {});
              return;
          }

          let totalStock = 0;
          const variantsMap = new Map<string, ProductVariant>();

          // Inicializar o mapa com as variantes que já existem no produto público
          if (publicData?.variants) {
              publicData.variants.forEach(v => {
                  variantsMap.set(v.name, { ...v });
              });
          }

          snapshot.forEach(doc => {
              const item = doc.data() as InventoryProduct;
              // Cálculo de stock deste lote
              const itemStock = Math.max(0, (item.quantityBought || 0) - (item.quantitySold || 0));
              totalStock += itemStock;

              // Reconstruir variantes baseadas nos lotes existentes
              if (item.variant) {
                  // Se a variante já existe, mantemos a imagem existente se a nova não tiver
                  const existing = variantsMap.get(item.variant);
                  
                  variantsMap.set(item.variant, {
                      name: item.variant,
                      price: item.salePrice || item.targetSalePrice || (existing?.price || 0),
                      // Prioridade: 
                      // 1. Imagem já definida na variante do produto público (se existir)
                      // 2. Primeira imagem do lote de inventário
                      // 3. Imagem que já estava no mapa nesta iteração
                      image: (existing?.image) ? existing.image : ((item.images && item.images[0]) ? item.images[0] : undefined)
                  });
              }
          });

          const variants = Array.from(variantsMap.values());

          // 2. Atualizar a Loja Pública com a SOMA TOTAL
          await db.collection('products_public').doc(idStr).set({
              stock: totalStock,
              variants: variants
          }, { merge: true });
          
          console.log(`Stock sincronizado para Produto ${publicId}: ${totalStock} unidades.`);

      } catch (err) {
          console.error("Erro ao sincronizar stock público automaticamente:", err);
      }
  };

  // Função auxiliar para mapear Produto de Inventário -> Produto Público (Base)
  const mapToPublicProduct = (inv: Omit<InventoryProduct, 'id'> | InventoryProduct, publicIdRaw: number | string): Product => {
    const publicId = Number(publicIdRaw);
    
    const product: Product = {
        id: publicId,
        name: inv.name,
        category: inv.category,
        price: inv.salePrice || 0, 
        originalPrice: inv.originalPrice, // Mapeado
        promoEndsAt: inv.promoEndsAt,     // Mapeado
        image: '', 
        description: inv.description || `Produto ${inv.name}`,
        stock: 0, // Será calculado pelo refreshPublicProductStock
        features: inv.features || [],
        comingSoon: inv.comingSoon || false,
        badges: inv.badges || [],
        images: [],
        variantLabel: 'Opção',
        weight: inv.weight || 0,
        specs: inv.specs || {}
    };

    if (inv.images && inv.images.length > 0) {
        product.images = inv.images;
        product.image = inv.images[0];
    } else {
        // Se não houver imagens no lote, não definimos para não apagar as da loja
        // Mas precisamos de uma imagem padrão se for um produto novo
        product.image = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"%3E%3Crect width="300" height="300" fill="%23e2e8f0"/%3E%3C/svg%3E';
        // Removemos images do objeto para que o merge: true não as apague
        delete (product as any).images;
        delete (product as any).image;
    }

    return product;
  };

  const addProduct = async (product: Omit<InventoryProduct, 'id'>) => {
    try {
      // 1. Adicionar ao Inventário (Privado)
      const docRef = await db.collection('products_inventory').add(product);
      
      const publicId = product.publicProductId !== undefined && product.publicProductId !== null 
        ? Number(product.publicProductId) 
        : Date.now();
      
      // 2. Atualizar ou Criar Produto Público
      if (product.publicProductId !== undefined && product.publicProductId !== null) {
          // Se já existe ID público, NÃO atualizamos os metadados (Nome, Imagens, etc)
          // para não sobrescrever as edições feitas na Gestão da Loja Online.
          // Apenas o stock e variantes serão atualizados pelo refreshPublicProductStock.
      } else {
          // Se é novo produto sem ID público, cria do zero
          const publicProduct = mapToPublicProduct(product, publicId);
          const cleanPublicProduct = JSON.parse(JSON.stringify(publicProduct));
          await db.collection('products_public').doc(publicId.toString()).set(cleanPublicProduct);
          await docRef.update({ publicProductId: publicId });
      }

      // 3. SINCRONIZAÇÃO AUTOMÁTICA DE STOCK
      await refreshPublicProductStock(publicId);

    } catch (error) {
      console.error("Erro ao adicionar produto:", error);
      throw error;
    }
  };

  const updateProduct = async (id: string, updates: Partial<InventoryProduct>) => {
    try {
      // 1. Atualizar Inventário
      await db.collection('products_inventory').doc(id).update(updates);

      // 2. Obter dados atualizados para sincronizar info pública
      const docSnap = await db.collection('products_inventory').doc(id).get();
      const currentData = docSnap.data() as InventoryProduct;
      
      if (currentData && currentData.publicProductId !== undefined && currentData.publicProductId !== null) {
          const publicId = Number(currentData.publicProductId);
          
          // NÃO atualizamos metadados públicos (Nome, Preço, Imagens) aqui
          // para não sobrescrever as edições feitas na Gestão da Loja Online.

          // 3. SINCRONIZAÇÃO AUTOMÁTICA DE STOCK
          // Recalcula a soma de todos os lotes
          await refreshPublicProductStock(publicId);
      }

    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const docSnap = await db.collection('products_inventory').doc(id).get();
      const data = docSnap.data() as InventoryProduct;

      // 1. Apagar do Inventário
      await db.collection('products_inventory').doc(id).delete();

      // 2. Se tinha ID público, recalcular stock (ou apagar se for o último)
      if (data && data.publicProductId !== undefined && data.publicProductId !== null) {
          const publicId = Number(data.publicProductId);
          const remainingInventory = await db.collection('products_inventory')
              .where('publicProductId', '==', publicId)
              .get();
              
          if (remainingInventory.empty) {
              await db.collection('products_public').doc(publicId.toString()).delete();
          } else {
              // Ainda existem outros lotes, recalcula o total
              await refreshPublicProductStock(publicId);
          }
      }
    } catch (error) {
      console.error("Erro ao apagar produto:", error);
      throw error;
    }
  };

  return { products, loading, error, addProduct, updateProduct, deleteProduct };
};
