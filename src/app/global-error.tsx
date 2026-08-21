'use client'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body>
        <div className="min-h-screen grid place-items-center p-6">
          <div className="max-w-lg w-full rounded-lg border p-6 text-center space-y-4">
            <h2 className="text-lg font-semibold">Lỗi nghiêm trọng</h2>
            <p className="text-sm text-muted-foreground break-all">{error.message}</p>
            <pre className="text-xs text-left bg-muted p-3 rounded overflow-auto max-h-48">{error.stack?.slice(0, 2000) || ''}</pre>
            <button onClick={() => reset()} className="inline-flex h-9 px-4 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm">Thử lại</button>
          </div>
        </div>
      </body>
    </html>
  )
}
