'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react'
import PassportRadar from '@/components/PassportRadar'
import { ErrorBox, LevelChip, Loading, ScoreBar } from '@/components/ui'
import { api } from '@/lib/api'
import { FLAG_STATUS, levelColor, score1 } from '@/lib/format'
import { useApi } from '@/lib/useApi'
import type { PgDetail } from '@/lib/supTypes'

const FIELDS = [
  ['revenue_vnd', 'Doanh thu (đ)'], ['dday_units', 'Sản lượng D-day'], ['activations', 'Số buổi hoạt náo'], ['extra_displays', 'Trưng bày thêm'],
] as const

export default function PgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const d = useApi<PgDetail>(`/sup/pgs/${id}`)
  const [form, setForm] = useState<Record<string, string>>({ period: new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function saveAudit() {
    setSaving(true)
    setMsg(null)
    const body: Record<string, unknown> = { period: form.period, note: form.note || null }
    for (const [k] of FIELDS) body[k] = form[k] ? Number(form[k]) : null
    body.c7_score = form.c7_score ? Number(form.c7_score.replace(',', '.')) : null
    try {
      await api(`/sup/pgs/${id}/audit`, { method: 'POST', json: body })
      setMsg('Đã lưu số liệu thực địa')
      setForm({ period: form.period })
      await d.reload()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  if (d.loading && !d.data) return <Loading />
  if (d.error || !d.data) return <main className="page"><ErrorBox error={d.error ?? ''} retry={d.reload} /></main>
  const { pg, passport, sessions, audits, onboarding } = d.data

  return (
    <main className="page">
      <Link href="/sup" className="row small muted" style={{ margin: '4px 0 10px' }}><ChevronLeft size={16} /> Tổng quan</Link>
      <h1 className="h1">{pg.name}</h1>
      <p className="muted small">{pg.store ?? 'Chưa cập nhật cửa hàng'} · {onboarding.complete ? 'Đã xong đầu vào' : 'Chưa xong bài đầu vào'}</p>
      <div style={{ marginTop: 10 }}><LevelChip level={passport.overall_level} /></div>

      <section className="card" style={{ marginTop: 14 }}>
        <PassportRadar items={passport.competencies} size={230} />
        {passport.competencies.map((c) => <ScoreBar key={c.key} label={`${c.key.toUpperCase()} · ${c.name}`} score={c.score} level={c.level} />)}
      </section>

      {passport.red_flags.length > 0 && <div className="section-title">Red Flag</div>}
      {passport.red_flags.map((f) => (
        <div key={f.id} className="item">
          <div className="grow"><b className="small">{f.competency.toUpperCase()} · {f.competency_name}</b>
            <div className="tiny muted">Mở ở {score1(f.opened_score)}{f.sup_note ? ` · “${f.sup_note}”` : ''}</div></div>
          <span className={`chip ${FLAG_STATUS[f.status].chip}`}>{FLAG_STATUS[f.status].label}</span>
        </div>
      ))}

      <div className="section-title">Field Audit Sync</div>
      <section className="card stack">
        <div className="field"><label htmlFor="period">Kỳ ghi nhận</label>
          <input id="period" type="date" className="input" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} /></div>
        <div className="grid2">
          {FIELDS.map(([k, label]) => (
            <div key={k} className="field"><label htmlFor={k}>{label}</label>
              <input id={k} className="input" inputMode="numeric" value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value.replace(/\D/g, '') })} /></div>
          ))}
        </div>
        <div className="field"><label htmlFor="c7">C7 · Thái độ & kỷ luật (0–10)</label>
          <input id="c7" className="input" inputMode="decimal" placeholder="VD: 7,5" value={form.c7_score ?? ''} onChange={(e) => setForm({ ...form, c7_score: e.target.value })} /></div>
        <div className="field"><label htmlFor="note">Quan sát / biên bản 1:1</label>
          <textarea id="note" className="input" value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
        <button className="btn dark block" onClick={saveAudit} disabled={saving}><ClipboardCheck size={18} /> Lưu số liệu thực địa</button>
        {msg && <span className="small muted">{msg}</span>}
      </section>
      {audits.map((a) => (
        <div key={a.id} className="item small">
          <div className="grow">
            <b>{new Date(a.period).toLocaleDateString('vi-VN')}</b>
            <div className="tiny muted">
              {a.revenue_vnd != null && `DT ${a.revenue_vnd.toLocaleString('vi-VN')}đ · `}{a.dday_units != null && `D-day ${a.dday_units} · `}
              {a.activations != null && `Hoạt náo ${a.activations} · `}{a.extra_displays != null && `Trưng bày ${a.extra_displays} · `}{a.c7_score != null && `C7 ${score1(a.c7_score)}`}
            </div>
            {a.note && <div className="tiny" style={{ marginTop: 4 }}>{a.note}</div>}
          </div>
        </div>
      ))}

      <div className="section-title">Bài hội thoại</div>
      {sessions.map((s) => (
        <Link key={s.id} href={`/sup/phien/${s.id}`} className="item">
          <div className="tile" style={{ fontWeight: 800, fontSize: 14, color: levelColor(s.level), background: `color-mix(in srgb, ${levelColor(s.level)} 12%, white)` }}>{score1(s.overall)}</div>
          <div className="grow"><div className="truncate small" style={{ fontWeight: 600 }}>{s.title}</div>
            <div className="tiny muted">{s.scenario_code} · {new Date(s.completed_at!).toLocaleString('vi-VN')}{s.sup_reviewed ? ' · đã chấm' : ''}</div></div>
          <ChevronRight size={18} color="var(--muted)" />
        </Link>
      ))}
    </main>
  )
}
