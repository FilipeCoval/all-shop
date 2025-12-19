
export interface ProductVariant {
  name: string;      // Ex: "33W", "Preto", "128GB"
  price?: number;    // Preço específico desta variante (se for null, usa o preço base)
  stock?: number;    // Stock específico (opcional para já)
  image?: string;    // Imagem específica desta variante
}

export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
  images?: string[];
  features: string[];
  variants?: ProductVariant[]; // Lista de opções
  variantLabel?: string;       // Texto da escolha, ex: "Escolha a Potência" ou "Cor"
  comingSoon?: boolean;        // Indica que o produto ainda não está disponível em stock
}

export interface CartItem extends Product {
  quantity: number;
  selectedVariant?: string; // Nome da variante escolhida
  cartItemId: string;       // ID único no carrinho
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
  phone?: string;
}

export interface Address {
  id: string;
  alias: string;
  street: string;
  city: string;
  zip: string;
  userId?: string;
}

export interface PointHistory {
  id: string;
  date: string;
  amount: number;
  reason: string;
  orderId?: string;
}

export type UserTier = 'Bronze' | 'Prata' | 'Ouro';

export interface User {
  uid?: string;
  name: string;
  email: string;
  phone?: string;
  nif?: string;
  addresses: Address[];
  wishlist?: number[];
  loyaltyPoints?: number;
  totalSpent?: number;
  tier?: UserTier;
  pointsHistory?: PointHistory[];
}

export interface Order {
  id: string;
  date: string;
  total: number;
  status: 'Processamento' | 'Enviado' | 'Entregue' | 'Cancelado';
  items: string[];
  userId?: string;
  trackingNumber?: string;
  pointsAwarded?: boolean;
  shippingInfo?: {
    name: string;
    address: string;
    paymentMethod: string;
    phone?: string;
  };
}

export interface Review {
  id: string;
  productId: number;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  images: string[];
}

export type ProductStatus = 'IN_STOCK' | 'SOLD' | 'PARTIAL';
export type CashbackStatus = 'PENDING' | 'RECEIVED' | 'NONE';

export interface SaleRecord {
  id: string;
  date: string;
  quantity: number;
  unitPrice: number;
  shippingCost?: number;
  notes?: string;
}

export interface InventoryProduct {
  id: string;
  name: string;
  category: string;
  purchaseDate: string;
  supplierName?: string;
  supplierOrderId?: string;
  publicProductId?: number;
  variant?: string;
  quantityBought: number;
  quantitySold: number;
  purchasePrice: number;
  targetSalePrice?: number;
  salePrice: number;
  salesHistory?: SaleRecord[];
  cashbackValue: number;
  cashbackStatus: CashbackStatus;
  status: ProductStatus;
}

export interface Coupon {
  id?: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minPurchase: number;
  isActive: boolean;
  usageCount: number;
}
