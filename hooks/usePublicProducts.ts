
import { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { Product } from '../types';

const MOCK_PRODUCTS: Product[] = [
  {
    id: 101,
    name: "Ultra HD 4K TV Box Pro",
    category: "TV & Streaming",
    price: 69.90,
    image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80&w=600",
    description: "Transforme a sua TV numa Smart TV Android completa. Suporta 4K HDR, Dolby Atmos e assistente de voz Google.",
    stock: 50,
    features: ["4K HDR", "Android TV 11", "WiFi 6", "Comando de Voz"],
    images: [
      "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&q=80&w=600"
    ]
  },
  {
    id: 102,
    name: "Fones Bluetooth Noise Cancelling",
    category: "Áudio",
    price: 89.99,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600",
    description: "Som imersivo com cancelamento de ruído ativo. Bateria para 30 horas e conforto premium.",
    stock: 25,
    features: ["ANC", "30h Bateria", "Bluetooth 5.2", "Microfone HD"],
    variants: [
      { name: "Preto Matte", price: 89.99, image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600" },
      { name: "Branco Pérola", price: 89.99, image: "https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3?auto=format&fit=crop&q=80&w=600" }
    ]
  },
  {
    id: 103,
    name: "Smartwatch Series 8 Sport",
    category: "Wearables",
    price: 129.50,
    image: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&q=80&w=600",
    description: "Monitorize a sua saúde, receba notificações e treine com estilo. Resistente à água.",
    stock: 15,
    features: ["GPS", "Monitor Cardíaco", "À prova de água", "Notificações"],
  },
  {
    id: 104,
    name: "Cabo HDMI 2.1 Ultra High Speed",
    category: "Cabos",
    price: 14.99,
    image: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?auto=format&fit=crop&q=80&w=600",
    description: "Ideal para PS5 e Xbox Series X. Suporta 8K@60Hz e 4K@120Hz.",
    stock: 100,
    features: ["8K Ready", "48 Gbps", "Malha Reforçada", "2 Metros"],
  },
  {
    id: 105,
    name: "Powerbank 20000mAh Fast Charge",
    category: "Acessórios",
    price: 34.90,
    image: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&q=80&w=600",
    description: "Nunca fique sem bateria. Carregue o seu smartphone até 5 vezes. Compatível com PD e QC3.0.",
    stock: 40,
    features: ["20000mAh", "USB-C PD", "Display Digital", "Carregamento Rápido"],
  },
  {
    id: 106,
    name: "Teclado Mecânico RGB Gamer",
    category: "Gaming",
    price: 75.00,
    image: "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&q=80&w=600",
    description: "Switches mecânicos táteis e iluminação RGB personalizável. Construção em alumínio.",
    stock: 10,
    features: ["RGB", "Switch Blue", "Anti-Ghosting", "Compacto"],
    comingSoon: false
  },
  {
    id: 107,
    name: "Câmara de Segurança WiFi",
    category: "Smart Home",
    price: 45.00,
    image: "https://images.unsplash.com/photo-1557324232-b8917d3c3d63?auto=format&fit=crop&q=80&w=600",
    description: "Monitorize a sua casa pelo telemóvel. Visão noturna e deteção de movimento.",
    stock: 30,
    features: ["1080p", "Visão Noturna", "Audio Bidirecional", "App Grátis"],
  },
  {
    id: 108,
    name: "Drone Explorer 4K",
    category: "Gadgets",
    price: 299.00,
    image: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&q=80&w=600",
    description: "Drone dobrável com câmara 4K estabilizada. 30 minutos de voo por bateria.",
    stock: 5,
    features: ["Câmara 4K", "GPS", "Retorno Automático", "Estabilização 3-Eixos"],
    comingSoon: true
  }
];

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
          // Garante que o ID é convertido para número para compatibilidade
          const id = parseInt(doc.id, 10);
          if (!isNaN(id)) {
             items.push({ 
                ...data,
                id: id,
             } as Product);
          }
        });

        if (items.length === 0) {
            console.log("Database empty or no products found, loading mock products...");
            setProducts(MOCK_PRODUCTS);
        } else {
            // Ordena por ID decrescente (mais recentes primeiro)
            items.sort((a, b) => b.id - a.id);
            setProducts(items);
        }
        setLoading(false);
      },
      (err) => {
        console.warn("Using fallback products due to error:", err);
        if (isActive) {
            setProducts(MOCK_PRODUCTS);
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
