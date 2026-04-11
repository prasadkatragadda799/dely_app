import {
  Deal,
  PriceOptionKey,
  Product,
  ProductPriceOption,
  ProductSpecifications,
} from '../../../types';

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
  slug?: string | null;
  sellingPrice?: number | string | null;
  mrp?: number | string | null;
  discount?: number | string | null; // percentage
  images?: Array<{
    url?: string;
    imageUrl?: string;
    image_url?: string;
    isPrimary?: boolean;
    is_primary?: boolean;
  }> | null;
  brand?:
    | { id?: string; name?: string; logoUrl?: string; logo_url?: string }
    | string
    | null;
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
  unit?: string | null;
  piecesPerSet?: number | string | null;
  pieces_per_set?: number | string | null;
  variantSetPieces?: string | null;
  variants?: Array<{
    packagingLabel?: string | null;
    packaging_label?: string | null;
    packagingLabelType?: string | null;
    packaging_label_type?: string | null;
    setPieces?: string | null;
    set_pcs?: string | null;
    weight?: string | null;
  }> | null;
  priceOptions?: Array<{
    key?: string;
    label?: string;
    sellingPrice?: number | string | null;
    mrp?: number | string | null;
    discount?: number | string | null;
  }> | null;
  price_options?: Array<{
    key?: string;
    label?: string;
    sellingPrice?: number | string | null;
    selling_price?: number | string | null;
    mrp?: number | string | null;
    discount?: number | string | null;
  }> | null;
  description?: string | null;
  specifications?: Record<string, unknown> | null;
  stockQuantity?: number | string | null;
  stock_quantity?: number | string | null;
  isAvailable?: boolean | null;
  is_available?: boolean | null;
};

