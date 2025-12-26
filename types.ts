
export interface ProductVariant {
  name: string;
  price?: number;
  stock?: number;
  image?: string;
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
  variants?: ProductVariant[];
  variantLabel?: string;
  comingSoon?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
  selectedVariant?: string;
  cartItemId: string;
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
  unitIds?: string[]; // IDs das unidades específicas vendidas nesta transação
}

export interface ProductUnit {
  id: string;         // Serial Number ou ID Interno (AS-XXXX)
  status: 'AVAILABLE' | 'SOLD' | 'RETURNED' | 'DEFECTIVE';
  soldToOrderId?: string;
  addedAt: string;
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
  units?: ProductUnit[]; // Lista de unidades individuais
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
