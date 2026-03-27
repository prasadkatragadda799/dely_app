export const themes = {
  fmcg: { primary: '#007BFF', bg: '#FFFFFF', accent: '#F0F8FF' },
  kitchen: { primary: '#10B981', bg: '#FFFFFF', accent: '#F0FFF0' },
  home: { primary: '#8B5CF6', bg: '#FFFFFF', accent: '#F3E8FF' },
  delivery: { primary: '#28A745', bg: '#FFFFFF', accent: '#E9F9EE' },
} as const;

export type ThemeKey = keyof typeof themes;
