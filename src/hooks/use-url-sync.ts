'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/use-app-store'
import { hashToView } from '@/lib/view-url'

// Đồng bộ location.hash → view store:
// - Khi load/refresh: đọc hash khôi phục màn hình
// - Khi bấm Back/Forward trình duyệt (hashchange): cập nhật view
export function useUrlSync() {
  useEffect(() => {
    const apply = (hash: string) => {
      const v = hashToView(hash)
      if (v) {
        const cur = useAppStore.getState().view
        if (cur.view !== v.view || JSON.stringify(cur) !== JSON.stringify(v)) {
          useAppStore.setState({ view: v })
        }
      }
    }
    apply(window.location.hash)
    const onHash = () => apply(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
}
