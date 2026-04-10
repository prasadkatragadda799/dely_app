import { Product } from '../types';

type PackFields = Pick<Product, 'unit' | 'piecesPerSet' | 'variantSetPieces'>;

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
  // "piece" is already atomic; showing "12 pcs / piece" is misleading.
  if (u === 'piece') return null;
  if (pcs > 1) {
    return `${pcs} pcs / ${orderQuantityLabel(p.unit)}`;
  }
  return `Per ${orderQuantityLabel(p.unit)}`;
}

/** Detail / description line under price. */
export function packagingDetailLine(p: PackFields): string | null {
  const variant = p.variantSetPieces?.trim();
  if (variant) return `Packaging: ${variant}`;
  const pcs = Math.max(1, p.piecesPerSet ?? 1);
  const u = (p.unit || 'piece').toLowerCase();
  // Keep detail empty for single-piece sale units.
  if (u === 'piece') return null;
  if (pcs > 1) {
    return `${pcs} pieces per ${orderQuantityLabel(p.unit)}`;
  }
  return `Sold per ${orderQuantityLabel(p.unit)}`;
}

/** Cart line: quantity + total pieces when applicable. */
export function cartQuantityCaption(p: PackFields, qty: number): string {
  const plural = orderQuantityPlural(p.unit);
  const pcs = Math.max(1, p.piecesPerSet ?? 1);
  const u = (p.unit || 'piece').toLowerCase();
  if (pcs > 1 && u !== 'piece') {
    return `${qty} ${plural} (${qty * pcs} pcs)`;
  }
  return `${qty} ${plural}`;
}
