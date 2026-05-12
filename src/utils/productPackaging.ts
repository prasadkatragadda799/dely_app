import { PriceOptionKey, Product } from '../types';
import { productImpliesSetPurchase } from './productPricing';

type PackFields = Pick<Product, 'unit' | 'piecesPerSet' | 'variantSetPieces'>;

/** Catalog fields needed to interpret a cart line (e.g. set vs loose pieces). */
type CartCaptionCatalog = Pick<
  Product,
  'unit' | 'piecesPerSet' | 'variantSetPieces' | 'priceOptions' | 'minOrderQuantity'
>;

export function orderQuantityLabel(unit?: string): string {
  const u = (unit || 'piece').toLowerCase();
  const map: Record<string, string> = {
    piece: 'piece',
    pack: 'pack',
    box: 'box',
    set: 'set',
    kg: 'kg',
    gram: 'g',
    liter: 'L',
    bottle: 'bottle',
  };
  return map[u] ?? u;
}

export function quantityStepperTitle(unit?: string): string {
  return `Quantity (${orderQuantityPlural(unit)})`;
}

export function orderQuantityPlural(unit?: string): string {
  const u = (unit || 'piece').toLowerCase();
  if (u === 'piece' || u === 'pcs') return 'pieces';
  if (u === 'pack') return 'packs';
  if (u === 'box') return 'boxes';
  if (u === 'set') return 'sets';
  if (u === 'kg' || u === 'kilogram') return 'kg';
  if (u === 'gram' || u === 'g') return 'grams';
  if (u === 'liter' || u === 'l') return 'liters';
  if (u === 'bottle') return 'bottles';
  return `${u}s`;
}

/** Short line for list cards (price row). */
export function packagingShortLine(p: PackFields): string | null {
  const variant = p.variantSetPieces?.trim();
  if (variant) return variant;
  const pcs = Math.max(1, p.piecesPerSet ?? 1);
  const u = (p.unit || 'piece').toLowerCase();
  if (pcs > 1) {
    // For piece units say "Pack of 12"; for others say "12 pcs / pack" etc.
    if (u === 'piece') return `Pack of ${pcs}`;
    return `${pcs} pcs / ${orderQuantityLabel(p.unit)}`;
  }
  if (u === 'piece') return null;
  return `Per ${orderQuantityLabel(p.unit)}`;
}

/** Detail / description line under price. */
export function packagingDetailLine(p: PackFields): string | null {
  const variant = p.variantSetPieces?.trim();
  if (variant) return `Packaging: ${variant}`;
  const pcs = Math.max(1, p.piecesPerSet ?? 1);
  const u = (p.unit || 'piece').toLowerCase();
  if (pcs > 1) {
    if (u === 'piece') return `Pack of ${pcs} pieces`;
    return `${pcs} pieces per ${orderQuantityLabel(p.unit)}`;
  }
  if (u === 'piece') return null;
  return `Sold per ${orderQuantityLabel(p.unit)}`;
}

/** Cart line label: respects API price tier (set = count sets, not loose pieces). */
export function cartQuantityCaption(
  p: PackFields,
  qty: number,
  priceOptionKey?: PriceOptionKey,
): string {
  if (priceOptionKey === 'set') {
    return qty === 1 ? '1 set' : `${qty} sets`;
  }
  if (priceOptionKey === 'remaining') {
    return qty === 1 ? '1 lot' : `${qty} lots`;
  }
  const plural = orderQuantityPlural(p.unit);
  const pcs = Math.max(1, p.piecesPerSet ?? 1);
  const u = (p.unit || 'piece').toLowerCase();
  if (pcs > 1 && u !== 'piece') {
    const label = qty === 1 ? orderQuantityLabel(p.unit) : plural;
    return `${qty} ${label} (${qty * pcs} pcs)`;
  }
  return `${qty} ${plural}`;
}

