import { useSyncExternalStore } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Theme manager — 4 theme light/dark/sepia/amoled, persist AsyncStorage,
 * sync user_settings.theme khi người dùng đổi. Theo dõi system color scheme.
 */

export type ThemeName = 'light' | 'dark' | 'sepia' | 'amoled';

export type GradientPair = [string, string];
export type GradientTriple = [string, string, string];

export type Theme = {
  name: ThemeName;
  // ----- Base colors -----
  bg: string;
  bgElevated: string;
  bgSubtle: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  textInvert: string;
  primary: string;
  primaryText: string;
  accent: string;
  danger: string;
  warning: string;
  success: string;
  overlay: string;
  shadow: string;
  // ----- Semantic soft tones -----
  primarySoft: string;
  primarySoftText: string;
  accentSoft: string;
  dangerSoft: string;
  successSoft: string;
  warningSoft: string;
  // ----- Gradients -----
  gradientPrimary: GradientPair;
  gradientPrimaryReverse: GradientPair;
  gradientHero: GradientTriple;
  gradientAccent: GradientPair;
  // ----- Shadows -----
  shadowSoft: object;
  shadowCard: object;
};

// ----- Static design tokens (không đổi theo theme) -----
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export const FONTS = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
  extrabold: 'BeVietnamPro_800ExtraBold',
} as const;

export const TYPO = {
  h1: { fontSize: 26, lineHeight: 32, fontFamily: FONTS.extrabold },
  h2: { fontSize: 22, lineHeight: 28, fontFamily: FONTS.bold },
  h3: { fontSize: 18, lineHeight: 24, fontFamily: FONTS.semibold },
  title: { fontSize: 16, lineHeight: 22, fontFamily: FONTS.semibold },
  body: { fontSize: 14, lineHeight: 20, fontFamily: FONTS.regular },
  bodySm: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.regular },
  label: { fontSize: 12, lineHeight: 16, fontFamily: FONTS.medium },
  caption: { fontSize: 11, lineHeight: 15, fontFamily: FONTS.medium },
} as const;

