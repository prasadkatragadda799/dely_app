// ─────────────────────────────────────────────────────────────────────────────
// DelyCart Design System — "Clean & airy premium"
// Division theming: Food-FMCG = blue, Home & Kitchen = green.
// Single source of truth for color, spacing, radius, typography and elevation.
// Screens should import from here instead of hardcoding hex values.
// ─────────────────────────────────────────────────────────────────────────────

export type ThemeKey = 'fmcg' | 'kitchen' | 'home' | 'delivery';
export type DivisionKey = 'fmcg' | 'homeKitchen';

// ─── Neutral palette (slate-based foundation) ───
export const palette = {
  white: '#FFFFFF',
  ink: '#0F172A', // primary headings / strong text
  body: '#334155', // body copy
  muted: '#64748B', // secondary text
  faint: '#94A3B8', // tertiary text / placeholders
  line: '#E2E8F0', // standard borders
  lineSoft: '#EEF2F6', // subtle dividers
  surface: '#FFFFFF', // cards / sheets
  surfaceAlt: '#F8FAFC', // inset fields / inner tiles
  bg: '#F4F7FB', // app background (clean cool grey)

  // semantic
  success: '#16A34A',
  successDeep: '#166534',
  successBg: '#F0FDF4',
  successBorder: '#86EFAC',
  warning: '#D97706',
  warningDeep: '#92400E',
  warningBg: '#FEF3C7',
  warningBorder: '#FCD34D',
  danger: '#DC2626',
  dangerDeep: '#991B1B',
  dangerBg: '#FEE2E2',
  dangerBorder: '#FCA5A5',
  star: '#F59E0B',
} as const;

// ─── Division accent ramps ───
export type DivisionPalette = {
  primary: string;
  primaryDark: string;
  primaryDeep: string; // readable accent text on light surfaces
  onPrimary: string;
  soft: string; // ~10% tint fill
  softer: string; // ~6% tint fill
  border: string; // translucent accent border
  tint: string; // very light solid wash backgrounds
  heroFrom: string;
  heroTo: string;
};

export const divisionTheme: Record<DivisionKey, DivisionPalette> = {
  fmcg: {
    primary: '#3B82F6',
    primaryDark: '#2563EB',
    primaryDeep: '#1E40AF',
    onPrimary: '#FFFFFF',
    soft: 'rgba(59,130,246,0.10)',
    softer: 'rgba(59,130,246,0.06)',
    border: 'rgba(59,130,246,0.20)',
    tint: '#EFF5FF',
    heroFrom: '#3B82F6',
    heroTo: '#2563EB',
  },
  homeKitchen: {
    primary: '#22C55E',
    primaryDark: '#16A34A',
    primaryDeep: '#15803D',
    onPrimary: '#FFFFFF',
    soft: 'rgba(34,197,94,0.10)',
    softer: 'rgba(34,197,94,0.06)',
    border: 'rgba(34,197,94,0.20)',
    tint: '#EFFBF3',
    heroFrom: '#22C55E',
    heroTo: '#16A34A',
  },
};

/** Resolve a division accent palette from a division key (defaults to FMCG). */
export function getDivision(division?: string | null): DivisionPalette {
  return division === 'homeKitchen'
    ? divisionTheme.homeKitchen
    : divisionTheme.fmcg;
}

// ─── Spacing scale (4-pt rhythm) ───
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ─── Corner radii ───
export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 999,
} as const;

// ─── Typography presets ───
export const typography = {
  display: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  h1: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '800' as const, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '800' as const },
  title: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '500' as const },
  bodyStrong: { fontSize: 14, fontWeight: '700' as const },
  caption: { fontSize: 12, fontWeight: '600' as const },
  micro: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
  },
} as const;

// ─── Elevation presets (soft, airy shadows) ───
export const shadow = {
  xs: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 10,
  },
  // accent-tinted glow for primary buttons
  accent: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  }),
} as const;

// ─── Legacy export (kept for backward compatibility) ───
// Older screens import `themes`; keep the shape but align colors to the system.
export const themes = {
  fmcg: { primary: '#2563EB', bg: '#FFFFFF', accent: '#EFF5FF' },
  kitchen: { primary: '#16A34A', bg: '#FFFFFF', accent: '#EFFBF3' },
  home: { primary: '#16A34A', bg: '#FFFFFF', accent: '#EFFBF3' },
  delivery: { primary: '#16A34A', bg: '#FFFFFF', accent: '#EFFBF3' },
} as const;
