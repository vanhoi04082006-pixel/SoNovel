import { useSyncExternalStore } from 'react';

/**
 * Theo dõi route đang hoạt động (root + lá sâu nhất) để các overlay toàn cục
 * (VD: FloatingMiniPlayer) biết khi nào ẩn/đổi vị trí mà không cần nằm trong navigator.
 */

export type NavInfo = { root: string; leaf: string };

let info: NavInfo = { root: 'Tabs', leaf: 'Home' };
const listeners = new Set<() => void>();

export function setNavInfo(next: NavInfo) {
  if (info.root === next.root && info.leaf === next.leaf) return;
  info = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useNavInfo(): NavInfo {
  return useSyncExternalStore(subscribe, () => info, () => info);
}

/** Tên route sâu nhất trong cây navigation state. */
function deepestName(state: any): string {
  if (!state?.routes?.length) return '';
  const idx = typeof state.index === 'number' ? state.index : state.routes.length - 1;
  const route = state.routes[idx];
  if (route?.state?.routes?.length) return deepestName(route.state);
  return route?.name ?? '';
}

/** Được gọi từ onStateChange của NavigationContainer. */
export function syncNavState(state: any) {
  if (!state?.routes?.length) return;
  const idx = typeof state.index === 'number' ? state.index : state.routes.length - 1;
  const root = state.routes[idx]?.name ?? 'Tabs';
  const leaf = deepestName(state) || root;
  setNavInfo({ root, leaf });
}
