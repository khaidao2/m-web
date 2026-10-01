'use client'
import { useState } from 'react'
import { Download, Info, Layers, Receipt, Timer, TriangleAlert } from 'lucide-react'
import { BrandVisual } from '../Brand'
import { ErrorBox, Loading } from '../ui'
import { api } from '@/lib/api'
import { vnd, type BillResults as Results } from '@/lib/billTypes'
import { BRANDS } from '@/lib/products'
import { useApi } from '@/lib/useApi'

export default function BillResults({ programId }: { programId: string }) {
  const qs = programId ? `?program_id=${programId}` : ''
  const r = useApi<Results>(`/bills/results${qs}`)
  const [exporting, setExporting] = useState(false)

  async function exportCsv() {
    setExporting(true)
    try {
      const blob = await api<Blob>(`/bills/export.csv${qs}`)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `pgnexus-bill-dday-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } finally {
      setExporting(false)
    }
  }

  if (r.loading && !r.data) return <Loading />
  if (r.error || !r.data) return <ErrorBox error={r.error ?? ''} retry={r.reload} />
  const d = r.data
  const tiles = [
    { icon: Timer, label: 'Giá trị MCH / giờ', value: vnd(d.value_per_hour) },
    { icon: Layers, label: 'Bill đa ngành hàng', value: d.multi_category_rate == null ? '—' : `${d.multi_category_rate}%` },
    { icon: Receipt, label: 'Giá trị MCH / bill', value: vnd(d.value_per_bill) },
    { icon: TriangleAlert, label: 'Bill cần kiểm tra', value: String(d.needs_review), warn: d.needs_review > 0 },
  ]
  const max = Math.max(1, ...d.skus.map((s) => s.amount))

  return (
    <section style={{ marginTop: 12 }}>
      <div className="rise" style={{ borderRadius: 22, padding: 22, color: '#fff', background: 'linear-gradient(135deg, #d71920, #a3121a)', boxShadow: 'var(--shadow-red)' }}>
        <div className="eyebrow" style={{ color: '#ffd7d9' }}>Kết quả D-day · bill hợp lệ</div>
        <div style={{ fontSize: 36, fontWeight: 800, marginTop: 8, letterSpacing: '-0.02em' }}>{vnd(d.mch_value_vnd)}</div>
        <div className="small" style={{ opacity: 0.9, marginTop: 4 }}>{d.bills} bill MCH · {d.shifts} ca · {d.hours} giờ công tự khai{d.units_per_bill != null && ` · ${d.units_per_bill} SP/bill`}</div>
      </div>
      <div className="grid2" style={{ marginTop: 12 }}>
        {tiles.map(({ icon: Icon, label, value, warn }) => (
          <div key={label} className="card" style={{ padding: 14 }}>
            <Icon size={18} color={warn ? 'var(--l2)' : 'var(--red)'} />
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{value}</div>
            <div className="tiny muted">{label}</div>
          </div>
        ))}
      </div>

      <div className="section-title">Sản lượng theo SKU</div>
      <div className="card" style={{ padding: '6px 14px' }}>
        {d.skus.length === 0 && <p className="small muted" style={{ padding: '10px 0' }}>Chưa có bill MCH hợp lệ.</p>}
        {d.skus.map((s, i) => {
          const brand = BRANDS.find((b) => b.slug === s.slug)
          return (
            <div key={s.brand + s.name} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
              <div className="row small">
                {brand ? <BrandVisual brand={brand} size={30} /> : <span style={{ width: 30 }} />}
                <span className="grow truncate"><b>{s.brand}</b> · {s.name}</span>
                <span className="muted">×{s.qty}</span>
                <b>{vnd(s.amount)}</b>
              </div>
              <div className="bar" style={{ marginTop: 6, height: 6 }}><i style={{ width: `${(100 * s.amount) / max}%` }} /></div>
            </div>
          )
        })}
      </div>

      <button className="btn dark block" style={{ marginTop: 14 }} onClick={exportCsv} disabled={exporting}><Download size={17} /> Xuất CSV cho Google Sheets</button>
      <div className="note" style={{ marginTop: 14 }}>
        <Info size={18} style={{ flexShrink: 0 }} />
        <span>
          Chỉ tính bill Hợp lệ đã được PG xác nhận. Giá trị theo giá thực trên bill, chưa chuẩn hóa giá. Giờ công tự khai chưa được kiểm chứng.
          Bill chứng minh giao dịch, chưa chứng minh giao dịch do PG tạo ra; đây chưa phải bằng chứng tác động của đào tạo.
        </span>
      </div>
    </section>
  )
}
