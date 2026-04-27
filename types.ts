
// Tipos principais da aplicação

export interface Category {
  id?: string;
  name: string;
  image: string;
  order?: number;
}

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
  fcmToken?: string; // Mantido para retrocompatibilidade
  deviceTokens?: string[]; // NOVO: Lista de dispositivos ativos
  notificationsEnabled?: boolean; // NOVO: Preferência de notificações
  lastShareDate?: string; // Data da última partilha premiada (ISO Date string)
  birthday?: string; // Data de nascimento (ISO Date string ou YYYY-MM-DD)
  isGuest?: boolean; // NOVO: Flag para identificar clientes convidados (sem conta)
}

export interface Address {
  id: string;
  alias: string;
  street: string;
  city: string;
  zip: string;
}

export interface OrderPackage {
  id: string;
  trackingNumber?: string;
  weight?: number;
  items: {
    productId: number;
    selectedVariant?: string;
    quantity: number;
    serialNumbers?: string[];
  }[];
}

export interface Order {
  id: string;
  date: string;
  total: number;
  status: 'Pendente' | 'Processamento' | 'Pago' | 'Enviado' | 'Entregue' | 'Cancelado' | 'Reclamação' | 'Devolvido' | 'Levantamento em Loja';
  items: (OrderItem | string)[];
  userId?: string | null;
  shippingInfo: UserCheckoutInfo;
  trackingNumber?: string;
  packages?: OrderPackage[]; // NOVO: Suporte para múltiplos volumes
  pointsAwarded?: boolean;
  stockDeducted?: boolean;
  cancellationReason?: string;
  statusHistory?: StatusHistory[];
  returnRequest?: {
      date: string;
      reason: string;
      status: 'Pendente' | 'Aprovado' | 'Rejeitado';
  };
  // Fulfillment Fields
  fulfilledAt?: string | null;
  fulfilledBy?: string | null;
  serialNumbersUsed?: string[];
  fulfillmentStatus?: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  storeShippingCost?: number; // Custo real de envio para a loja (para cálculo de lucro)
  discountValue?: number; // Valor total do desconto aplicado
  couponCode?: string; // Código do cupão utilizado
  totalProductCost?: number; // Custo exato dos produtos (baseado nos lotes/seriais usados)
}

export interface StockMovement {
  id: string;
  type: "SALE" | "PURCHASE" | "ADJUSTMENT" | "RETURN";
  orderId: string | null;
  items: {
    productId: string;
    serialNumbers: string[];
    quantity: number;
  }[];
  totalValue: number;
  createdAt: string;
  createdBy: string;
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
  addressExtra?: string; // NOVO: Campo opcional para andar, bloco, etc.
  zip: string;
  city: string;
  phone: string;
  nif?: string;
  paymentMethod: 'MB Way' | 'Transferência' | 'Cobrança' | 'Outro';
  deliveryMethod?: 'Shipping' | 'Pickup';
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
  maxQuantityPerOrder?: number;
}

export interface PremiumBlock {
  id: string;
  type: 'square' | 'rectangle' | 'full' | 'tall';
  title?: string;
  description?: string;
  image?: string;
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  textVerticalAlign?: 'top' | 'center' | 'bottom';
  showIcon?: boolean;
  iconType?: 'cpu' | 'wifi' | 'play' | 'star' | 'none';
}

export interface PremiumBentoData {
  heroSubtitle?: string;
  heroTitle?: string;
  heroImage?: string;
  heroTextColor?: string;
  heroAlign?: 'left' | 'center' | 'right';
  showBuyButton?: boolean;
  blocks?: PremiumBlock[];
  
  // Mantidos para compatibilidade temporária
  box1Title?: string;
  box1Desc?: string;
  box1Image?: string;
  box1TextColor?: string;
  box1Align?: 'left' | 'center' | 'right';
  
