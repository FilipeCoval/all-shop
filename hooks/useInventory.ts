
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
    // Garante que existe pelo menos uma imagem válida ou usa um placeholder interno
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
        stock: inv.quantityBought - inv.quantitySold,
        features: inv.features || [],
        comingSoon: inv.comingSoon || false,
        badges: inv.badges || [],
        images: inv.images || [],
        variantLabel: 'Opção',
        weight: inv.weight || 0 // Mapeia o peso para a loja pública
    };
  };

  const addProduct = async (product: Omit<InventoryProduct, 'id'>) => {
    try {
      // 1. Adicionar ao Inventário (Privado)
      const docRef = await db.collection('products_inventory').add(product);
      
      // 2. Sincronizar com a Loja Pública (Se tiver Public ID)
      const publicId = product.publicProductId || Date.now();
      
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
              existingVariants = existingVariants.filter(v => v.name !== product.variant);
              
              const newVariant: ProductVariant = {
                  name: product.variant,
                  price: product.salePrice || 0
              };
              
              // FIX: Apenas adiciona a imagem se ela existir e não for undefined
              if (product.images && product.images.length > 0 && product.images[0]) {
                  newVariant.image = product.images[0];
              }

              existingVariants.push(newVariant);
          }

          const publicProduct = mapToPublicProduct(product, publicId);
          publicProduct.variants = existingVariants;
          
          // Remove campos undefined antes de salvar
          const cleanPublicProduct = JSON.parse(JSON.stringify(publicProduct));
          await publicDocRef.set(cleanPublicProduct, { merge: true });
      } else {
          const publicProduct = mapToPublicProduct(product, publicId);
          // Remove campos undefined antes de salvar
          const cleanPublicProduct = JSON.parse(JSON.stringify(publicProduct));
          await db.collection('products_public').doc(publicId.toString()).set(cleanPublicProduct);
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

      // 2. Atualizar Loja Pública
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

          if (updatedFullData.variant) {
              existingVariants = existingVariants.filter(v => v.name !== updatedFullData.variant);
              
              const newVariant: ProductVariant = {
                  name: updatedFullData.variant,
                  price: updatedFullData.salePrice || 0
              };
              
              if (updatedFullData.images && updatedFullData.images.length > 0 && updatedFullData.images[0]) {
                  newVariant.image = updatedFullData.images[0];
              }

              existingVariants.push(newVariant);
          }

          const publicProduct = mapToPublicProduct(updatedFullData, publicId);
          publicProduct.variants = existingVariants;
          
          const cleanPublicProduct = JSON.parse(JSON.stringify(publicProduct));
          await publicDocRef.set(cleanPublicProduct, { merge: true });
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
          const remainingInventory = await db.collection('products_inventory')
              .where('publicProductId', '==', data.publicProductId)
              .get();
              
          if (remainingInventory.empty) {
              await db.collection('products_public').doc(data.publicProductId.toString()).delete();
          } else {
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
