
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
  const refreshPublicProductStock = async (publicId: number) => {
      try {
          const idStr = publicId.toString();
          
          // 1. Buscar todos os lotes deste produto
          const snapshot = await db.collection('products_inventory')
              .where('publicProductId', '==', publicId)
              .get();

          if (snapshot.empty) {
              // Se não houver lotes, coloca stock a 0 mas não apaga o produto (para manter SEO/Histórico)
              // Se quiser apagar mesmo, seria .delete()
              await db.collection('products_public').doc(idStr).update({ stock: 0, variants: [] }).catch(() => {});
              return;
          }

          let totalStock = 0;
          const variantsMap = new Map<string, ProductVariant>();

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
                      price: item.salePrice || item.targetSalePrice || 0,
                      image: (item.images && item.images[0]) ? item.images[0] : (existing?.image || undefined)
                  });
              }
          });

          const variants = Array.from(variantsMap.values());

          // 2. Atualizar a Loja Pública com a SOMA TOTAL
          await db.collection('products_public').doc(idStr).update({
              stock: totalStock,
              variants: variants
          });
          
          console.log(`Stock sincronizado para Produto ${publicId}: ${totalStock} unidades.`);

      } catch (err) {
          console.error("Erro ao sincronizar stock público automaticamente:", err);
      }
  };

  // Função auxiliar para mapear Produto de Inventário -> Produto Público (Base)
  const mapToPublicProduct = (inv: Omit<InventoryProduct, 'id'> | InventoryProduct, publicId: number): Product => {
    const mainImage = (inv.images && inv.images.length > 0 && inv.images[0]) 
        ? inv.images[0] 
        : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"%3E%3Crect width="300" height="300" fill="%23e2e8f0"/%3E%3C/svg%3E';
    
    return {
        id: publicId,
        name: inv.name,
        category: inv.category,
        price: inv.salePrice || 0, 
        image: mainImage, 
        description: inv.description || `Produto ${inv.name}`,
        stock: 0, // Será calculado pelo refreshPublicProductStock
        features: inv.features || [],
        comingSoon: inv.comingSoon || false,
        badges: inv.badges || [],
        images: inv.images || [],
        variantLabel: 'Opção',
        weight: inv.weight || 0
    };
  };

  const addProduct = async (product: Omit<InventoryProduct, 'id'>) => {
    try {
      // 1. Adicionar ao Inventário (Privado)
      const docRef = await db.collection('products_inventory').add(product);
      
      const publicId = product.publicProductId || Date.now();
      
      // 2. Atualizar ou Criar Produto Público
      if (product.publicProductId) {
          // Se já existe ID público, atualizamos os dados gerais (Nome, Imagem, Descrição)
          // assumindo que o novo lote tem a info mais recente.
          const publicProduct = mapToPublicProduct(product, publicId);
          const cleanPublicProduct = JSON.parse(JSON.stringify(publicProduct));
          
          // Removemos stock e variantes do update direto, deixamos o refresh calcular
          delete cleanPublicProduct.stock;
          delete cleanPublicProduct.variants;

          await db.collection('products_public').doc(publicId.toString()).set(cleanPublicProduct, { merge: true });
      } else {
          // Se é novo produto sem ID público, cria do zero
          const publicProduct = mapToPublicProduct(product, publicId);
          const cleanPublicProduct = JSON.parse(JSON.stringify(publicProduct));
          await db.collection('products_public').doc(publicId.toString()).set(cleanPublicProduct);
          await docRef.update({ publicProductId: publicId });
      }

      // 3. SINCRONIZAÇÃO AUTOMÁTICA DE STOCK
      if (product.publicProductId) {
          await refreshPublicProductStock(product.publicProductId);
      } else {
          // Se foi criado agora, o ID é novo
          await refreshPublicProductStock(publicId);
      }

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
      
      if (currentData && currentData.publicProductId) {
          const publicId = currentData.publicProductId;
          
          // Atualiza metadados públicos (Nome, Preço, Imagens)
          const publicProduct = mapToPublicProduct(currentData, publicId);
          const cleanPublicProduct = JSON.parse(JSON.stringify(publicProduct));
          
          // Removemos stock e variantes do update direto para não sobrescrever cálculo
          delete cleanPublicProduct.stock;
          delete cleanPublicProduct.variants;

          await db.collection('products_public').doc(publicId.toString()).set(cleanPublicProduct, { merge: true });

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
      if (data && data.publicProductId) {
          const remainingInventory = await db.collection('products_inventory')
              .where('publicProductId', '==', data.publicProductId)
              .get();
              
          if (remainingInventory.empty) {
              await db.collection('products_public').doc(data.publicProductId.toString()).delete();
          } else {
              // Ainda existem outros lotes, recalcula o total
              await refreshPublicProductStock(data.publicProductId);
          }
      }
    } catch (error) {
      console.error("Erro ao apagar produto:", error);
      throw error;
    }
  };

  return { products, loading, error, addProduct, updateProduct, deleteProduct };
};

