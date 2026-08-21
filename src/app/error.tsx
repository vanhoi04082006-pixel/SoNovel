'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('SoNovel error boundary:', error)
  }, [error])
  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="max-w-lg w-full rounded-lg border p-6 text-center space-y-4">
        <h2 className="text-lg font-semibold">Đã xảy ra lỗi</h2>
        <p className="text-sm text-muted-foreground break-all">{error.message || 'Unknown error'}</p>
        {error.digest && <p className="text-xs text-muted-foreground">Digest: {error.digest}</p>}
        <pre className="text-xs text-left bg-muted p-3 rounded overflow-auto max-h-48">{error.stack?.slice(0, 2000) || ''}</pre>
        <button onClick={() => reset()} className="inline-flex h-9 px-4 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium">
          Thử lại
        </button>
      </div>
    </div>
  )
}
