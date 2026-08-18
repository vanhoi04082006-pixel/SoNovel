'use client'

import { useEffect } from 'react'
import { Type, AlignLeft, Gauge, Moon, BookOpen, RotateCcw } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { useReaderSettings, FONT_FAMILY_LABELS, FONT_FAMILY_CSS, type FontFamily } from '@/store/use-reader-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

const THEMES = [
  { key: 'light', label: 'Sáng', desc: 'Trắng sạch', preview: 'bg-white border' },
  { key: 'dark', label: 'Tối', desc: 'Xám đậm', preview: 'bg-zinc-800' },
  { key: 'sepia', label: 'Vàng giấy', desc: 'Giấy cổ', preview: 'bg-amber-100' },
  { key: 'amoled', label: 'Đen tuyền', desc: 'OLED', preview: 'bg-black' },
] as const

const FONT_FAMILIES: FontFamily[] = ['system', 'serif', 'sans', 'mono']

export function SettingsScreen() {
  const { theme, setTheme, navigate } = useAppStore()
  const { fontSize, fontFamily, lineHeight, hydrate, setFontSize, setFontFamily, setLineHeight } = useReaderSettings()

  useEffect(() => { hydrate() }, [hydrate])

  const reset = () => {
    setFontSize(18)
    setFontFamily('system')
    setLineHeight(1.8)
    toast.success('Đã đặt lại cài đặt đọc.')
  }

  return (
    <div className="mx-auto max-w-2xl px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cài đặt</h1>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="h-4 w-4 mr-1" /> Đặt lại
        </Button>
      </div>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Moon className="h-4 w-4" /> Giao diện</CardTitle>
          <CardDescription>Chọn theme hiển thị cho toàn ứng dụng</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTheme(t.key)}
              className={`group rounded-lg border p-3 text-left transition-all ${
                theme === t.key ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'
              }`}
            >
              <div className={`mb-2 h-8 w-full rounded ${t.preview}`} />
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Font family */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Type className="h-4 w-4" /> Font chữ</CardTitle>
          <CardDescription>Áp dụng cho phần "Xem chữ" trong trình nghe</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {FONT_FAMILIES.map((f) => (
            <button
              key={f}
              onClick={() => setFontFamily(f)}
              className={`rounded-lg border p-3 text-left transition-all ${
                fontFamily === f ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50'
              }`}
            >
              <p className="text-sm font-medium" style={{ fontFamily: FONT_FAMILY_CSS[f] }}>
                {FONT_FAMILY_LABELS[f]}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: FONT_FAMILY_CSS[f] }}>
                Aa Ông Âu 2025
              </p>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Font size */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" /> Cỡ chữ</CardTitle>
          <CardDescription>Kéo để điều chỉnh cỡ chữ hiển thị</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-8">14</span>
            <Slider
              value={[fontSize]}
              min={14}
              max={32}
              step={1}
              onValueChange={(v) => setFontSize(v[0])}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">{fontSize}px</span>
          </div>
          <div
            className="rounded-lg border border-border bg-muted/30 p-3"
            style={{ fontSize: `${fontSize}px`, fontFamily: FONT_FAMILY_CSS[fontFamily] }}
          >
            Trong khu vườn phía sau tòa viện, ánh trăng nhạt nhòa chiếu xuống mặt đất.
          </div>
        </CardContent>
      </Card>

      {/* Line height */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><AlignLeft className="h-4 w-4" /> Độ giãn dòng</CardTitle>
          <CardDescription>Khoảng cách giữa các dòng</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-8">1.3</span>
            <Slider
              value={[lineHeight]}
              min={1.3}
              max={2.4}
              step={0.1}
              onValueChange={(v) => setLineHeight(v[0])}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">{lineHeight.toFixed(1)}</span>
          </div>
          <div
            className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
            style={{ lineHeight, fontSize: `${fontSize}px`, fontFamily: FONT_FAMILY_CSS[fontFamily] }}
          >
            <p>Một thiếu niên bình thường vô tình nhặt được cuốn cổ thư.</p>
            <p>Từ đó bước lên con đường tu tiên đầy chông gai.</p>
            <p>Hắn sẽ đối mặt với ma đạo, tiên môn, và bí ẩn về nguồn gốc.</p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-between text-sm text-muted-foreground">
        <button onClick={() => navigate({ view: 'profile' })} className="hover:text-primary">← Tài khoản</button>
        <button onClick={() => navigate({ view: 'about' })} className="hover:text-primary">Giới thiệu →</button>
      </div>
    </div>
  )
}
