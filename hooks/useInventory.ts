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

  // Função auxiliar para mapear Produto de Inventário -> Produto Público
  const mapToPublicProduct = (inv: Omit<InventoryProduct, 'id'> | InventoryProduct, publicId: number): Product => {
    return {
        id: publicId,
        name: inv.name,
        category: inv.category,
        price: inv.salePrice || 0, // Garante que usa o salePrice definido no formulário
        image: (inv.images && inv.images.length > 0) ? inv.images[0] : 'https://via.placeholder.com/300', 
        description: inv.description || `Produto ${inv.name}`,
        stock: inv.quantityBought - inv.quantitySold,
        features: inv.features || [],
        comingSoon: inv.comingSoon || false,
        badges: inv.badges || [],
        images: inv.images || [],
        variantLabel: 'Opção'
    };
  };

  const addProduct = async (product: Omit<InventoryProduct, 'id'>) => {
    try {
      // 1. Adicionar ao Inventário (Privado)
      const docRef = await db.collection('products_inventory').add(product);
      
      // 2. Sincronizar com a Loja Pública (Se tiver Public ID)
      const publicId = product.publicProductId || Date.now();
      
      // Lógica de MERGE para variantes ao criar
      if (product.publicProductId) {
          const publicDocRef = db.collection('products_public').doc(publicId.toString());
          const publicDocSnap = await publicDocRef.get();
          
          let existingVariants: ProductVariant[] = [];
          if (publicDocSnap.exists) {
              const existingData = publicDocSnap.data() as Product;
              existingVariants = existingData.variants || [];
          }

          // Se o novo produto é uma variante, adiciona à lista
          if (product.variant) {
              // Remove se já existir variante com mesmo nome (para atualizar)
              existingVariants = existingVariants.filter(v => v.name !== product.variant);
              
              const newVariant: ProductVariant = {
                  name: product.variant,
                  price: product.salePrice || 0
              };
              // FIX: Conditionally add image to avoid undefined value
              if (product.images && product.images.length > 0) {
                  newVariant.image = product.images[0];
              }

              existingVariants.push(newVariant);
          }

          const publicProduct = mapToPublicProduct(product, publicId);
          publicProduct.variants = existingVariants;
          
          await publicDocRef.set(publicProduct, { merge: true });
      } else {
          // Se não tem ID, cria novo
          const publicProduct = mapToPublicProduct(product, publicId);
          await db.collection('products_public').doc(publicId.toString()).set(publicProduct);
          await docRef.update({ publicProductId: publicId });
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

      // 2. Verificar se precisamos atualizar a loja pública
      const docSnap = await db.collection('products_inventory').doc(id).get();
      const currentData = docSnap.data() as InventoryProduct;
      
      if (currentData && currentData.publicProductId) {
          const publicId = currentData.publicProductId;
          const updatedFullData = { ...currentData, ...updates };
          
          const publicDocRef = db.collection('products_public').doc(publicId.toString());
          const publicDocSnap = await publicDocRef.get();

          let existingVariants: ProductVariant[] = [];
          if (publicDocSnap.exists) {
              const existingData = publicDocSnap.data() as Product;
              existingVariants = existingData.variants || [];
          }

          // Atualizar a variante específica na lista de variantes públicas
          if (updatedFullData.variant) {
              existingVariants = existingVariants.filter(v => v.name !== updatedFullData.variant);
              
              const newVariant: ProductVariant = {
                  name: updatedFullData.variant,
                  price: updatedFullData.salePrice || 0
              };
              // FIX: Conditionally add image to avoid undefined value
              if (updatedFullData.images && updatedFullData.images.length > 0) {
                  newVariant.image = updatedFullData.images[0];
              }

              existingVariants.push(newVariant);
          }

          const publicProduct = mapToPublicProduct(updatedFullData, publicId);
          publicProduct.variants = existingVariants;
          
          await publicDocRef.set(publicProduct, { merge: true });
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

      await db.collection('products_inventory').doc(id).delete();

      if (data && data.publicProductId) {
          // Ao apagar do inventário, se for uma variante, removemos apenas a variante do produto público
          // Se for o último lote desse produto, apagamos o produto público.
          
          const remainingInventory = await db.collection('products_inventory')
              .where('publicProductId', '==', data.publicProductId)
              .get();
              
          if (remainingInventory.empty) {
              await db.collection('products_public').doc(data.publicProductId.toString()).delete();
          } else {
              // Se ainda restam outros lotes/variantes, apenas removemos esta variante da lista pública
              if (data.variant) {
                  const publicDocRef = db.collection('products_public').doc(data.publicProductId.toString());
                  const publicDocSnap = await publicDocRef.get();
                  if (publicDocSnap.exists) {
                      const pubData = publicDocSnap.data() as Product;
                      const newVariants = (pubData.variants || []).filter(v => v.name !== data.variant);
                      await publicDocRef.update({ variants: newVariants });
                  }
              }
          }
      }
    } catch (error) {
      console.error("Erro ao apagar produto:", error);
      throw error;
    }
  };

  return { products, loading, error, addProduct, updateProduct, deleteProduct };
};
