'use client'

import { useEffect, useState } from 'react'
import { Headphones, BookOpen, Github, Heart, ChevronLeft, Sparkles, Shield, Zap, Smartphone, Apple, MonitorDown } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

function DownloadAppCard() {
  const [apkUrl, setApkUrl] = useState('')
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [showPcHelp, setShowPcHelp] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.getSiteSetting('android_apk_url')
      .then((r) => { if (!cancelled && r.value) setApkUrl(r.value) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const installPwa = async () => {
    try {
      const dp = (window as any).__sonovelInstallPrompt
      if (dp) {
        dp.prompt()
        const { outcome } = await dp.userChoice
        if (outcome === 'accepted') toast.success('Đang cài SoNovel...')
        ;(window as any).__sonovelInstallPrompt = null
        return true
      }
    } catch {}
    return false
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Tải ứng dụng</CardTitle></CardHeader>
      <CardContent className="space-y-2.5">
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Smartphone className="h-5 w-5" /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Android (APK riêng)</p>
            <p className="text-xs text-muted-foreground">Nghe nền, điều khiển từ màn hình khóa</p>
          </div>
          {apkUrl ? (
            <a href={apkUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm">Tải về</Button>
            </a>
          ) : (
            <Button size="sm" disabled>Chưa có link</Button>
          )}
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Apple className="h-5 w-5" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">iPhone (PWA)</p>
              <p className="text-xs text-muted-foreground">Cài từ trình duyệt, không cần App Store</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowIosHelp((v) => !v)}>Cách cài</Button>
          </div>
          {showIosHelp && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Mở trang này bằng <b>Safari</b>.</li>
              <li>Bấm nút <b>Chia sẻ</b> (hình vuông có mũi tên) ở thanh công cụ.</li>
              <li>Chọn <b>“Thêm vào Màn hình chính”</b> → <b>Thêm</b>.</li>
            </ol>
          )}
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><MonitorDown className="h-5 w-5" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Máy tính (PWA)</p>
              <p className="text-xs text-muted-foreground">Cài từ Chrome/Edge, chạy như app desktop</p>
            </div>
            <Button size="sm" variant="outline" onClick={async () => {
              const ok = await installPwa()
              if (!ok) setShowPcHelp((v) => !v)
            }}>Cài ngay</Button>
          </div>
          {showPcHelp && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Mở trang này bằng <b>Chrome</b> hoặc <b>Edge</b> trên máy tính.</li>
              <li>Bấm biểu tượng <b>Cài đặt</b> trên thanh địa chỉ, hoặc menu ⋮ → <b>“Cài đặt SoNovel…”</b>.</li>
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function AboutScreen() {
  const { navigate } = useAppStore()

  return (
    <div className="mx-auto max-w-2xl px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate({ view: 'home' })} className="-ml-2">
        <ChevronLeft className="h-4 w-4" /> Quay lại
      </Button>

      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="relative bg-hero-soft p-6 text-center">
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, var(--primary) 0%, transparent 50%)' }} />
          <div className="relative">
            <span className="inline-grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Headphones className="h-9 w-9" />
            </span>
            <h1 className="mt-3 text-3xl font-bold">SoNovel</h1>
            <p className="mt-1 text-sm text-muted-foreground">Nghe truyện chữ bằng giọng đọc tổng hợp</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              <Badge variant="secondary">v1.0</Badge>
              <Badge variant="outline">Web Speech API</Badge>
              <Badge variant="outline">Tiếng Việt</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Tải ứng dụng */}
      <DownloadAppCard />

      {/* Features */}
      <div className="grid sm:grid-cols-2 gap-3">
        <FeatureCard
          icon={<BookOpen className="h-5 w-5" />}
          title="Thư viện đa dạng"
          desc="Truyện chữ Việt với nhiều thể loại: tiên hiệp, ngôn tình, đô thị, huyền huyễn…"
        />
        <FeatureCard
          icon={<Headphones className="h-5 w-5" />}
          title="Nghe bằng TTS"
          desc="Giọng đọc tổng hợp tiếng Việt, tiếp tục từ đúng vị trí bạn dừng."
        />
        <FeatureCard
          icon={<Sparkles className="h-5 w-5" />}
          title="Tiếp tục nghe"
          desc="Lưu tiến độ mỗi 4 giây. Mở lại là nghe tiếp, không cần tìm chỗ cũ."
        />
        <FeatureCard
          icon={<Zap className="h-5 w-5" />}
          title="Hẹn giờ tắt"
          desc="Tắt tự động sau 10/15/30/60 phút hoặc hết chương — ngủ yên không lo."
        />
        <FeatureCard
          icon={<Heart className="h-5 w-5" />}
          title="Yêu thích & Đánh dấu"
          desc="Lưu truyện yêu thích, đánh dấu vị trí quan trọng để quay lại sau."
        />
        <FeatureCard
          icon={<Shield className="h-5 w-5" />}
          title="4 giao diện"
          desc="Sáng, Tối, Vàng giấy (sepia), Đen tuyền (AMOLED) — đổi theo môi trường."
        />
      </div>

      {/* Tech */}
      <Card>
        <CardHeader><CardTitle className="text-base">Công nghệ</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1.5">
          <div className="flex justify-between"><span>Web app</span><span className="font-mono text-foreground">Next.js 16 · React 19</span></div>
          <div className="flex justify-between"><span>Mobile</span><span className="font-mono text-foreground">Expo SDK 57 · Kotlin TTS</span></div>
          <div className="flex justify-between"><span>Database</span><span className="font-mono text-foreground">Prisma · SQLite / Supabase</span></div>
          <div className="flex justify-between"><span>UI</span><span className="font-mono text-foreground">Tailwind CSS 4 · shadcn/ui</span></div>
          <div className="flex justify-between"><span>Font</span><span className="font-mono text-foreground">Be Vietnam Pro</span></div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader><CardTitle className="text-base">Riêng tư</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Tài khoản chỉ cần email + mật khẩu, không thu thập thông tin cá nhân.</p>
          <p>• Tiến độ nghe lưu trên máy chủ khi đăng nhập, chỉ bạn mới xem được.</p>
          <p>• Khách không đăng nhập vẫn nghe được truyện — không lưu tiến độ.</p>
          <p>• Cài đặt giao diện lưu trong <code className="rounded bg-muted px-1 py-0.5 text-xs">localStorage</code> của trình duyệt.</p>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground py-4">
        <p>SoNovel · Phiên bản web · Dựng theo SPEC</p>
        <p className="mt-1">Made with <Heart className="inline h-3 w-3 fill-destructive text-destructive" /> in Vietnam</p>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
