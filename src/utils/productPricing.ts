import { PriceOptionKey, Product } from '../types';

/**
 * Product is sold in fixed packs (e.g. 12 soaps) while `unit` may still be "piece" in the API.
 * Used for UI copy ("set") when the cart line is stored as `unit` with qty = n × piecesPerSet.
 */
export function productImpliesSetPurchase(
  p: Pick<Product, 'piecesPerSet' | 'minOrderQuantity' | 'unit' | 'priceOptions'>,
): boolean {
  if (p.priceOptions?.some(o => o.key === 'set')) {
    return true;
  }
  const pcs = Math.max(1, p.piecesPerSet ?? 1);
  if (pcs <= 1) {
    return false;
  }
  const minO = Math.max(1, Math.trunc(Number(p.minOrderQuantity) || 1));
  const u = (p.unit || 'piece').toLowerCase();
  return u === 'piece' && minO >= pcs && minO % pcs === 0;
}

/** Tier to use for quantity labels / toasts when API tier is `unit` but packs are counted as sets. */
export function uiTierForQuantityCopy(
  p: Pick<Product, 'piecesPerSet' | 'minOrderQuantity' | 'unit' | 'priceOptions'>,
  apiTier: PriceOptionKey,
): PriceOptionKey {
  if (apiTier === 'set' || apiTier === 'remaining') {
    return apiTier;
  }
  if (apiTier === 'unit' && productImpliesSetPurchase(p)) {
    return 'set';
  }
  return apiTier;
}

export function defaultPriceTier(product: Product): PriceOptionKey {
  const opts = product.priceOptions ?? [];
  const keys = new Set(
    opts.map(o => o.key).filter((k): k is PriceOptionKey => k === 'unit' || k === 'set' || k === 'remaining'),
  );
  const pcs = Math.max(1, product.piecesPerSet ?? 1);
  const u = (product.unit || 'piece').toLowerCase();
  // Prefer "set" when admin configured multi-piece sets or unit is literally "set"
  // so the cart counts sets (1, 2, …) instead of defaulting to per-piece "unit".
  if (keys.has('set') && (pcs > 1 || u === 'set')) {
    return 'set';
  }
  if (keys.has('set') && opts.length === 1) {
    return 'set';
  }
  const k = opts[0]?.key;
  if (k === 'unit' || k === 'set' || k === 'remaining') {
    return k;
  }
  return 'unit';
}

export function priceTierLabel(key: string): string {
  switch (key) {
    case 'set':
      return 'Set';
    case 'remaining':
      return 'Remaining';
    default:
      return 'Unit';
  }
}

export function selectedPriceOption(product: Product, tier: PriceOptionKey) {
  const opts = product.priceOptions;
  const match = opts?.find(o => o.key === tier);
  if (match) {
    return match;
  }
  return opts?.[0];
}
