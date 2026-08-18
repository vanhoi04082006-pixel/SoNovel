import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client (hardcode credentials — không dùng .env theo §11).
 * Anon key là public, không phải secret.
 */
export const SUPABASE_URL = 'https://ysehlghdwodsovaxxwpx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZWhsZ2hkd29kc292YXh4d3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTc1MDksImV4cCI6MjEwMjYzMzUwOX0.gNvaSmbGeAELt0dkOms4q2wnORDvKxEE4jt6tSgDIZI';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: AsyncStorage.getItem.bind(AsyncStorage),
      setItem: AsyncStorage.setItem.bind(AsyncStorage),
      removeItem: AsyncStorage.removeItem.bind(AsyncStorage),
    } as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type { Session };
