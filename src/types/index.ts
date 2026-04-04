export type UserRole = 'customer' | 'delivery';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  token: string;
  // Needed for seamless session refresh without forcing a relogin.
  refreshToken?: string;
}

export type ProductCategory = 'fmcg' | 'kitchen' | 'home';

export interface Product {
  id: string;
  name: string;
  image: string;
  category: ProductCategory;
  brand?: string; // e.g. "Domino", "Ariel", etc.
  subCategory?: string; // e.g. "Cleaning", "Snacks", etc.
  price: number;
  discountPercent: number;
  // Backend product payload currently doesn't provide these fields consistently.
  // Keep them optional and render UI conditionally.
  etaMinutes?: number;
  isVeg?: boolean;
  rating?: number;
  reviewCount?: number;
  /** From backend `minOrderQuantity`; cart API requires at least this many per line. */
  minOrderQuantity?: number;
}

export interface Deal {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  // Optional images:
  // - `image` will be set at runtime based on the active division.
  // - `imageFmcg` / `imageHomeKitchen` are the sources from mock data.
  image?: string;
  imageFmcg?: string;
  imageHomeKitchen?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type OrderStatus =
  | 'assigned'
  | 'accepted'
  | 'picked'
  | 'en_route'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: string;
  customerName: string;
  address: string;
  // Destination coordinates (customer delivery location).
  // These are expected to be stored inside `delivery_address.latitude/longitude` on the backend.
  customerLatitude?: number;
  customerLongitude?: number;
  amount: number;
  status: OrderStatus;
  createdAt: string;
  itemsSummary: string;
}
