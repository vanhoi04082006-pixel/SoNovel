'use client'

import { ChevronLeft, LayoutDashboard, PlusCircle, Tag, BookOpen } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AdminDashboard } from './dashboard'
import { AdminSeriesForm } from './series-form'
import { AdminSeriesDetail } from './series-detail'
import { AdminTags } from './tags'

export function AdminShell() {
  const { view, navigate } = useAppStore()
  const tab = view.view === 'admin' ? view.tab : 'dashboard'
  const seriesId = view.view === 'admin' ? view.seriesId : undefined

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ view: 'home' })}>
          <ChevronLeft className="h-4 w-4" /> Về trang người dùng
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Sidebar */}
        <aside className="md:w-56 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            <NavItem icon={<LayoutDashboard className="h-4 w-4" />} label="Bảng điều khiển" active={tab === 'dashboard'} onClick={() => navigate({ view: 'admin', tab: 'dashboard' })} />
            <NavItem icon={<PlusCircle className="h-4 w-4" />} label="Thêm truyện" active={tab === 'seriesForm'} onClick={() => navigate({ view: 'admin', tab: 'seriesForm' })} />
            <NavItem icon={<Tag className="h-4 w-4" />} label="Quản lý tag" active={tab === 'tags'} onClick={() => navigate({ view: 'admin', tab: 'tags' })} />
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === 'dashboard' && <AdminDashboard />}
          {tab === 'seriesForm' && <AdminSeriesForm key={seriesId || 'new'} seriesId={seriesId} />}
          {tab === 'seriesDetail' && seriesId && <AdminSeriesDetail seriesId={seriesId} />}
          {tab === 'tags' && <AdminTags />}
        </div>
      </div>
    </div>
  )
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-foreground'
      )}
    >
      {icon}
      {label}
    </button>
  )
}
