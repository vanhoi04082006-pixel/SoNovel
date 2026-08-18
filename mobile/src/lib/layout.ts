import { useSyncExternalStore } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Track app state (active/background/inactive) — dùng để biết khi nào app bị background
 * và foreground service vẫn phát. JS progress save tiếp tục chạy nhờ foreground service.
 */
let appState: AppStateStatus = AppState.currentState;
const listeners = new Set<() => void>();

AppState.addEventListener('change', (next) => {
  appState = next;
  listeners.forEach((l) => l());
});

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): AppStateStatus {
  return appState;
}

export function useAppState(): AppStateStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
