'use client'

import { useState } from 'react'
import { Headphones, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'

export function LoginScreen() {
  const { navigate, refreshUser } = useAppStore()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Vui lòng nhập đủ email và mật khẩu.'); return }
    setLoading(true)
    try {
      if (mode === 'signup') {
        await api.signup(email, password)
        toast.success('Đăng ký thành công! Mời bạn đăng nhập.')
        setMode('login')
        setPassword('')
      } else {
        await api.login(email, password)
        await refreshUser()
        toast.success('Đăng nhập thành công!')
        navigate({ view: 'home' })
      }
    } catch (e) {
      setError((e as Error).message || 'Đã có lỗi xảy ra.')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (which: 'admin' | 'user') => {
    if (which === 'admin') { setEmail('admin@sonovel.app'); setPassword('admin123') }
    else { setEmail('user@sonovel.app'); setPassword('user123') }
    setMode('login')
  }

  return (
    <div className="bg-hero-soft min-h-screen">
      <div className="mx-auto max-w-md px-4 py-8 sm:py-12">
      <div className="flex flex-col items-center mb-6">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Headphones className="h-7 w-7" />
        </span>
        <h1 className="mt-3 text-2xl font-bold">SoNovel</h1>
        <p className="text-sm text-muted-foreground">
          {mode === 'login' ? 'Đăng nhập để lưu tiến độ nghe' : 'Tạo tài khoản miễn phí'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</CardTitle>
          <CardDescription>
            {mode === 'login' ? 'Dùng email và mật khẩu để đăng nhập.' : 'Nhập email và mật khẩu để tạo tài khoản.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban@email.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Mật khẩu</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {mode === 'login' ? <><LogIn className="h-4 w-4 mr-1" /> Đăng nhập</> : <><UserPlus className="h-4 w-4 mr-1" /> Đăng ký</>}
              {loading && '…'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'login' ? (
              <>Chưa có tài khoản?{' '}
                <button onClick={() => { setMode('signup'); setError('') }} className="text-primary hover:underline font-medium">Đăng ký</button>
              </>
            ) : (
              <>Đã có tài khoản?{' '}
                <button onClick={() => { setMode('login'); setError('') }} className="text-primary hover:underline font-medium">Đăng nhập</button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Tài khoản dùng thử:</p>
        <div className="flex flex-wrap gap-2 mt-1">
          <button onClick={() => fillDemo('admin')} className="rounded border border-border bg-card px-2 py-1 hover:border-primary">
            Quản trị: admin@sonovel.app / admin123
          </button>
          <button onClick={() => fillDemo('user')} className="rounded border border-border bg-card px-2 py-1 hover:border-primary">
            Người dùng: user@sonovel.app / user123
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
