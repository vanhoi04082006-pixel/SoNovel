import { useSyncExternalStore } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Auth store dùng useSyncExternalStore + onAuthStateChange.
 * Bất kỳ component nào cũng có thể subscribe qua `useAuth()`.
 */

type AuthState = {
  session: Session | null;
  ready: boolean;
};

let state: AuthState = { session: null, ready: false };
const listeners = new Set<() => void>();

let initialized = false;

function set(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): AuthState {
  return state;
}

export function initSession() {
  if (initialized) return;
  initialized = true;

  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      set({ session: null, ready: true });
      return;
    }
    set({ session: data.session, ready: true });
  }).catch(() => {
    set({ session: null, ready: true });
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    set({ session, ready: true });
  });
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getUserId(): string | null {
  return state.session?.user?.id ?? null;
}

export function isLoggedIn(): boolean {
  return !!state.session;
}

// ---------- Email/password auth wrappers (§5.1) ----------

export async function signUp(email: string, password: string): Promise<{ session: Session | null; needsConfirm: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // Nếu Supabase bật email confirm → data.session là null, user phải xác thực rồi mới đăng nhập được.
  return { session: data.session ?? null, needsConfirm: !data.session };
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
