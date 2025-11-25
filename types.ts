
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
}

export interface User {
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
