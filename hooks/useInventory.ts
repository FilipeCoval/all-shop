
import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { InventoryProduct, Product, ProductVariant } from '../types';
import { calculateAvailableStock } from '../services/stockService';

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

          // 0. Buscar dados atuais do produto público para preservar variantes e imagens manuais
          const publicRef = db.collection('products_public').doc(publicId.toString());
          const publicDoc = await publicRef.get();
          
          // Se não existir na coleção pública não podemos atualizar
          if (!publicDoc.exists) return;
          const publicData = publicDoc.data() as Product;

          // 1. Buscar todos os lotes deste produto
          const snapshot = await db.collection('products_inventory')
              .where('publicProductId', '==', publicId)
              .get();

          // Recalcular variantes baseadas nos lotes existentes
          const variantsMap = new Map<string, ProductVariant>();
          if (publicData?.variants) {
              publicData.variants.forEach(v => {
                  variantsMap.set(v.name, { ...v });
              });
          }

          snapshot.forEach(doc => {
              const item = doc.data() as InventoryProduct;
              if (item.variant) {
                  const existing = variantsMap.get(item.variant);
                  variantsMap.set(item.variant, {
                      name: item.variant,
                      price: item.salePrice || item.targetSalePrice || (existing?.price || 0),
                      image: (existing?.image) ? existing.image : ((item.images && item.images[0]) ? item.images[0] : undefined)
                  });
              }
          });

          const variants = Array.from(variantsMap.values());

          // 2. Usar o novo serviço para calcular stock disponível (considerando reservas)
          const allInventory = await db.collection('products_inventory').get();
          const allInventoryProducts = allInventory.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryProduct));
          const availableStock = await calculateAvailableStock(publicId, allInventoryProducts);

          // 3. Atualizar a Loja Pública
          await publicRef.set({
              stock: availableStock,
              variants: variants
          }, { merge: true });
          
          console.log(`Stock sincronizado para Produto ${publicId}: ${availableStock} unidades disponíveis.`);

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
      const publicProduct = mapToPublicProduct(product, publicId);
      // Ensure the id field is explicitly present
      publicProduct.id = publicId;
      const cleanPublicProduct = JSON.parse(JSON.stringify(publicProduct));

      if (product.publicProductId !== undefined && product.publicProductId !== null) {
          // If publicProductId exists, ensure the document exists and has the 'id' field
          await db.collection('products_public').doc(publicId.toString()).set(cleanPublicProduct, { merge: true });
      } else {
          // If it's a new product, create it
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
