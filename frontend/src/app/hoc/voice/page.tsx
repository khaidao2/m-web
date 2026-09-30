'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Search, Target } from 'lucide-react'
import { GROUP_META } from '@/components/icons'
import { ErrorBox, Loading, PageHead } from '@/components/ui'
import { levelColor, score1 } from '@/lib/format'
import { level } from '@/lib/level'
import { useApi } from '@/lib/useApi'
import type { Me, Scenario, ScenarioGroup } from '@/lib/types'

const GROUPS: [ScenarioGroup | 'all', string][] = [
  ['all', 'Tất cả'], ['customer', 'Khách hàng khó tính'], ['store_manager', 'Cửa hàng trưởng'],
  ['store_staff', 'Phối hợp tại cửa hàng'], ['promotion', 'Khuyến mãi & SKU'], ['full_sale', '5 bước bán hàng'],
]

export default function VoiceLibrary() {
  const list = useApi<Scenario[]>('/voice/scenarios')
  const me = useApi<Me>('/me')
  const [group, setGroup] = useState<ScenarioGroup | 'all'>('all')
  const [q, setQ] = useState('')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (list.data ?? []).filter((s) =>
      (group === 'all' || s.group === group) &&
      (!needle || s.code.toLowerCase().includes(needle) || s.title.toLowerCase().includes(needle)))
  }, [list.data, group, q])

  return (
    <main className="page">
      <PageHead eyebrow="AI Voice Simulator 360°" title="Luyện hôm nay. Vững ngày mai." sub="50 tình huống, 5 nhóm nhân vật tại điểm bán." />

      {me.data && (
        <Link href={`/hoc/voice/${me.data.onboarding.voice_scenario}?kind=onboarding`} className="item">
          <div className="tile"><Target size={21} /></div>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>Bài đánh giá đầu vào · 7 phút</div>
            <div className="tiny muted">{me.data.onboarding.voice_done ? 'Đã hoàn thành · có thể làm lại để luyện' : 'Làm quen năng lực, nhận diện điểm nghẽn'}</div>
          </div>
          <ChevronRight size={18} color="var(--muted)" />
        </Link>
      )}

      <label className="row card" style={{ marginTop: 14, padding: '0 14px', height: 48 }}>
        <Search size={18} color="var(--muted)" />
        <span className="sr-only">Tìm tình huống</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tình huống, mã bài…" style={{ border: 0, outline: 0, flex: 1, height: '100%', background: 'none' }} />
      </label>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '12px -16px 4px', padding: '0 16px 6px' }}>
        {GROUPS.map(([k, label]) => (
          <button key={k} className={`chip ${group === k ? 'dark' : ''}`} style={{ height: 34, whiteSpace: 'nowrap', background: group === k ? undefined : 'var(--card)', boxShadow: 'var(--shadow)' }} onClick={() => setGroup(k)}>
            {label}
          </button>
        ))}
      </div>

      {list.loading && <Loading />}
      {list.error && <ErrorBox error={list.error} retry={list.reload} />}
      <div style={{ marginTop: 8 }}>
        {shown.map((s) => {
          const meta = GROUP_META[s.group]
          const lv = level(s.best ?? null)
          return (
            <Link key={s.code} href={`/hoc/voice/${s.code}`} className="card" style={{ display: 'block', marginTop: 10 }}>
              <div className="row between">
                <span className={`chip ${meta.tone === 'dark' ? '' : meta.tone}`}><meta.icon size={13} /> {s.code} · {s.group_label}</span>
                <span className="tiny muted">Độ khó {s.difficulty}/3</span>
              </div>
              <div style={{ fontWeight: 600, marginTop: 10 }}>{s.title}</div>
              <div className="row between" style={{ marginTop: 6 }}>
                <span className="tiny muted">{s.competencies.map((c) => c.toUpperCase()).join(' · ')} · 3 phút</span>
                {s.best != null && <b className="small" style={{ color: levelColor(lv) }}>Tốt nhất {score1(s.best)}</b>}
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
