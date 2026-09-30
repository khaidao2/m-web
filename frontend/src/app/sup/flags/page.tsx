'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Flag, Headphones } from 'lucide-react'
import { Empty, ErrorBox, Loading, PageHead } from '@/components/ui'
import { FLAG_STATUS, score1 } from '@/lib/format'
import { useApi } from '@/lib/useApi'
import type { QueueFlag } from '@/lib/supTypes'

export default function FlagQueue() {
  const [status, setStatus] = useState<'' | 'ready' | 'open' | 'closed'>('')
  const q = useApi<QueueFlag[]>(`/sup/flags${status ? `?status=${status}` : ''}`)
  return (
    <main className="page">
      <PageHead eyebrow="Field verification" title="Hàng chờ Red Flag" sub="Chờ SUP xác nhận: AI đã chấm từ 7,0. Đóng Red Flag khi bạn xác nhận ≥ 7,0 tại điểm bán." />
      <div className="tabs" role="tablist">
        {([['', 'Đang mở'], ['ready', 'Chờ xác nhận'], ['closed', 'Đã đóng']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={status === k} onClick={() => setStatus(k)}>{l}</button>
        ))}
      </div>
      {q.loading && <Loading />}
      {q.error && <ErrorBox error={q.error} retry={q.reload} />}
      <div style={{ marginTop: 14 }}>
        {q.data?.length === 0 && <Empty icon={<Flag size={20} />} title="Không có Red Flag" />}
        {q.data?.map((f) => (
          <article key={f.id} className="card" style={{ marginTop: 10 }}>
            <div className="row between">
              <Link href={`/sup/pg/${f.pg.id}`} style={{ fontWeight: 700 }}>{f.pg.name}</Link>
              <span className={`chip ${FLAG_STATUS[f.status].chip}`}>{FLAG_STATUS[f.status].label}</span>
            </div>
            <div className="small" style={{ marginTop: 6 }}>{f.competency.toUpperCase()} · {f.competency_name}</div>
            <div className="tiny muted" style={{ marginTop: 2 }}>
              Mở {new Date(f.opened_at).toLocaleDateString('vi-VN')} ở {score1(f.opened_score)} · hiện tại {score1(f.current_score)}
              {f.sup_score !== null && ` · SUP ${score1(f.sup_score)}`}
            </div>
            {f.latest_session ? (
              <Link href={`/sup/phien/${f.latest_session.id}?flag=${f.id}`} className="btn sm dark" style={{ marginTop: 12 }}>
                <Headphones size={16} /> Nghe bài làm & Stamp <ChevronRight size={15} />
              </Link>
            ) : (
              <p className="tiny muted" style={{ marginTop: 10 }}>PG chưa có bài hội thoại cho năng lực này.</p>
            )}
          </article>
        ))}
      </div>
    </main>
  )
}
