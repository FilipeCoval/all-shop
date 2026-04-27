
import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { InventoryProduct, Product, ProductVariant, Order } from '../types';
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
  const refreshPublicProductStock = async (publicIdRaw: number | string) => {
      try {
          const publicId = Number(publicIdRaw);
          if (isNaN(publicId)) return;

          // 1. Fetch public product 
          const publicRef = db.collection('products_public').doc(publicId.toString());
          const publicSnap = await publicRef.get();
          if (!publicSnap.exists) return;
          const publicData = publicSnap.data() as Product;

          // 2. Calculate physical stock & variants from inventory
          const inventorySnap = await db.collection('products_inventory').where('publicProductId', '==', publicId).get();
          let physicalStock = 0;
          let variantStock: Record<string, number> = {};

          inventorySnap.forEach(doc => {
              const data = doc.data() as InventoryProduct;
              const qty = Math.max(0, (data.quantityBought || 0) - (data.quantitySold || 0));
              physicalStock += qty;
              
              const variant = (data.variant || '').trim();
              if (!variantStock[variant]) variantStock[variant] = 0;
              variantStock[variant] += qty;
          });

          // 3. Subtract pending orders
          const ordersSnap = await db.collection('orders').where('status', 'in', ['Pendente', 'Processamento', 'Pago', 'Enviado', 'Entregue']).get();
          let pending = 0;
          let variantPending: Record<string, number> = {};
          
          const now = new Date();
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          ordersSnap.forEach(doc => {
              const order = doc.data() as Order;
              const orderDate = new Date(order.date || new Date());
              const isExplicitlyPending = order.stockDeducted === false;
              const isOldButStuck = order.stockDeducted === undefined && 
                                   ['Pendente', 'Processamento', 'Pago'].includes(order.status) && 
                                   orderDate > thirtyDaysAgo;

              if (isExplicitlyPending || isOldButStuck) {
                  order.items.forEach((item: any) => {
                      if (typeof item === 'object' && item.productId === publicId) {
                          const qty = item.quantity || 1;
                          pending += qty;
                          const variant = (item.selectedVariant || '').trim();
                          if (!variantPending[variant]) variantPending[variant] = 0;
                          variantPending[variant] += qty;
                      }
                  });
              }
          });

          const available = Math.max(0, physicalStock - pending);

          // 4. Update Document
          const updatedVariants: any[] = [];
          const allVariantNames = new Set<string>();
          Object.keys(variantStock).forEach(v => { if (v) allVariantNames.add(v); });
          (publicData.variants || []).forEach(v => { if (v && v.name) allVariantNames.add(v.name.trim()); });

          const currentVariantsMap = new Map();
          (publicData.variants || []).forEach(v => { if (v && v.name) currentVariantsMap.set(v.name.trim(), v); });

          allVariantNames.forEach(vName => {
              const physical = variantStock[vName] || 0;
              const pend = variantPending[vName] || 0;
              const variantAvailable = Math.max(0, physical - pend);
              
              const existing = currentVariantsMap.get(vName) || {};
              let cleanImage = existing.image;
              if (cleanImage === null || cleanImage === undefined) cleanImage = undefined;
              
              const varData: any = {
                  name: vName,
                  price: Number(existing.price) || 0,
                  stock: variantAvailable
              };
              if (cleanImage) varData.image = cleanImage;
              
              updatedVariants.push(varData);
          });
          
          const updateData: any = { stock: available };
          if (updatedVariants.length > 0) {
              updateData.variants = updatedVariants;
          }

          await publicRef.set(updateData, { merge: true });
          console.log(`Stock sincronizado para Produto ${publicId}.`);

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

