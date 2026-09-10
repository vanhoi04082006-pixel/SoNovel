import { cn } from '@/lib/utils'

/** Brand mark SoNovel — render từ logo.svg (v2: tai nghe + play + sách). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('grid shrink-0 place-items-center overflow-hidden rounded-xl', className)}>
      <img src="/logo.svg" alt="SoNovel" className="h-full w-full" draggable={false} />
    </span>
  )
}
