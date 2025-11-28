
export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
  images?: string[];
  features: string[];
}

export interface CartItem extends Product {
  quantity: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface UserCheckoutInfo {
  name: string;
  address: string;
  paymentMethod: string;
}

export interface Address {
  id: string;
  alias: string; // ex: "Casa", "Trabalho"
  street: string;
  city: string;
  zip: string;
  userId?: string; // Ligação ao ID do Firebase
}

export interface User {
  uid?: string; // ID único do Firebase
  name: string;
  email: string;
  phone?: string;
  nif?: string;
  addresses: Address[];
}

export interface Order {
  id: string;
  date: string;
  total: number;
  status: 'Processamento' | 'Enviado' | 'Entregue';
  items: string[];
  userId?: string; // Para ligar a encomenda ao utilizador real
}

export interface Review {
  id: string;
  productId: number;
  userName: string;
  rating: number; // 1 a 5
  comment: string;
  date: string;
  images: string[]; // Base64 strings
}

// --- BACKOFFICE / DASHBOARD TYPES ---

export type ProductStatus = 'IN_STOCK' | 'SOLD' | 'PARTIAL';
export type CashbackStatus = 'PENDING' | 'RECEIVED' | 'NONE';

export interface InventoryProduct {
  id: string; // Firebase Doc ID
  name: string;
  category: string;
  purchaseDate: string; // YYYY-MM-DD
  
  // Link ao Produto Público (Opcional, mas recomendado para sync de stock)
  publicProductId?: number; 

  // Quantidades
  quantityBought: number; // Quantidade total comprada
  quantitySold: number;   // Quantidade já vendida

  // Valores Unitários (IMPORTANTE: Unitários)
  purchasePrice: number; // Custo por unidade
  targetSalePrice?: number; // Preço alvo/estimado de venda
  salePrice: number;    // Preço real de venda por unidade (0 se ainda não vendeu)
  
  // Cashback (Valor total da compra)
  cashbackValue: number;
  cashbackStatus: CashbackStatus;
  
  // Estado
  status: ProductStatus;
}
