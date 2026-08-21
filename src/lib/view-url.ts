// SoNovel — URL-sync nhẹ: chuyển ViewState ↔ location.hash (#/story/:id, #/search?q=...).
// Giúp: nút Back, refresh giữ màn hình, share deep-link, PWA shortcut.

import type { ViewState } from '@/store/use-app-store'

export function viewToHash(v: ViewState): string {
  switch (v.view) {
    case 'home':
      return '#/'
    case 'search': {
      const p = new URLSearchParams()
      if (v.q) p.set('q', v.q)
      if (v.genre) p.set('genre', v.genre)
      if (v.tag) p.set('tag', v.tag)
      if (v.sort) p.set('sort', v.sort)
      const qs = p.toString()
      return '#/search' + (qs ? `?${qs}` : '')
    }
    case 'story':
      return `#/story/${v.seriesId}`
    case 'reader':
      return `#/reader/${v.seriesId}/${v.chapterId}`
    case 'favorites':
      return '#/favorites'
    case 'history':
      return '#/history'
    case 'bookmarks':
      return '#/bookmarks'
    case 'profile':
      return '#/profile'
    case 'settings':
      return '#/settings'
    case 'about':
      return '#/about'
    case 'stats':
      return '#/stats'
    case 'login':
      return '#/login'
    case 'admin':
      return `#/admin${v.tab ? `/${v.tab}` : ''}${v.seriesId ? `/${v.seriesId}` : ''}`
    default:
      return '#/'
  }
}

const ADMIN_TABS = ['dashboard', 'seriesForm', 'seriesDetail', 'tags', 'users'] as const

export function hashToView(hash: string): ViewState | null {
  let h = hash.trim()
  if (h && !h.startsWith('#')) h = '#' + h
  if (!h || h === '#' || h === '#/') return { view: 'home' }

  const raw = h.slice(1)
  const [pathPart, queryPart] = raw.split('?')
  const segs = pathPart.split('/').filter(Boolean)
  const cmd = segs[0] || ''
  const q = new URLSearchParams(queryPart || '')

  switch (cmd) {
    case '':
    case 'home':
      return { view: 'home' }
    case 'search':
      return {
        view: 'search',
        q: q.get('q') || undefined,
        genre: q.get('genre') || undefined,
        tag: q.get('tag') || undefined,
        sort: q.get('sort') || undefined,
      }
    case 'story':
      return segs[1] ? { view: 'story', seriesId: segs[1] } : { view: 'home' }
    case 'reader':
      return segs[1] && segs[2] ? { view: 'reader', seriesId: segs[1], chapterId: segs[2] } : { view: 'home' }
    case 'favorites':
      return { view: 'favorites' }
    case 'history':
      return { view: 'history' }
    case 'bookmarks':
      return { view: 'bookmarks' }
    case 'profile':
      return { view: 'profile' }
    case 'settings':
      return { view: 'settings' }
    case 'about':
      return { view: 'about' }
    case 'stats':
      return { view: 'stats' }
    case 'login':
      return { view: 'login' }
    case 'admin': {
      const tab = segs[1] as (typeof ADMIN_TABS)[number] | undefined
      if (tab && (ADMIN_TABS as readonly string[]).includes(tab)) {
        return { view: 'admin', tab, seriesId: segs[2] }
      }
      return { view: 'admin', tab: 'dashboard' }
    }
    default:
      return { view: 'home' }
  }
}

export function buildShareUrl(view: ViewState): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${window.location.pathname}${viewToHash(view)}`
}