  box2Title?: string;
  box2Desc?: string;
  box2Image?: string;
  box2TextColor?: string;
  box2Align?: 'left' | 'center' | 'right';
  box2ShowIcon?: boolean;

  box3Title?: string;
  box3Desc?: string;
  box3Image?: string;
  box3TextColor?: string;
  box3Align?: 'left' | 'center' | 'right';
  box3ShowIcon?: boolean;

  box4Title?: string;
  box4Desc?: string;
  box4Image?: string;
  box4TextColor?: string;
  box4Align?: 'left' | 'center' | 'right';
  box4ShowIcon?: boolean;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  originalPrice?: number; // NOVO: Preço riscado (antes do desconto)
  promoEndsAt?: string;   // NOVO: Data fim da promoção (ISO String)
  image: string;
  description: string;
  stock: number;
  variants?: ProductVariant[];
  features: string[];
  isPremium?: boolean; // Layout Apple-style
  premiumData?: PremiumBentoData;
  cardHoverColor?: string; // NOVO: Cor do efeito hover no card do produto
  comingSoon?: boolean;
  maxQuantityPerOrder?: number; // NOVO: Limite de quantidade por encomenda
  badges?: string[];
  images?: string[];
  variantLabel?: string;
  weight?: number; // Peso em KG
  specs?: Record<string, string | boolean>; // Especificações técnicas para comparação
}

export interface ProductVariant {
  name: string;
  price: number;
  image?: string;
  stock?: number;
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
  originalPrice?: number; // NOVO: Para edição no backoffice
  promoEndsAt?: string;   // NOVO: Para edição no backoffice
  
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
  specs?: Record<string, string | boolean>; // Especificações técnicas
}

export interface ProductUnit {
  id: string;
  status: 'AVAILABLE' | 'SOLD' | 'RESERVED';
  addedAt: string;
  reservedBy?: string; // sessionId ou userId
  reservedUntil?: string;
  soldAt?: string;
  soldToOrder?: string;
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
  serialNumbers?: string[];
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
  maxDiscount?: number; // NOVO: Teto máximo de desconto (ex: 5% mas máx 5€)
  userId?: string; // NOVO: Cupão exclusivo para um user
  maxUsages?: number; // NOVO: Limite de usos (ex: 1 para vouchers de pontos)
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
    userId?: string; // ID do utilizador que fez a review
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
    userId: string; // ID do utilizador (Obrigatório para chat)
    customerEmail?: string;
    customerName?: string;
    subject: string;
    description: string; // Descrição inicial
    category: 'Garantia' | 'Devolução' | 'Dúvida Técnica' | 'Outros';
    status: 'Aberto' | 'Em Análise' | 'Resolvido' | 'Fechado';
    priority: 'Baixa' | 'Média' | 'Alta';
    createdAt: string;
    updatedAt: string; // Para ordenar por atividade recente
    orderId?: string;
    messages?: TicketMessage[];
    unreadUser: boolean; // Se tem mensagens novas para o user
    unreadAdmin: boolean; // Se tem mensagens novas para o admin
}

export interface ImportItem {
  id: string;
  name: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
}

export interface ImportOrder {
  id: string;
  supplierName: string;
  orderNumber?: string;
  localShippingCost: number;
  items: ImportItem[];
}

export interface ImportShipment {
  id: string;
  name: string;
  status: 'GATHERING' | 'SHIPPED' | 'RECEIVED';
  agentShippingCost: number;
  customsCost: number;
  distributionMethod: 'QUANTITY' | 'VALUE';
  exchangeRate?: number; // USD to EUR exchange rate
  orders: ImportOrder[];
  createdAt: string;
}

export interface TicketMessage {
    id: string;
    senderId: string;
    senderName: string;
    role: 'user' | 'admin' | 'system';
    text: string;
    timestamp: string;
    attachments?: string[];
}

export type UserTier = 'Bronze' | 'Prata' | 'Ouro';
