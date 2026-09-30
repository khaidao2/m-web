'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/hoc',            icon: '🏠', label: 'Trang Chủ' },
  { href: '/hoc/quests',     icon: '📋', label: 'Nhiệm Vụ'  },
  { href: '/hoc/leaderboard',icon: '🏆', label: 'Xếp Hạng'  },
  { href: '/hoc/passport',   icon: '🎖️', label: 'Hồ Sơ'     },
]

export default function BottomNav() {
  const path = usePathname()

  return (
    <nav className="bottom-nav">
      {NAV.map(n => {
        const active = path === n.href || (n.href !== '/hoc' && path.startsWith(n.href))
        return (
          <Link key={n.href} href={n.href} className={`bottom-nav-item${active ? ' active' : ''}`}>
            <span className="bottom-nav-icon">{n.icon}</span>
            <span>{n.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
