'use client'
import { useState } from 'react'
import { ChevronDown, Receipt } from 'lucide-react'
import BillDetail from './BillDetail'
import { Empty, ErrorBox, Loading } from '../ui'
import { api } from '@/lib/api'
import { BILL_STATUS, vnd, type Bill, type BillStatus } from '@/lib/billTypes'
import { useApi } from '@/lib/useApi'

const FILTERS: [BillStatus | '', string][] = [['', 'Tất cả'], ['valid', 'Hợp lệ'], ['review', 'Cần xem xét'], ['rejected', 'Loại'], ['void', 'Vô hiệu']]

export default function BillHistory({ programId }: { programId: string }) {
  const [status, setStatus] = useState<BillStatus | ''>('')
  const qs = new URLSearchParams({ ...(programId && { program_id: programId }), ...(status && { status }) }).toString()
  const list = useApi<Bill[]>(`/bills${qs ? `?${qs}` : ''}`)
  const [open, setOpen] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function voidBill(id: string) {
    setBusy(true)
    try {
      await api(`/bills/${id}/void`, { method: 'POST', json: { reason } })
      setReason('')
      await list.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
        {FILTERS.map(([k, l]) => (
          <button key={k} className={`chip ${status === k ? 'dark' : ''}`} style={{ height: 32, whiteSpace: 'nowrap', background: status === k ? undefined : 'var(--card)', boxShadow: 'var(--shadow)' }} onClick={() => setStatus(k)}>{l}</button>
        ))}
      </div>
      {list.loading && <Loading />}
      {list.error && <ErrorBox error={list.error} retry={list.reload} />}
      {list.data?.length === 0 && <Empty icon={<Receipt size={20} />} title="Chưa có bill trong phạm vi này" text="Chọn Chụp bill để bắt đầu." />}
      {list.data?.map((b) => {
        const s = BILL_STATUS[b.status]
        const expanded = open === b.id
        return (
          <article key={b.id} className="card bill-card" style={{ marginTop: 10, ['--stripe' as string]: s.color }}>
            <button className="row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpen(expanded ? null : b.id)} aria-expanded={expanded}>
              <div className="grow">
                <div className="row" style={{ gap: 6 }}>
                  <span className={`chip ${s.chip}`}>{s.label}</span>
                  {b.mch_categories.length > 1 && <span className="chip blue">Đa ngành</span>}
                </div>
                <div style={{ fontWeight: 700, marginTop: 6 }}>{vnd(b.mch_value_vnd)} <span className="small muted" style={{ fontWeight: 500 }}>hàng Masan</span></div>
                <div className="tiny muted">{b.bill_no ?? 'Không rõ số bill'} · {b.program?.name}{b.pg ? ` · ${b.pg.name}` : ''}</div>
              </div>
              <ChevronDown size={18} style={{ transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
            </button>
            {expanded && (
              <BillDetail bill={b} actions={b.status !== 'void' && (
                <div className="row" style={{ marginTop: 4 }}>
                  <input className="input" placeholder="Lý do vô hiệu (bắt buộc)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button className="btn sm soft" disabled={busy || reason.trim().length < 3} onClick={() => voidBill(b.id)}>Vô hiệu</button>
                </div>
              )} />
            )}
          </article>
        )
      })}
    </section>
  )
}
