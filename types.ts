
// Tipos principais da aplicação

export interface User {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
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
  status: 'Processamento' | 'Pago' | 'Enviado' | 'Entregue' | 'Cancelado' | 'Reclamação' | 'Devolvido';
  items: (OrderItem | string)[];
  userId?: string | null;
  shippingInfo: UserCheckoutInfo;
  trackingNumber?: string;
  pointsAwarded?: boolean;
  cancellationReason?: string;
  statusHistory?: StatusHistory[];
  returnRequest?: {
      date: string;
      reason: string;
      status: 'Pendente' | 'Aprovado' | 'Rejeitado';
  };
}

export interface OrderItem {
  productId: number;
  name: string;
  price: number;
  image?: string;
  description?: string;
  quantity: number;
  selectedVariant?: string;
  serialNumbers?: string[];
  unitIds?: string[];
  cartItemId?: string;
  addedAt: string;
}

export interface UserCheckoutInfo {
  name: string;
  email: string;
  street: string;
  doorNumber: string;
  zip: string;
  city: string;
  phone: string;
  nif?: string;
  paymentMethod: 'MB Way' | 'Transferência' | 'Cobrança';
  deliveryMethod?: 'Shipping' | 'Pickup'; // Novo campo
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
  reservedUntil?: string; // ISO String para expiração da reserva
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
  badges?: string[];
  images?: string[];
  variantLabel?: string;
  weight?: number; // Peso em KG
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
  
  // Cashback Fields Expandidos
  cashbackValue: number;
  cashbackStatus: CashbackStatus;
  cashbackPlatform?: string; // Ex: Temu, AliExpress
  cashbackAccount?: string;  // Ex: email@usado.com
  cashbackExpectedDate?: string; // Data prevista para receber

  units?: ProductUnit[];
  status: ProductStatus;
  description?: string;
  features?: string[];
  badges?: string[];
  images?: string[];
  comingSoon?: boolean;
  weight?: number; // Peso em KG
}

export interface ProductUnit {
  id: string;
  status: 'AVAILABLE' | 'SOLD' | 'RESERVED';
  addedAt: string;
  reservedBy?: string; // sessionId ou userId
  reservedUntil?: string;
}

export interface StockReservation {
    id: string;
    productId: number;
    variantName?: string;
    quantity: number;
    sessionId: string;
    expiresAt: number; // Timestamp
}

export interface StatusHistory {
    status: Order['status'];
    date: string;
    notes?: string;
    aiSummary?: string;
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
  validProductId?: number; // Opcional: Se definido, só funciona neste produto
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

export interface SupportTicket {
    id: string;
    customerEmail?: string;
    customerName?: string;
    subject: string;
    description: string; // Resumo feito pela IA
    category: 'Garantia' | 'Devolução' | 'Dúvida Técnica' | 'Outros';
    status: 'Aberto' | 'Em Análise' | 'Resolvido';
    priority: 'Baixa' | 'Média' | 'Alta';
    createdAt: string;
    orderId?: string;
    aiSummary?: string; // Resumo extra
}

export type UserTier = 'Bronze' | 'Prata' | 'Ouro';
