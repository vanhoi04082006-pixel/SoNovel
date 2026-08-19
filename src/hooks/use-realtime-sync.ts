'use client'

import { useEffect } from 'react'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import { useAppStore } from '@/store/use-app-store'

// Đồng bộ realtime 2 chiều web ↔ app qua Supabase Realtime.
// Khi app (mobile) hoặc tab khác ghi vào progress/favorites/history/bookmarks/settings,
// web sẽ nhận sự kiện postgres_changes và bumpSync() → các màn hình tự refetch.
export function useRealtimeSync() {
  useEffect(() => {
    const supabase = createBrowserSupabase()
    let channel: ReturnType<typeof supabase.channel> | null = null

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      channel?.unsubscribe?.()
      channel = null
      if (!user) return

      const filter = `user_id=eq.${user.id}`
      const bump = () => useAppStore.getState().bumpSync()
      const onPostgres = (table: string) => ({
        event: '*' as const,
        schema: 'public',
        table,
        filter,
      })

      channel = supabase.channel('soNovel-sync')
        .on('postgres_changes', onPostgres('progress'), bump)
        .on('postgres_changes', onPostgres('favorites'), bump)
        .on('postgres_changes', onPostgres('history'), bump)
        .on('postgres_changes', onPostgres('bookmarks'), bump)
        .on('postgres_changes', onPostgres('user_settings'), bump)
        .subscribe()
    }

    setup()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setup()
    })

    return () => {
      channel?.unsubscribe?.()
      subscription?.unsubscribe?.()
    }
  }, [])
}
