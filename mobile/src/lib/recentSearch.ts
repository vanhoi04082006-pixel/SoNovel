import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sonovel.recentSearches';
const MAX = 8;

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX) : [];
  } catch (_e) {
    return [];
  }
}

export async function addRecentSearch(q: string): Promise<void> {
  const trimmed = q.trim();
  if (!trimmed) return;
  try {
    const cur = await getRecentSearches();
    const next = [trimmed, ...cur.filter((x) => x !== trimmed)].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (_e) {}
}

export async function removeRecentSearch(q: string): Promise<void> {
  try {
    const cur = await getRecentSearches();
    const next = cur.filter((x) => x !== q);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (_e) {}
}

export async function clearRecentSearches(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch (_e) {}
}
