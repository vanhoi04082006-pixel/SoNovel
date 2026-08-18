'use client'

import { useEffect, useState } from 'react'
import { Download, X, Headphones } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const DISMISS_KEY = 'sonovel-install-dismissed'

// PWA install prompt — hiển thị khi beforeinstallprompt fire + user chưa dismiss
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if already installed (standalone)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    if (standalone || (navigator as any).standalone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInstalled(true)
      return
    }

    // Check dismissed
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {}

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => {
      setInstalled(true)
      setShow(false)
      setDeferredPrompt(null)
      toast.success('Đã cài SoNovel!')
    }
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const onInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      toast.success('Đang cài SoNovel...')
    }
    setDeferredPrompt(null)
    setShow(false)
  }

  const onDismiss = () => {
    setShow(false)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
  }

  if (!show || installed) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md animate-fade-in-up">
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-background/95 backdrop-blur shadow-lg p-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Headphones className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Cài SoNovel</p>
          <p className="text-xs text-muted-foreground">Nghe truyện mọi lúc, kể cả offline</p>
        </div>
        <Button size="sm" onClick={onInstall} className="shrink-0">
          <Download className="h-4 w-4 mr-1" /> Cài
        </Button>
        <button onClick={onDismiss} className="shrink-0 p-1 text-muted-foreground hover:text-foreground" aria-label="Đóng">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
