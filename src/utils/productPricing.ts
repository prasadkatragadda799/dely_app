import { PriceOptionKey, Product } from '../types';

export function defaultPriceTier(product: Product): PriceOptionKey {
  const k = product.priceOptions?.[0]?.key;
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
