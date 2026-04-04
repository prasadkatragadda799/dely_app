import { Deal, Product } from '../../../types';

export interface ApiResponseEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: Record<string, unknown>;
}

type ProductApiEntity = {
  // Backend fields (from `GET /products`)
  id?: string;
  name?: string;
  slug?: string;
  sellingPrice?: number | string | null;
  mrp?: number | string | null;
  discount?: number | string | null; // percentage
  images?: Array<{ url?: string; isPrimary?: boolean }> | null;
  brand?: { id?: string; name?: string; logoUrl?: string } | string | null;
  company?: { id?: string; name?: string; logoUrl?: string } | string | null;
  category?: { id?: string; name?: string; slug?: string } | null;
  rating?: number | string | null;
  reviewCount?: number | string | null;
  reviews_count?: number | string | null;
  // Mobile/legacy fields
  _id?: string | number;
  title?: string;
  image?: string;
  image_url?: string;
  thumbnail?: string;
  division?: string;
  sub_category?: string;
  subCategory?: string;
  category_name?: string;
  price?: number | string;
  offer_price?: number | string;
  discount_percent?: number | string;
  discountPercent?: number | string;
  eta_minutes?: number | string;
  etaMinutes?: number | string;
  is_veg?: boolean;
  isVeg?: boolean;
  minOrderQuantity?: number | string | null;
  min_order_quantity?: number | string | null;
};

type OfferApiEntity = {
  // Backend fields (from `GET /offers`)
  id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  image?: string;
  validFrom?: string;
  validTo?: string;
  company?: { id?: string; name?: string };
  // Mobile/legacy fields
  _id?: string | number;
  headline?: string;
  color?: string;
  banner_color?: string;
  image_url?: string;
  image_fmcg?: string;
  image_home_kitchen?: string;
};

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const maybeAsNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined) return undefined;
  const n = asNumber(value, NaN);
  return Number.isFinite(n) ? n : undefined;
};

const normalizeCategory = (value?: string): Product['category'] => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('kitchen')) return 'kitchen';
  if (normalized.includes('home')) return 'home';
  return 'fmcg';
};

export const mapProductFromApi = (
  item: ProductApiEntity,
  index: number,
  requestedCategory?: Product['category'],
): Product => {
  const primaryImage =
    item.images?.find(img => img?.isPrimary)?.url ??
    item.images?.[0]?.url ??
    item.image ??
    item.image_url ??
    item.thumbnail ??
    '';

  const sellingPrice = item.sellingPrice ?? item.price ?? item.offer_price;
  const price = asNumber(sellingPrice, 0);

  const discountPercent =
    item.discount ?? item.discountPercent ?? item.discount_percent ?? 0;

  const brandName =
    typeof item.brand === 'string'
      ? item.brand
      : item.brand?.name ?? (typeof item.company === 'string' ? item.company : item.company?.name) ?? undefined;

  const subCategory =
    item.subCategory ??
    item.sub_category ??
    item.category?.name ??
    item.category_name ??
    undefined;

  return {
    id: String(item.id ?? item._id ?? `product-${index}`),
    name: String(item.name ?? item.title ?? 'Unnamed product'),
    image: String(primaryImage ?? ''),
    category: requestedCategory ?? normalizeCategory((item.category as any)?.slug ?? item.division),
    brand: brandName ? String(brandName) : undefined,
    subCategory: subCategory ? String(subCategory) : undefined,
    price,
    discountPercent: asNumber(discountPercent, 0),
    // Backend currently doesn't provide ETA / veg-flag in the `GET /products` response.
    // Keep them optional so UI can hide these pills when absent.
    etaMinutes: maybeAsNumber(item.eta_minutes ?? item.etaMinutes),
    isVeg:
      item.is_veg !== undefined
        ? Boolean(item.is_veg)
        : item.isVeg !== undefined
          ? Boolean(item.isVeg)
          : undefined,
    rating: maybeAsNumber(item.rating ?? item.reviewCount),
    reviewCount: maybeAsNumber(item.reviewCount ?? item.reviews_count),
    minOrderQuantity: Math.max(
      1,
      asNumber(item.minOrderQuantity ?? item.min_order_quantity ?? 1, 1),
    ),
  };
};

export const mapOfferFromApi = (item: OfferApiEntity, index: number): Deal => {
  return {
    id: String(item.id ?? item._id ?? `offer-${index}`),
    title: String(item.title ?? item.headline ?? 'Offer'),
    subtitle: String(item.subtitle ?? item.description ?? ''),
    color: String(item.color ?? item.banner_color ?? '#1D4ED8'),
    image: item.imageUrl ?? item.image ?? item.image_url,
    // Backend doesn't distinguish images per division; keep both fields for UI compatibility.
    imageFmcg: item.imageUrl ?? item.image ?? item.image_url,
    imageHomeKitchen: item.imageUrl ?? item.image ?? item.image_url,
  };
};
