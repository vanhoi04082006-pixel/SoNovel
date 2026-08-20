'use client'

import { ChevronLeft, LayoutDashboard, PlusCircle, Tag, Users, Shield } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AdminDashboard } from './dashboard'
import { AdminSeriesForm } from './series-form'
import { AdminSeriesDetail } from './series-detail'
import { AdminTags } from './tags'
import { AdminUsers } from './users'

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
        <aside className="md:w-60 shrink-0">
          <div className="mb-3 hidden md:block rounded-xl border border-border bg-card p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold"><Shield className="h-4 w-4 text-primary" /> Quản trị</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Quản lý truyện, chương, tag và người dùng.</p>
          </div>
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            <NavItem icon={<LayoutDashboard className="h-4 w-4" />} label="Bảng điều khiển" active={tab === 'dashboard'} onClick={() => navigate({ view: 'admin', tab: 'dashboard' })} />
            <NavItem icon={<PlusCircle className="h-4 w-4" />} label="Thêm truyện" active={tab === 'seriesForm'} onClick={() => navigate({ view: 'admin', tab: 'seriesForm' })} />
            <NavItem icon={<Tag className="h-4 w-4" />} label="Quản lý tag" active={tab === 'tags'} onClick={() => navigate({ view: 'admin', tab: 'tags' })} />
            <NavItem icon={<Users className="h-4 w-4" />} label="Người dùng" active={tab === 'users'} onClick={() => navigate({ view: 'admin', tab: 'users' })} />
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === 'dashboard' && <AdminDashboard />}
          {tab === 'seriesForm' && <AdminSeriesForm key={seriesId || 'new'} seriesId={seriesId} />}
          {tab === 'seriesDetail' && seriesId && <AdminSeriesDetail seriesId={seriesId} />}
          {tab === 'tags' && <AdminTags />}
          {tab === 'users' && <AdminUsers />}
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
        'relative flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {active && <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary" />}
      <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-md', active ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
        {icon}
      </span>
      {label}
    </button>
  )
}