/** Map stored cart line to display tier/qty (e.g. 12 × unit → 1 × set). */
export function displayTierAndQtyForLine(
  catalog: CartCaptionCatalog,
  lineQty: number,
  lineTier: PriceOptionKey,
): { tier: PriceOptionKey; qty: number } {
  const pcs = Math.max(1, catalog.piecesPerSet ?? 1);
  const minO = Math.max(1, Math.trunc(Number(catalog.minOrderQuantity) || 1));
  // When piecesPerSet is 1 but minOrderQuantity > 1, the effective pack size is
  // minOrderQuantity (e.g. min 12 pieces → 1 set = 12 pcs).
  const effectivePcs = pcs > 1 ? pcs : minO > 1 ? minO : 1;
  const isSetProduct =
    catalog.priceOptions?.some(o => o.key === 'set') ||
    productImpliesSetPurchase(catalog);
  const treatAsSet =
    isSetProduct &&
    lineTier === 'unit' &&
    effectivePcs > 1 &&
    lineQty >= effectivePcs &&
    lineQty % effectivePcs === 0;
  if (treatAsSet) {
    return { tier: 'set', qty: lineQty / effectivePcs };
  }
  return { tier: lineTier, qty: lineQty };
}

/**
 * Cart line label using full catalog context. If the API stored a "set" purchase as
 * `unit` with quantity = n × piecesPerSet, show "n sets" when a set tier exists
 * or the product is sold as fixed packs (min order aligns with piecesPerSet).
 */
export function cartLineQuantityCaption(
  catalog: CartCaptionCatalog,
  lineQty: number,
  lineTier: PriceOptionKey,
): string {
  const { tier, qty } = displayTierAndQtyForLine(catalog, lineQty, lineTier);
  return cartQuantityCaption(catalog, qty, tier);
}

/** Stepper center text for a cart line (cards, lists). */
export function stepperQuantityCaptionForCartLine(
  catalog: CartCaptionCatalog,
  lineQty: number,
  lineTier: PriceOptionKey,
): string {
  const { tier, qty } = displayTierAndQtyForLine(catalog, lineQty, lineTier);
  return stepperQuantityCaption(catalog, qty, tier);
}

/** Min order line for product detail (e.g. "1 set" when 12 pcs = 1 pack). */
export function minOrderCaption(
  p: Pick<Product, 'minOrderQuantity' | 'piecesPerSet' | 'unit' | 'priceOptions'>,
  uiTier: PriceOptionKey,
): string {
  const minO = Math.max(1, Math.trunc(Number(p.minOrderQuantity) || 1));
  const pcs = Math.max(1, p.piecesPerSet ?? 1);
  if (uiTier === 'set' && pcs > 1 && minO % pcs === 0) {
    const sets = minO / pcs;
    return sets === 1 ? '1 set' : `${sets} sets`;
  }
  return `${minO} ${quantityLabelForTier(uiTier, p.unit)}`;
}

/** Stepper / quantity UI copy for the selected price tier. */
export function quantityLabelForTier(
  tier: PriceOptionKey,
  unit?: string,
): string {
  if (tier === 'set') return 'sets';
  if (tier === 'remaining') return 'lots';
  return orderQuantityPlural(unit);
}

export function quantityStepperTitleForTier(
  tier: PriceOptionKey,
  unit?: string,
): string {
  return `Quantity (${quantityLabelForTier(tier, unit)})`;
}

/**
 * Label between − / + on cards and detail. For set (or lot) tiers, show "1 set" not a raw piece count.
 */
export function stepperQuantityCaption(
  p: PackFields,
  qty: number,
  priceOptionKey: PriceOptionKey,
): string {
  if (priceOptionKey === 'set') {
    return qty === 1 ? '1 set' : `${qty} sets`;
  }
  if (priceOptionKey === 'remaining') {
    return qty === 1 ? '1 lot' : `${qty} lots`;
  }
  const plural = orderQuantityPlural(p.unit);
  const pcs = Math.max(1, p.piecesPerSet ?? 1);
  const u = (p.unit || 'piece').toLowerCase();
  if (pcs > 1 && u === 'piece') {
    return qty === 1 ? '1 piece' : `${qty} pieces`;
  }
  if (pcs > 1 && u !== 'piece') {
    const label = qty === 1 ? orderQuantityLabel(p.unit) : plural;
    return `${qty} ${label}`;
  }
  return String(qty);
}
