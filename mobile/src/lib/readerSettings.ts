import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FontFamily = 'system' | 'serif' | 'sans' | 'mono';

type ReaderSettings = {
  fontSize: number;
  lineHeight: number;
  fontFamily: FontFamily;
};

const DEFAULT: ReaderSettings = { fontSize: 17, lineHeight: 1.7, fontFamily: 'system' };
const KEY = 'sonovel.readerSettings';

let state: ReaderSettings = DEFAULT;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function set(next: ReaderSettings) {
  state = next;
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  notify();
}

export async function initReaderSettings(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw);
      state = {
        fontSize: typeof v.fontSize === 'number' ? v.fontSize : DEFAULT.fontSize,
        lineHeight: typeof v.lineHeight === 'number' ? v.lineHeight : DEFAULT.lineHeight,
        fontFamily: (['system', 'serif', 'sans', 'mono'] as string[]).includes(v.fontFamily) ? v.fontFamily : DEFAULT.fontFamily,
      };
      notify();
    }
  } catch {}
}

export function useReaderSettings(): ReaderSettings {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
    () => state,
  );
}

export function setFontSize(n: number) {
  set({ ...state, fontSize: Math.min(32, Math.max(14, Math.round(n))) });
}
export function setLineHeight(n: number) {
  set({ ...state, lineHeight: Math.min(2.4, Math.max(1.3, n)) });
}
export function setFontFamily(f: FontFamily) {
  set({ ...state, fontFamily: f });
}
export function resetReaderSettings() {
  set({ ...DEFAULT });
}