function normalizeSpecifications(raw: unknown): ProductSpecifications | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: ProductSpecifications = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === null || v === undefined) {
      out[k] = null;
    } else if (
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean'
    ) {
      out[k] = v;
    } else if (typeof v === 'object') {
      try {
        out[k] = JSON.stringify(v);
      } catch {
        out[k] = String(v);
      }
    } else {
      out[k] = String(v);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

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

const normalizeTierKey = (raw?: string | null): PriceOptionKey | null => {
  const k = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (k === 'unit' || k === 'set' || k === 'remaining') {
    return k;
  }
  return null;
};

const PACKAGING_TYPE_LABELS: Record<string, string> = {
  set: 'Set',
  pieces: 'Pieces',
  pack: 'Pack',
  unit: 'Unit',
  pair: 'Pair',
  dozen: 'Dozen',
};

/** First variant packaging line for cards (matches backend format_variant_packaging_line). */
export function composeVariantPackagingFromApi(v: {
  packagingLabel?: string | null;
  packaging_label?: string | null;
  packagingLabelType?: string | null;
  packaging_label_type?: string | null;
  setPieces?: string | null;
  set_pcs?: string | null;
  weight?: string | null;
}): string | undefined {
  const pl = String(v.packagingLabel ?? v.packaging_label ?? '').trim();
  if (pl) return pl;
  const type = String(v.packagingLabelType ?? v.packaging_label_type ?? '')
    .trim()
    .toLowerCase();
  const head = type && PACKAGING_TYPE_LABELS[type] ? PACKAGING_TYPE_LABELS[type] : '';
  const detail = String(v.setPieces ?? v.set_pcs ?? '').trim();
  const w = String(v.weight ?? '').trim();
  const parts: string[] = [];
  if (head && detail) parts.push(`${head}: ${detail}`);
  else if (head) parts.push(head);
  else if (detail) parts.push(detail);
  if (w) parts.push(w);
  const line = parts.join(' · ');
  return line || undefined;
}

const mapPriceOptionsFromApi = (item: ProductApiEntity): ProductPriceOption[] | undefined => {
  const raw = item.priceOptions ?? item.price_options;
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  const out: ProductPriceOption[] = [];
  for (const row of raw) {
    const key = normalizeTierKey(row?.key);
    if (!key) {
      continue;
    }
    const rawSell =
      row && typeof row === 'object' && 'sellingPrice' in row
        ? (row as { sellingPrice?: unknown }).sellingPrice
        : row && typeof row === 'object' && 'selling_price' in row
          ? (row as { selling_price?: unknown }).selling_price
          : undefined;
    const sp = asNumber(rawSell, NaN);
    const mrpVal = asNumber(row.mrp, NaN);
    if (!Number.isFinite(sp) || !Number.isFinite(mrpVal)) {
      continue;
    }
    out.push({
      key,
      label: row.label != null && String(row.label).trim() ? String(row.label) : key,
      sellingPrice: sp,
      mrp: mrpVal,
      discount: Number.isFinite(asNumber(row.discount, NaN))
        ? asNumber(row.discount, 0)
        : undefined,
    });
  }
  return out.length ? out : undefined;
};

export const mapProductFromApi = (
  item: ProductApiEntity,
  index: number,
  requestedCategory?: Product['category'],
): Product => {
  const galleryFromApi = Array.isArray(item.images)
    ? item.images
        .map(img => img?.url ?? img?.imageUrl ?? img?.image_url ?? '')
        .map(v => String(v).trim())
        .filter(Boolean)
    : [];
  const dedupedGallery = Array.from(new Set(galleryFromApi));
  const primaryFromApi = Array.isArray(item.images)
    ? item.images.find(img => Boolean(img?.isPrimary ?? img?.is_primary))
    : undefined;
  const primaryImage =
    (primaryFromApi?.url ?? primaryFromApi?.imageUrl ?? primaryFromApi?.image_url) ??
    dedupedGallery[0] ??
    item.image ??
    item.image_url ??
    item.thumbnail ??
    '';
  const gallery = [
    String(primaryImage || '').trim(),
    ...dedupedGallery.filter(url => url !== String(primaryImage || '').trim()),
  ].filter(Boolean);

  const priceOptions = mapPriceOptionsFromApi(item);
  const firstOpt = priceOptions?.[0];
  const sellingPrice =
    firstOpt != null
      ? firstOpt.sellingPrice
      : item.sellingPrice ?? item.price ?? item.offer_price;
  const price = asNumber(sellingPrice, 0);

  const discountPercent =
    firstOpt != null && firstOpt.discount != null
      ? asNumber(firstOpt.discount, 0)
      : item.discount ?? item.discountPercent ?? item.discount_percent ?? 0;

  const brandName =
    typeof item.brand === 'string'
      ? item.brand
      : item.brand?.name ?? (typeof item.company === 'string' ? item.company : item.company?.name) ?? undefined;

  const brandLogoUrl =
    typeof item.brand === 'object' && item.brand !== null
      ? String(item.brand.logoUrl ?? item.brand.logo_url ?? '').trim() || undefined
      : undefined;

  const subCategory =
    item.subCategory ??
    item.sub_category ??
    item.category?.name ??
    item.category_name ??
    undefined;

  const shopCategoryId =
    item.category !== null &&
    typeof item.category === 'object' &&
    item.category?.id != null &&
    String(item.category.id).trim() !== ''
      ? String(item.category.id)
      : undefined;

  const categoryLabel =
    typeof item.category === 'object' && item.category?.name
      ? String(item.category.name)
      : undefined;

  const companyName =
    typeof item.company === 'string'
      ? item.company
      : item.company?.name
        ? String(item.company.name)
        : undefined;

  const description =
    item.description != null && String(item.description).trim()
      ? String(item.description).trim()
      : undefined;

  const slug =
    item.slug != null && String(item.slug).trim()
      ? String(item.slug).trim()
      : undefined;

  const specifications = normalizeSpecifications(item.specifications);

  const stockQtyRaw = item.stockQuantity ?? item.stock_quantity;
  const stockQuantity =
    stockQtyRaw !== undefined && stockQtyRaw !== null
      ? Math.max(0, asNumber(stockQtyRaw, 0))
      : undefined;

  const isAvailable =
    item.isAvailable !== undefined
      ? Boolean(item.isAvailable)
      : item.is_available !== undefined
        ? Boolean(item.is_available)
        : undefined;

  const variants = Array.isArray(item.variants) ? item.variants : [];
  let variantSetPieces: string | undefined;
  for (const v of variants) {
    const line = composeVariantPackagingFromApi(v);
    if (line) {
      variantSetPieces = line;
      break;
    }
  }

  return {
    id: String(item.id ?? item._id ?? `product-${index}`),
    name: String(item.name ?? item.title ?? 'Unnamed product'),
    image: String(primaryImage ?? ''),
    images: gallery,
    category: requestedCategory ?? normalizeCategory((item.category as any)?.slug ?? item.division),
    brand: brandName ? String(brandName) : undefined,
    brandLogoUrl,
    subCategory: subCategory ? String(subCategory) : undefined,
    shopCategoryId,
    categoryLabel,
    slug,
    description,
    specifications,
    companyName,
    stockQuantity,
    isAvailable,
    price,
    discountPercent: asNumber(discountPercent, 0),
    priceOptions,
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
    unit: item.unit != null && String(item.unit).trim() ? String(item.unit) : 'piece',
    piecesPerSet: Math.max(
      1,
      asNumber(item.piecesPerSet ?? item.pieces_per_set ?? 1, 1),
    ),
    variantSetPieces: item.variantSetPieces?.trim()
      ? String(item.variantSetPieces).trim()
      : variantSetPieces,
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
