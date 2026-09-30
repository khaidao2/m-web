'use client'
import { Suspense, use, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BadgeCheck, ChevronLeft, Scale } from 'lucide-react'
import SessionReport from '@/components/SessionReport'
import { ErrorBox, Loading } from '@/components/ui'
import { api } from '@/lib/api'
import { FLAG_STATUS } from '@/lib/format'
import { useApi } from '@/lib/useApi'
import type { Flag, SessionView } from '@/lib/types'

const parse = (v: string) => Number(v.replace(',', '.'))
const valid = (v: string) => v.trim() !== '' && !Number.isNaN(parse(v)) && parse(v) >= 0 && parse(v) <= 10

function Review({ id }: { id: string }) {
  const flagId = useSearchParams().get('flag')
  const s = useApi<SessionView>(`/sup/sessions/${id}`)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [stampScore, setStampScore] = useState('')
  const [stampNote, setStampNote] = useState('')
  const [flag, setFlag] = useState<Flag | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submitReview() {
    setBusy(true)
    setMsg(null)
    try {
      const body = Object.fromEntries(Object.entries(scores).filter(([, v]) => valid(v)).map(([k, v]) => [k, parse(v)]))
      s.setData(await api<SessionView>(`/sup/sessions/${id}/review`, { method: 'POST', json: { scores: body, note: note || null } }))
      setMsg('Đã lưu điểm SUP — dùng để so sánh AI chấm vs SUP chấm.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Không lưu được')
    } finally {
      setBusy(false)
    }
  }

  async function stamp() {
    setBusy(true)
    setMsg(null)
    try {
      const f = await api<Flag>(`/sup/flags/${flagId}/stamp`, { method: 'POST', json: { score: parse(stampScore), note: stampNote || null } })
      setFlag(f)
      setMsg(f.status === 'closed' ? 'Đã Stamp xác nhận — Red Flag được đóng.' : 'Đã ghi nhận điểm SUP. Red Flag vẫn mở vì điểm dưới 7,0.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Không Stamp được')
    } finally {
      setBusy(false)
    }
  }

  if (s.loading && !s.data) return <Loading />
  if (s.error || !s.data) return <main className="page"><ErrorBox error={s.error ?? ''} retry={s.reload} /></main>
  const data = s.data
  const reviewed = data.report.sup_review

  return (
    <main className="page">
      <Link href={data.pg ? `/sup/pg/${data.pg.id}` : '/sup'} className="row small muted" style={{ margin: '4px 0 10px' }}><ChevronLeft size={16} /> {data.pg?.name ?? 'Quay lại'}</Link>

      {flagId && (
        <section className="card" style={{ border: '1.5px solid var(--red)', marginBottom: 14 }}>
          <div className="row"><BadgeCheck size={20} color="var(--red)" /><b>Stamp xác nhận Red Flag</b>
            {flag && <span className={`chip ${FLAG_STATUS[flag.status].chip}`} style={{ marginLeft: 'auto' }}>{FLAG_STATUS[flag.status].label}</span>}</div>
          <p className="tiny muted" style={{ marginTop: 6 }}>Nghe lại bài làm bên dưới, kết hợp quan sát tại điểm bán. Điểm từ 7,0 sẽ đóng Red Flag và thăng cấp năng lực.</p>
          <div className="row" style={{ marginTop: 10 }}>
            <input className="input" inputMode="decimal" placeholder="Điểm SUP (0–10)" value={stampScore} onChange={(e) => setStampScore(e.target.value)} style={{ width: 150 }} />
            <input className="input" placeholder="Ghi chú" value={stampNote} onChange={(e) => setStampNote(e.target.value)} />
          </div>
          <button className="btn primary block" style={{ marginTop: 10 }} onClick={stamp} disabled={busy || !valid(stampScore) || flag?.status === 'closed'}>
            <BadgeCheck size={18} /> Bấm Stamp xác nhận
          </button>
        </section>
      )}
      {msg && <div className="note" style={{ marginBottom: 14 }}>{msg}</div>}

      <SessionReport s={data} />

      <section className="card">
        <div className="row"><Scale size={18} /><b>SUP chấm lại (so với AI)</b></div>
        {reviewed && <p className="tiny muted" style={{ marginTop: 6 }}>Đã chấm bởi {reviewed.by} · {new Date(reviewed.at).toLocaleString('vi-VN')}</p>}
        <div className="grid2" style={{ marginTop: 10 }}>
          {data.scores.map((c) => (
            <div key={c.key} className="field">
              <label htmlFor={`s-${c.key}`}>{c.key.toUpperCase()} · AI {c.score ?? '—'}</label>
              <input id={`s-${c.key}`} className="input" inputMode="decimal" placeholder={reviewed?.scores[c.key]?.toString() ?? '0–10'}
                value={scores[c.key] ?? ''} onChange={(e) => setScores({ ...scores, [c.key]: e.target.value })} />
            </div>
          ))}
        </div>
        <textarea className="input" style={{ marginTop: 10 }} placeholder="Nhận xét cho PG" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn dark block" style={{ marginTop: 10 }} onClick={submitReview} disabled={busy || !Object.values(scores).some(valid)}>Lưu điểm SUP</button>
      </section>
    </main>
  )
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <Suspense><Review id={id} /></Suspense>
}
