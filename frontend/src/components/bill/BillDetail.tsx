'use client'
import { useState, type ReactNode } from 'react'
import { History } from 'lucide-react'
import { BrandVisual } from '../Brand'
import { api } from '@/lib/api'
import { BILL_STATUS, vnd, type Bill, type BillEvent } from '@/lib/billTypes'
import { BRANDS } from '@/lib/products'
import { useBlobUrl } from '@/lib/useBlobUrl'

const ACTIONS: Record<string, string> = { ocr: 'Hệ thống đọc ảnh', edit: 'PG chỉnh sửa', confirm: 'PG xác nhận', decide: 'SUP quyết định', void: 'Vô hiệu' }

/** Lines, original photo and audit trail of one bill; `actions` slot for void / SUP decision. */
export default function BillDetail({ bill, actions }: { bill: Bill; actions?: ReactNode }) {
  const photo = useBlobUrl(`/bills/${bill.id}/image`)
  const [events, setEvents] = useState<BillEvent[] | null>(null)
  return (
    <div className="stack" style={{ marginTop: 12 }}>
      {bill.flags.length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {bill.flags.map((f) => <span key={f.code} className={`chip ${f.severity === 'rejected' ? 'red' : 'amber'}`}>{f.label}</span>)}
        </div>
      )}
      <div className="tiny muted">
        Số bill {bill.bill_no ?? '—'} · {bill.purchased_at ? new Date(bill.purchased_at).toLocaleString('vi-VN') : 'không rõ ngày'} · {bill.store_name ?? 'không rõ cửa hàng'} · tổng {vnd(bill.total_vnd)}
      </div>
      <div>
        {bill.lines.map((l, i) => {
          const brand = BRANDS.find((b) => b.slug === l.slug)
          return (
            <div key={i} className="row small" style={{ padding: '8px 0', borderTop: i ? '1px solid var(--line)' : undefined, opacity: l.mch ? 1 : 0.6 }}>
              {brand ? <BrandVisual brand={brand} size={30} /> : <span style={{ width: 30 }} />}
              <span className="grow truncate">{l.name}</span>
              <span className="muted">×{l.qty}</span>
              <b style={{ minWidth: 86, textAlign: 'right' }}>{vnd(l.amount)}</b>
            </div>
          )
        })}
      </div>
      {photo && (
        <a href={photo} target="_blank" rel="noreferrer" className="scan-photo" style={{ display: 'block' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt={`Ảnh bill ${bill.bill_no ?? ''}`} style={{ maxHeight: 280 }} />
        </a>
      )}
      {events ? (
        <ol className="tiny" style={{ listStyle: 'none', borderLeft: '2px solid var(--line)', paddingLeft: 12 }}>
          {events.map((e, i) => (
            <li key={i} style={{ marginTop: i ? 6 : 0 }}>
              <b>{ACTIONS[e.action] ?? e.action}</b> · {e.by} · {new Date(e.at).toLocaleString('vi-VN')}
              {e.action === 'confirm' && <> → {BILL_STATUS[(e.detail.status as keyof typeof BILL_STATUS) ?? 'draft']?.label}</>}
              {e.action === 'edit' && <> · sửa {Object.keys(e.detail).join(', ')}</>}
              {(e.action === 'void' || e.action === 'decide') && e.detail.reason ? <> · “{String(e.detail.reason)}”</> : null}
              {e.action === 'decide' && e.detail.note ? <> · “{String(e.detail.note)}”</> : null}
            </li>
          ))}
        </ol>
      ) : (
        <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => api<BillEvent[]>(`/bills/${bill.id}/events`).then(setEvents)}>
          <History size={15} /> Lịch sử chỉnh sửa
        </button>
      )}
      {actions}
    </div>
  )
}
