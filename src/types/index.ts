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

export type PriceOptionKey = 'unit' | 'set' | 'remaining';

export interface ProductPriceOption {
  key: PriceOptionKey;
  label: string;
  sellingPrice: number;
  mrp: number;
  discount?: number;
}

/** Flat specs from admin / backend `specifications` JSON. */
export type ProductSpecifications = Record<string, string | number | boolean | null>;

export interface Product {
  id: string;
  name: string;
  image: string;
  /** Optional gallery ordered with primary image first when available. */
  images?: string[];
  category: ProductCategory;
  brand?: string; // e.g. "Domino", "Ariel", etc.
  /** From API `brand.logoUrl` when brand is a linked entity; used for shop-by-brand tiles. */
  brandLogoUrl?: string;
  subCategory?: string; // e.g. "Cleaning", "Snacks", etc.
  /** `GET /products` → `category.id` (admin Category row); use for browse filters. */
  shopCategoryId?: string;
  /** Backend category display name (admin). */
  categoryLabel?: string;
  slug?: string;
  description?: string;
  specifications?: ProductSpecifications;
  /** Seller / manufacturer from API `company`. */
  companyName?: string;
  stockQuantity?: number;
  isAvailable?: boolean;
  price: number;
  discountPercent: number;
  /** When the API exposes multiple tiers (unit / set / remaining), customer picks one. */
  priceOptions?: ProductPriceOption[];
  // Backend product payload currently doesn't provide these fields consistently.
  // Keep them optional and render UI conditionally.
  etaMinutes?: number;
  isVeg?: boolean;
  rating?: number;
  reviewCount?: number;
  /** From backend `minOrderQuantity`; cart API requires at least this many per line. */
  minOrderQuantity?: number;
  /** Sale unit from admin: piece, pack, set, kg, … */
  unit?: string;
  /** Pieces contained in one ordered unit (when unit is pack/box/set). */
  piecesPerSet?: number;
  /** First variant "set/pcs" label from admin (e.g. "6x100g"). */
  variantSetPieces?: string;
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
  /** Present when cart is backed by API (per-line tier). */
  priceOptionKey?: PriceOptionKey;
}

/** Cart row from `useCart` (API-backed). */
export interface CartLineItem extends CartItem {
  cartItemId: string;
  priceOptionKey: PriceOptionKey;
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
