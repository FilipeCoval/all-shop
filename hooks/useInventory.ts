import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { InventoryProduct, Product } from '../types';

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
        price: inv.salePrice,
        image: (inv.images && inv.images.length > 0) ? inv.images[0] : 'https://via.placeholder.com/300', // Fallback image
        description: inv.description || `Produto ${inv.name}`,
        stock: inv.quantityBought - inv.quantitySold,
        features: inv.features || [],
        comingSoon: inv.comingSoon || false,
        badges: inv.badges || [], // Mapeia as etiquetas
        images: inv.images || [],
        variantLabel: 'Opção'
    };
  };

  const addProduct = async (product: Omit<InventoryProduct, 'id'>) => {
    try {
      // 1. Adicionar ao Inventário (Privado)
      const docRef = await db.collection('products_inventory').add(product);
      
      // 2. Sincronizar com a Loja Pública (Se tiver Public ID)
      // Se não tiver Public ID, geramos um baseado no timestamp para garantir que aparece
      const publicId = product.publicProductId || Date.now();
      
      const publicProduct = mapToPublicProduct(product, publicId);
      
      // Salva na coleção pública usando o ID numérico como chave do documento (string)
      await db.collection('products_public').doc(publicId.toString()).set(publicProduct);

      // Atualiza o inventário com o ID público gerado se não existia
      if (!product.publicProductId) {
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
      // Precisamos ler o documento atual para saber o publicProductId
      const docSnap = await db.collection('products_inventory').doc(id).get();
      const currentData = docSnap.data() as InventoryProduct;
      
      if (currentData && currentData.publicProductId) {
          // Mesclar dados atuais com as atualizações para criar o objeto completo
          const updatedFullData = { ...currentData, ...updates };
          const publicProduct = mapToPublicProduct(updatedFullData, currentData.publicProductId);
          
          await db.collection('products_public').doc(currentData.publicProductId.toString()).set(publicProduct, { merge: true });
      }

    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      // Ler antes de apagar para saber qual remover do público
      const docSnap = await db.collection('products_inventory').doc(id).get();
      const data = docSnap.data() as InventoryProduct;

      await db.collection('products_inventory').doc(id).delete();

      if (data && data.publicProductId) {
          await db.collection('products_public').doc(data.publicProductId.toString()).delete();
      }
    } catch (error) {
      console.error("Erro ao apagar produto:", error);
      throw error;
    }
  };

  return { products, loading, error, addProduct, updateProduct, deleteProduct };
};
