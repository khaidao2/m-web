'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MasanMark, Wordmark } from './Brand'
import { BookOpen, ClipboardCheck, Gauge, House, IdCard, Mic, ScanLine, Trophy, type LucideIcon } from 'lucide-react'

type NavItem = { href: string; label: string; icon: LucideIcon; center?: boolean }

const PG_NAV: NavItem[] = [
  { href: '/hoc', label: 'Hôm nay', icon: House },
  { href: '/hoc/quiz', label: 'Học tập', icon: BookOpen },
  { href: '/hoc/voice', label: 'Thực chiến', icon: Mic, center: true },
  { href: '/hoc/passport', label: 'Passport', icon: IdCard },
  { href: '/hoc/leaderboard', label: 'Thành tích', icon: Trophy },
]

const SUP_NAV: NavItem[] = [
  { href: '/sup', label: 'Tổng quan', icon: Gauge },
  { href: '/sup/flags', label: 'Red Flag', icon: ClipboardCheck },
  { href: '/sup/bills', label: 'Bill D-day', icon: ScanLine },
]

export default function BottomNav({ role }: { role: 'pg' | 'supervisor' }) {
  const path = usePathname()
  const items = role === 'supervisor' ? SUP_NAV : PG_NAV
  const home = items[0].href
  return (
    <nav className="bottom-nav" aria-label="Điều hướng chính" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      <div className="nav-brand">
        <Wordmark />
        <MasanMark />
      </div>
      {items.map(({ href, label, icon: Icon, center }) => {
        const active = href === home ? path === home : path.startsWith(href)
        return (
          <Link key={href} href={href} className={`${active ? 'active' : ''} ${center ? 'center' : ''}`} aria-current={active ? 'page' : undefined}>
            {center ? <span><Icon size={24} /></span> : <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />}
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
