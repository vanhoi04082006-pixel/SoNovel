import { useSyncExternalStore } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';

/**
 * Theme manager — 2 theme light/dark, không sync user_settings (theo §9).
 * Theo dõi system color scheme + cho phép override cứng bằng setTheme().
 */

export type ThemeName = 'light' | 'dark';

export type Theme = {
  name: ThemeName;
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
};

const LIGHT: Theme = {
  name: 'light',
  bg: '#ffffff',
  bgElevated: '#f7f7f8',
  bgSubtle: '#eef0f2',
  surface: '#ffffff',
  border: '#e2e5ea',
  text: '#0b0f17',
  textMuted: '#5b6473',
  textInvert: '#ffffff',
  primary: '#7c3aed',
  primaryText: '#ffffff',
  accent: '#ec4899',
  danger: '#dc2626',
  warning: '#d97706',
  success: '#059669',
  overlay: 'rgba(0,0,0,0.45)',
  shadow: 'rgba(15,23,42,0.12)',
};

const DARK: Theme = {
  name: 'dark',
  bg: '#0b0f17',
  bgElevated: '#131722',
  bgSubtle: '#1c2030',
  surface: '#131722',
  border: '#222738',
  text: '#f3f4f6',
  textMuted: '#9aa3b2',
  textInvert: '#0b0f17',
  primary: '#a78bfa',
  primaryText: '#0b0f17',
  accent: '#f472b6',
  danger: '#f87171',
  warning: '#fbbf24',
  success: '#34d399',
  overlay: 'rgba(0,0,0,0.65)',
  shadow: 'rgba(0,0,0,0.5)',
};

const THEMES: Record<ThemeName, Theme> = { light: LIGHT, dark: DARK };

let override: ThemeName | null = null;

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

export function setTheme(name: ThemeName | null) {
  override = name;
  currentName = name ?? resolveTheme();
  listeners.forEach((l) => l());
}

export function getTheme(): Theme {
  return THEMES[currentName];
}
