/**
 * Format rupee amounts for UI (avoids float artifacts like 1.00000000007).
 */
export function formatRs(amount: unknown): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return rounded.toFixed(2);
}