const LIGHT: Theme = {
  name: 'light',
  bg: '#fafafc',
  bgElevated: '#f2f2f6',
  bgSubtle: '#ececf2',
  surface: '#ffffff',
  border: '#e6e6ef',
  text: '#12131a',
  textMuted: '#6a6f7f',
  textInvert: '#ffffff',
  primary: '#7c3aed',
  primaryText: '#ffffff',
  accent: '#ec4899',
  danger: '#e11d48',
  warning: '#d97706',
  success: '#059669',
  overlay: 'rgba(18,19,26,0.5)',
  shadow: 'rgba(18,19,26,0.12)',
  primarySoft: '#f1e8fd',
  primarySoftText: '#6d28d9',
  accentSoft: '#fce7f3',
  dangerSoft: '#ffe4e6',
  successSoft: '#d1fae5',
  warningSoft: '#fef3c7',
  gradientPrimary: ['#8b5cf6', '#6d28d9'],
  gradientPrimaryReverse: ['#6d28d9', '#8b5cf6'],
  gradientHero: ['#7c3aed', '#a855f7', '#ec4899'],
  gradientAccent: ['#ec4899', '#f472b6'],
  shadowSoft: { shadowColor: 'rgba(18,19,26,0.08)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 2, elevation: 1 },
  shadowCard: { shadowColor: 'rgba(18,19,26,0.14)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 5 },
};

const DARK: Theme = {
  name: 'dark',
  bg: '#0c0e14',
  bgElevated: '#131722',
  bgSubtle: '#1b2030',
  surface: '#141926',
  border: '#262c40',
  text: '#f1f2f6',
  textMuted: '#98a0b5',
  textInvert: '#0c0e14',
  primary: '#a78bfa',
  primaryText: '#1a1030',
  accent: '#f472b6',
  danger: '#fb7185',
  warning: '#fbbf24',
  success: '#34d399',
  overlay: 'rgba(0,0,0,0.7)',
  shadow: 'rgba(0,0,0,0.5)',
  primarySoft: '#241a3d',
  primarySoftText: '#c4b5fd',
  accentSoft: '#341b2e',
  dangerSoft: '#3a1a22',
  successSoft: '#12352a',
  warningSoft: '#3a2f12',
  gradientPrimary: ['#a78bfa', '#7c3aed'],
  gradientPrimaryReverse: ['#7c3aed', '#a78bfa'],
  gradientHero: ['#6d28d9', '#a855f7', '#ec4899'],
  gradientAccent: ['#f472b6', '#c026d3'],
  shadowSoft: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 2, elevation: 1 },
  shadowCard: { shadowColor: 'rgba(0,0,0,0.6)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 5 },
};

const SEPIA: Theme = {
  name: 'sepia',
  bg: '#f6ecd8',
  bgElevated: '#efe2c6',
  bgSubtle: '#e8d9b8',
  surface: '#fbf3e0',
  border: '#ddc9a3',
  text: '#3b3226',
  textMuted: '#7a6a50',
  textInvert: '#3b3226',
  primary: '#a16207',
  primaryText: '#fff7e6',
  accent: '#c2410c',
  danger: '#b91c1c',
  warning: '#a16207',
  success: '#15803d',
  overlay: 'rgba(59,50,38,0.5)',
  shadow: 'rgba(59,50,38,0.18)',
  primarySoft: '#f3e3c0',
  primarySoftText: '#854d0e',
  accentSoft: '#fde4d0',
  dangerSoft: '#fde3e3',
  successSoft: '#dcf5e6',
  warningSoft: '#fbf0d3',
  gradientPrimary: ['#b45309', '#a16207'],
  gradientPrimaryReverse: ['#a16207', '#b45309'],
  gradientHero: ['#a16207', '#c2410c', '#d97706'],
  gradientAccent: ['#c2410c', '#ea580c'],
  shadowSoft: { shadowColor: 'rgba(59,50,38,0.12)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 2, elevation: 1 },
  shadowCard: { shadowColor: 'rgba(59,50,38,0.2)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 5 },
};

const AMOLED: Theme = {
  name: 'amoled',
  bg: '#000000',
  bgElevated: '#050507',
  bgSubtle: '#101014',
  surface: '#0a0a0c',
  border: '#1c1c22',
  text: '#f4f4f6',
  textMuted: '#8f8f9a',
  textInvert: '#000000',
  primary: '#a78bfa',
  primaryText: '#12081f',
  accent: '#f472b6',
  danger: '#fb7185',
  warning: '#fbbf24',
  success: '#34d399',
  overlay: 'rgba(0,0,0,0.82)',
  shadow: 'rgba(0,0,0,0.9)',
  primarySoft: '#1d1230',
  primarySoftText: '#c4b5fd',
  accentSoft: '#2a1220',
  dangerSoft: '#301116',
  successSoft: '#0d2c1e',
  warningSoft: '#2e2410',
  gradientPrimary: ['#a78bfa', '#7c3aed'],
  gradientPrimaryReverse: ['#7c3aed', '#a78bfa'],
  gradientHero: ['#6d28d9', '#a855f7', '#ec4899'],
  gradientAccent: ['#f472b6', '#c026d3'],
  shadowSoft: { shadowColor: 'rgba(0,0,0,0.9)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 2, elevation: 1 },
  shadowCard: { shadowColor: 'rgba(0,0,0,0.95)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 5 },
};

const THEMES: Record<ThemeName, Theme> = { light: LIGHT, dark: DARK, sepia: SEPIA, amoled: AMOLED };

let override: ThemeName | null = null;
let initialized = false;

function resolveTheme(): ThemeName {
  if (override) return override;
  const sys: ColorSchemeName = Appearance.getColorScheme() ?? 'light';
  return sys === 'dark' ? 'dark' : 'light';
}

let currentName: ThemeName = resolveTheme();
const listeners = new Set<() => void>();

Appearance.addChangeListener(() => {
  if (!override) {
    currentName = resolveTheme();
    listeners.forEach((l) => l());
  }
});

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): Theme {
  return THEMES[currentName];
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const THEME_STORAGE_KEY = 'sonovel.theme';

export async function initTheme(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const raw = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (raw && (raw === 'light' || raw === 'dark' || raw === 'sepia' || raw === 'amoled')) {
      override = raw as ThemeName;
      currentName = override;
      listeners.forEach((l) => l());
    }
  } catch {}
}

export function setTheme(name: ThemeName | null) {
  override = name;
  currentName = name ?? resolveTheme();
  listeners.forEach((l) => l());
  try {
    AsyncStorage.setItem(THEME_STORAGE_KEY, name ?? 'system').catch(() => {});
  } catch {}
}

export function getTheme(): Theme {
  return THEMES[currentName];
}

export function getThemeName(): ThemeName | null {
  return override;
}