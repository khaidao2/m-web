'use client'
import Link from 'next/link'
import { ChevronRight, Flag, IdCard, Mic } from 'lucide-react'
import PassportRadar from '@/components/PassportRadar'
import { Empty, ErrorBox, Loading, PageHead, ScoreBar, Stat } from '@/components/ui'
import { FLAG_STATUS, levelColor, score1 } from '@/lib/format'
import { useApi } from '@/lib/useApi'
import type { Me, Passport, SessionSummary } from '@/lib/types'

const SCALE = [
  [1, 'Cần cải thiện', '0,0–4,9'], [2, 'Đạt yêu cầu', '5,0–6,9'], [3, 'Thành thạo', '7,0–8,4'], [4, 'Xuất sắc', '8,5–10,0'],
] as const

export default function PassportPage() {
  const p = useApi<Passport>('/passport')
  const me = useApi<Me>('/me')
  const sessions = useApi<SessionSummary[]>('/voice/sessions')
  const quiz = useApi<{ percent: number }[]>('/quiz/history')

  if (p.loading || me.loading) return <Loading />
  if (p.error || !p.data || !me.data) return <main className="page"><ErrorBox error={p.error ?? me.error ?? ''} retry={p.reload} /></main>
  const assessed = p.data.competencies.filter((c) => c.score !== null).length
  const activeFlags = p.data.red_flags.filter((f) => f.status !== 'closed')

  return (
    <main className="page">
      <PageHead eyebrow="Digital Passport" title="Năng lực là hành trình." sub="Kết hợp quiz, hội thoại và quan sát thực địa." />

      <section className="rise" style={{ borderRadius: 22, padding: 20, color: '#fff', background: 'linear-gradient(140deg, #1f2a44, #34436b)', position: 'relative', overflow: 'hidden' }}>
        <div className="row between">
          <span className="eyebrow" style={{ color: '#f7c55b' }}>Passport • BHX HCM</span>
          <IdCard size={22} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 14 }}>{me.data.full_name}</div>
        <div className="small" style={{ opacity: 0.75 }}>{me.data.store_name ?? 'Chưa cập nhật cửa hàng'}</div>
        <div className="row between" style={{ marginTop: 18 }}>
          <span className="chip" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}>
            {p.data.overall_level ? `Level ${p.data.overall_level.level} · ${p.data.overall_level.name}` : 'Đang khởi tạo'}
          </span>
          <span className="small" style={{ opacity: 0.8 }}>{assessed}/7 năng lực có dữ liệu</span>
        </div>
        <div aria-hidden style={{ position: 'absolute', right: 18, top: 44, fontSize: 40, fontWeight: 800, color: p.data.overall === null ? 'rgba(255,255,255,.3)' : '#fff' }}>
          {score1(p.data.overall)}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
        <Stat value={quiz.data?.[0] ? `${quiz.data[0].percent}%` : '—'} label="Quiz gần nhất" />
        <Stat value={sessions.data?.length ?? 0} label="Bài thực chiến" />
        <Stat value={activeFlags.length} label="Red Flag đang mở" accent={activeFlags.length > 0} />
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <b>Bản đồ 7 năng lực</b>
        <PassportRadar items={p.data.competencies} />
        {p.data.competencies.map((c) => (
          <ScoreBar key={c.key} label={`${c.key.toUpperCase()} · ${c.name}`} score={c.score} level={c.level}
            hint={c.score === null ? (c.key === 'c7' ? 'Chờ SUP' : 'Chưa có bằng chứng') : undefined} />
        ))}
      </section>

      <div className="section-title">Red Flag & xác nhận</div>
      {p.data.red_flags.length === 0 ? (
        <Empty icon={<Flag size={20} />} title="Chưa ghi nhận Red Flag" text="Năng lực chưa có bằng chứng không được tính là 0." />
      ) : (
        p.data.red_flags.map((f) => (
          <div key={f.id} className="item">
            <div className={`tile ${FLAG_STATUS[f.status].chip}`}><Flag size={19} /></div>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{f.competency.toUpperCase()} · {f.competency_name}</div>
              <div className="tiny muted">
                Mở ngày {new Date(f.opened_at).toLocaleDateString('vi-VN')} ở mức {score1(f.opened_score)}
                {f.sup_score !== null && ` · SUP chấm ${score1(f.sup_score)}`}
              </div>
            </div>
            <span className={`chip ${FLAG_STATUS[f.status].chip}`}>{FLAG_STATUS[f.status].label}</span>
          </div>
        ))
      )}

      <section className="card" style={{ marginTop: 14 }}>
        <b>Thang năng lực</b>
        <div className="grid2" style={{ marginTop: 10 }}>
          {SCALE.map(([lv, name, range]) => (
            <div key={lv} style={{ padding: 10, borderRadius: 12, background: `color-mix(in srgb, ${levelColor({ level: lv, name })} 10%, white)` }}>
              <div className="small" style={{ fontWeight: 700, color: levelColor({ level: lv, name }) }}>Level {lv} · {name}</div>
              <div className="tiny muted">{range}</div>
            </div>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>Red Flag khi điểm dưới 5,0. Đóng Red Flag cần điểm từ 7,0 và SUP xác nhận tại điểm bán. Level 4 bền vững cần nhiều lần quan sát thực địa.</p>
      </section>

      <div className="section-title">Lịch sử AI thực chiến</div>
      {sessions.data?.length === 0 && <Empty icon={<Mic size={20} />} title="Chưa có bài hội thoại" text="Bài hội thoại đã hoàn thành sẽ xuất hiện ở đây." />}
      {sessions.data?.map((s) => (
        <Link key={s.id} href={`/hoc/voice/phien/${s.id}`} className="item">
          <div className="tile" style={{ fontWeight: 800, fontSize: 14, color: levelColor(s.level), background: `color-mix(in srgb, ${levelColor(s.level)} 12%, white)` }}>{score1(s.overall)}</div>
          <div className="grow">
            <div className="truncate" style={{ fontWeight: 600 }}>{s.title}</div>
            <div className="tiny muted">{s.scenario_code} · {new Date(s.completed_at!).toLocaleString('vi-VN')}{s.sup_reviewed ? ' · SUP đã chấm' : ''}</div>
          </div>
          <ChevronRight size={18} color="var(--muted)" />
        </Link>
      ))}
    </main>
  )
}
