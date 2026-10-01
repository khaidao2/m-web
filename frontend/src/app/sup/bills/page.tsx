'use client'
import { useState } from 'react'
import { CalendarPlus, CheckCircle2, Lock, Receipt, XCircle } from 'lucide-react'
import BillDetail from '@/components/bill/BillDetail'
import BillResults from '@/components/bill/BillResults'
import { Empty, ErrorBox, Loading, PageHead } from '@/components/ui'
import { api } from '@/lib/api'
import { vnd, type Bill, type Program } from '@/lib/billTypes'
import { useApi } from '@/lib/useApi'

type Tab = 'review' | 'programs' | 'results'

export default function SupBills() {
  const [tab, setTab] = useState<Tab>('review')
  return (
    <main className="page">
      <PageHead eyebrow="Bill intelligence · D-day" title="Bill D-day" sub="Cấu hình chương trình, duyệt bill cần xem xét và theo dõi kết quả toàn đội." />
      <div className="tabs" role="tablist">
        {([['review', 'Cần duyệt'], ['programs', 'Chương trình'], ['results', 'Kết quả']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'review' && <ReviewQueue />}
      {tab === 'programs' && <Programs />}
      {tab === 'results' && <BillResults programId="" />}
    </main>
  )
}

function ReviewQueue() {
  const q = useApi<Bill[]>('/bills?status=review')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  async function decide(id: string, decision: 'valid' | 'rejected') {
    setBusy(id)
    try {
      await api(`/sup/bills/${id}/decide`, { method: 'POST', json: { decision, note: notes[id] || null } })
      await q.reload()
    } finally {
      setBusy(null)
    }
  }

  if (q.loading && !q.data) return <Loading />
  if (q.error) return <ErrorBox error={q.error} retry={q.reload} />
  return (
    <section style={{ marginTop: 12 }}>
      {q.data?.length === 0 && <Empty icon={<Receipt size={20} />} title="Không có bill cần duyệt" text="Bill bị gắn cờ tự động sẽ xuất hiện ở đây." />}
      {q.data?.map((b) => (
        <article key={b.id} className="card bill-card" style={{ marginTop: 10, ['--stripe' as string]: 'var(--l2)' }}>
          <div className="row between">
            <div>
              <b>{b.pg?.name}</b>
              <div className="tiny muted">{b.program?.name} · {vnd(b.mch_value_vnd)} hàng Masan</div>
            </div>
            <span className="chip amber">Cần xem xét</span>
          </div>
          <BillDetail bill={b} actions={
            <div className="stack">
              <input className="input" placeholder="Ghi chú đối chiếu (tuỳ chọn)" value={notes[b.id] ?? ''} onChange={(e) => setNotes({ ...notes, [b.id]: e.target.value })} />
              <div className="grid2">
                <button className="btn sm" style={{ background: 'var(--green)', color: '#fff' }} disabled={busy === b.id} onClick={() => decide(b.id, 'valid')}><CheckCircle2 size={16} /> Hợp lệ</button>
                <button className="btn sm soft" disabled={busy === b.id} onClick={() => decide(b.id, 'rejected')}><XCircle size={16} /> Loại</button>
              </div>
            </div>
          } />
        </article>
      ))}
    </section>
  )
}

function Programs() {
  const list = useApi<{ activities: string[]; programs: Program[] }>('/dday/programs')
  const [form, setForm] = useState({ name: '', activity: 'D-day', day: new Date().toISOString().slice(0, 10), store_name: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function create() {
    setBusy(true)
    setMsg(null)
    try {
      await api('/sup/dday/programs', { method: 'POST', json: form })
      setForm({ ...form, name: '' })
      setMsg('Đã tạo chương trình — PG có thể tham gia ngay.')
      await list.reload()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Không tạo được')
    } finally {
      setBusy(false)
    }
  }

  async function close(id: string) {
    await api(`/sup/dday/programs/${id}/close`, { method: 'POST' })
    await list.reload()
  }

  return (
    <section style={{ marginTop: 12 }}>
      <div className="card stack">
        <b>Tạo chương trình D-day</b>
        <div className="field"><label htmlFor="pn">Tên chương trình</label>
          <input id="pn" className="input" placeholder="VD: Double Day 10/10 · BHX Q7" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="pa">Hoạt động</label>
            <select id="pa" className="input" value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })}>
              {(list.data?.activities ?? ['D-day']).map((a) => <option key={a}>{a}</option>)}
            </select></div>
          <div className="field"><label htmlFor="pd">Ngày</label>
            <input id="pd" type="date" className="input" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} /></div>
        </div>
        <div className="field"><label htmlFor="ps">Cửa hàng</label>
          <input id="ps" className="input" placeholder="VD: BHX Q7 - Huỳnh Tấn Phát" value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} /></div>
        <button className="btn primary block" onClick={create} disabled={busy || form.name.trim().length < 3 || form.store_name.trim().length < 2}><CalendarPlus size={18} /> Tạo chương trình</button>
        {msg && <span className="small muted">{msg}</span>}
      </div>
      <div className="section-title">Chương trình</div>
      {list.data?.programs.length === 0 && <Empty icon={<CalendarPlus size={20} />} title="Chưa có chương trình" />}
      {list.data?.programs.map((p) => (
        <div key={p.id} className="item">
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div className="tiny muted">{p.activity} · {new Date(p.day).toLocaleDateString('vi-VN')} · {p.store_name}</div>
          </div>
          {p.is_open ? <button className="btn sm ghost" onClick={() => close(p.id)}><Lock size={14} /> Đóng</button> : <span className="chip">Đã đóng</span>}
        </div>
      ))}
    </section>
  )
}
