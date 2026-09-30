'use client'
import Link from 'next/link'
import { ChevronRight, Flag, Users } from 'lucide-react'
import { Empty, ErrorBox, Loading, PageHead } from '@/components/ui'
import { levelColor, score1 } from '@/lib/format'
import { useApi } from '@/lib/useApi'
import type { Overview } from '@/lib/supTypes'

export default function SupHome() {
  const o = useApi<Overview>('/sup/overview')
  if (o.loading) return <Loading />
  if (o.error || !o.data) return <main className="page"><ErrorBox error={o.error ?? ''} retry={o.reload} /></main>
  return (
    <main className="page">
      <PageHead eyebrow="Sales Supervisor" title="Đồng hành cùng đội PG." sub="Chỉ số pilot PG-NEXUS · BHX HCM (7 ngày gần nhất)" />
      <section className="grid2">
        {o.data.kpis.map((k) => (
          <div key={k.code} className="card" style={{ padding: 14 }}>
            <div className="tiny muted">{k.code} · {k.name}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{k.value === null ? '—' : `${k.value.toLocaleString('vi-VN')}${k.unit === '%' ? '%' : ` ${k.unit}`}`}</div>
            <div className="tiny" style={{ color: 'var(--ink-2)' }}>Mục tiêu {k.target}</div>
          </div>
        ))}
      </section>

      <Link href="/sup/flags" className="item" style={{ marginTop: 14 }}>
        <div className="tile"><Flag size={20} /></div>
        <div className="grow"><b>Hàng chờ Red Flag</b><div className="tiny muted">Nghe lại bài làm, chấm và Stamp xác nhận</div></div>
        <ChevronRight size={18} color="var(--muted)" />
      </Link>

      <div className="section-title">Đội PG ({o.data.team.length})</div>
      {o.data.team.length === 0 && <Empty icon={<Users size={20} />} title="Chưa có PG đăng nhập" text="PG sẽ xuất hiện sau lần đăng nhập đầu tiên." />}
      {o.data.team.map((t) => (
        <Link key={t.id} href={`/sup/pg/${t.id}`} className="item">
          <div className="tile" style={{ fontWeight: 800, fontSize: 14, color: levelColor(t.level), background: `color-mix(in srgb, ${levelColor(t.level)} 12%, white)` }}>{score1(t.overall)}</div>
          <div className="grow">
            <div className="truncate" style={{ fontWeight: 600 }}>{t.name}</div>
            <div className="tiny muted truncate">{t.store ?? 'Chưa cập nhật cửa hàng'} · {t.quests_week} nhiệm vụ/tuần{t.onboarded ? '' : ' · chưa xong đầu vào'}</div>
          </div>
          {t.open_flags + t.ready_flags > 0 && <span className={`chip ${t.ready_flags ? 'amber' : 'red'}`}><Flag size={12} /> {t.open_flags + t.ready_flags}</span>}
          <ChevronRight size={18} color="var(--muted)" />
        </Link>
      ))}
    </main>
  )
}
