// Tipos principais da aplicação

export interface User {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  nif?: string;
  addresses?: Address[];
  loyaltyPoints?: number;
  pointsHistory?: PointHistory[];
  tier?: UserTier;
  totalSpent?: number;
  wishlist?: number[];
}

export interface Address {
  id: string;
  alias: string;
  street: string;
  city: string;
  zip: string;
}

export interface Order {
  id: string;
  date: string;
  total: number;
  status: 'Processamento' | 'Pago' | 'Enviado' | 'Entregue' | 'Cancelado';
  items: (OrderItem | string)[]; // ACEITA DADOS ANTIGOS (string) E NOVOS (OrderItem)
  userId?: string | null; // Permite null para encomendas de convidados
  shippingInfo: UserCheckoutInfo;
  trackingNumber?: string;
  pointsAwarded?: boolean;
  cancellationReason?: string;
}

export interface OrderItem {
  productId: number;
  name: string;
  price: number;
  image?: string;
  description?: string;
  quantity: number;
  selectedVariant?: string;
  serialNumbers?: string[]; // Array de S/N atribuídos (ex: ["SN123", "SN456"])
  unitIds?: string[]; // IDs internos das unidades de inventário
  cartItemId?: string;
  addedAt: string;
}

export interface UserCheckoutInfo {
  name: string;
  email: string; // Adicionado para guardar o email do convidado
  street: string;
  doorNumber: string;
  zip: string;
  city: string;
  phone: string;
  nif?: string;
  paymentMethod: 'MB Way' | 'Transferência' | 'Cobrança';
}

export interface CartItem {
  cartItemId: string;
  id: number;
  name: string;
  price: number;
  image: string;
  description?: string;
  quantity: number;
  selectedVariant?: string;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  stock: number;
  variants?: ProductVariant[];
  features: string[];
  comingSoon?: boolean;
  badges?: string[]; // Etiquetas de marketing (Novidade, Promoção, etc.)
  images?: string[];
  variantLabel?: string;
}

export interface ProductVariant {
  name: string;
  price: number;
  image?: string;
}

export interface InventoryProduct {
  id: string;
  name: string;
  category: string;
  publicProductId?: number;
  variant?: string;
  purchaseDate: string;
  supplierName?: string;
  supplierOrderId?: string;
  quantityBought: number;
  quantitySold: number;
  salesHistory?: SaleRecord[];
  purchasePrice: number;
  targetSalePrice?: number;
  salePrice: number;
  cashbackValue: number;
  cashbackStatus: CashbackStatus;
  units?: ProductUnit[];
  status: ProductStatus;
  description?: string;
  features?: string[];
  badges?: string[]; // Etiquetas de marketing no inventário
  images?: string[];
  comingSoon?: boolean;
}

export interface ProductUnit {
  id: string; // O próprio S/N ou código de barras
  status: 'AVAILABLE' | 'SOLD' | 'RESERVED';
  addedAt: string;
}

export type ProductStatus = 'IN_STOCK' | 'PARTIAL' | 'SOLD';
export type CashbackStatus = 'NONE' | 'PENDING' | 'RECEIVED';

export interface SaleRecord {
  id: string;
  date: string;
  quantity: number;
  unitPrice: number;
  shippingCost?: number;
  notes?: string;
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

export interface PointHistory {
  id: string;
  date: string;
  amount: number;
  reason: string;
  orderId?: string;
}

export interface Review {
    id: string;
    productId: number;
    userName: string;
    rating: number;
    comment: string;
    date: string;
    images?: string[];
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: Date;
}

export type UserTier = 'Bronze' | 'Prata' | 'Ouro';
