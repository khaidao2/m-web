'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, History, Lightbulb, Zap } from 'lucide-react'
import { BrandVisual } from '@/components/Brand'
import { Empty, PageHead } from '@/components/ui'
import { api } from '@/lib/api'
import { BRANDS, SALES_STEPS } from '@/lib/products'
import { useApi } from '@/lib/useApi'

type Tab = 'product' | 'skill' | 'history'
type HistoryRow = { attempt_id: string; correct: number; total: number; percent: number; points: number; completed_at: string }

const COMPETENCY_TIPS = [
  ['C1', 'Tiếp cận & kết nối', 'Phản xạ tiếp cận dưới 2 giây, giọng thân thiện tự nhiên.'],
  ['C2', 'Khơi gợi nhu cầu', 'Câu hỏi mở và nhắc lại ý chính để xác nhận.'],
  ['C3', 'Tư vấn giải pháp', 'Dùng đúng USP, giải thích mượt khi đổi SKU/packsize.'],
  ['C4', 'Gia tăng giỏ hàng', 'Ghép cặp chéo ngành: Mì + Tương ớt, Nước mắm + Hạt nêm.'],
  ['C5', 'Xử lý phản bác', 'Bình tĩnh, lắng nghe hết câu, đồng cảm rồi mới giải thích.'],
  ['C6', 'Đàm phán & thuyết phục', 'Dùng số liệu tồn kho, sell-out khi làm việc với CHT.'],
  ['C7', 'Thái độ & kỷ luật', 'Đúng giờ, đúng tác phong, hoàn thành bài luyện mỗi ngày.'],
]

function Learn() {
  const router = useRouter()
  const params = useSearchParams()
  const focus = params.get('brand')
  const [tab, setTab] = useState<Tab>('product')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const history = useApi<HistoryRow[]>(tab === 'history' ? '/quiz/history' : null)

  async function start() {
    setStarting(true)
    setError(null)
    try {
      const { attempt_id } = await api<{ attempt_id: string }>('/quiz/start', { method: 'POST' })
      router.push(`/hoc/quiz/${attempt_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không bắt đầu được')
      setStarting(false)
    }
  }

  return (
    <main className="page">
      <PageHead eyebrow="Học tập" title="Nhỏ mỗi ngày. Nhớ thật lâu." sub="Kiến thức sản phẩm và kỹ năng dùng ngay tại điểm bán." />

      <section className="rise" style={{ borderRadius: 22, padding: 22, color: '#fff', background: 'linear-gradient(135deg, #d71920, #a3121a)', boxShadow: 'var(--shadow-red)' }}>
        <span className="chip" style={{ background: '#ffe9a8', color: '#6d4a00' }}>Bộ câu hỏi giả lập</span>
        <h2 style={{ fontSize: 23, fontWeight: 700, marginTop: 12 }}>Thử thách 180 giây</h2>
        <p style={{ opacity: 0.9, fontSize: 13.5, marginTop: 6 }}>30 câu trong ngân hàng · Mỗi lượt bốc 10 câu, 2 câu mỗi nhóm. Trả lời càng nhanh, điểm càng cao.</p>
        <button className="btn" style={{ background: '#fff', color: 'var(--red-deep)', marginTop: 16, height: 46 }} onClick={start} disabled={starting}>
          <Zap size={17} /> {starting ? 'Đang chuẩn bị…' : 'Chơi ngay'}
        </button>
        {error && <p className="small" style={{ marginTop: 10 }}>{error}</p>}
      </section>

      <div className="tabs" role="tablist" style={{ marginTop: 18 }}>
        {([['product', 'Sản phẩm'], ['skill', 'Kỹ năng'], ['history', 'Lịch sử']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'product' && (
        <section style={{ marginTop: 14 }}>
          <div className="note"><Lightbulb size={18} /> Hình minh họa theo nhãn hàng. Danh mục SKU MT và tài liệu USP chính thức đang chờ Sales Cap cung cấp.</div>
          <div className="grid2" style={{ marginTop: 12 }}>
            {BRANDS.map((b) => (
              <article key={b.slug} className="card" style={{ outline: focus === b.slug ? '2px solid var(--red)' : undefined, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', placeItems: 'center' }}><BrandVisual brand={b} size={72} /></div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700 }}>{b.name}</div>
                  <div className="tiny muted">{b.category}</div>
                </div>
                <ul className="tiny" style={{ paddingLeft: 16, color: 'var(--ink-2)' }}>
                  {b.usp.map((u) => <li key={u}>{u}</li>)}
                </ul>
                {b.pair && <span className="chip blue" style={{ alignSelf: 'center' }}>Combo: {b.pair}</span>}
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'skill' && (
        <section style={{ marginTop: 14 }}>
          <div className="card">
            <b>Quy trình 5 bước bán hàng</b>
            <ol style={{ listStyle: 'none', marginTop: 10 }}>
              {SALES_STEPS.map((s, i) => (
                <li key={s.title} className="row" style={{ alignItems: 'flex-start', padding: '10px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
                  <span className="tile" style={{ width: 30, height: 30, borderRadius: 9, fontWeight: 800, fontSize: 14 }}>{i + 1}</span>
                  <div><div style={{ fontWeight: 600 }}>{s.title}</div><div className="small muted">{s.text}</div></div>
                </li>
              ))}
            </ol>
          </div>
          <div className="section-title">Bộ 7 năng lực Masan</div>
          {COMPETENCY_TIPS.map(([code, name, tip]) => (
            <div key={code} className="item">
              <div className="tile dark" style={{ fontWeight: 800, fontSize: 13 }}>{code}</div>
              <div className="grow"><div style={{ fontWeight: 600 }}>{name}</div><div className="tiny muted">{tip}</div></div>
            </div>
          ))}
        </section>
      )}

      {tab === 'history' && (
        <section style={{ marginTop: 14 }}>
          {history.data?.length === 0 && <Empty icon={<History size={20} />} title="Chưa có lượt quiz nào" text="Hoàn thành thử thách 180 giây để xem lịch sử." />}
          {history.data?.map((h) => (
            <Link key={h.attempt_id} href={`/hoc/quiz/${h.attempt_id}`} className="item">
              <div className="tile" style={{ fontWeight: 800, fontSize: 13 }}>{h.percent}%</div>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{h.correct}/{h.total} câu đúng · {h.points.toLocaleString('vi-VN')} điểm</div>
                <div className="tiny muted">{new Date(h.completed_at).toLocaleString('vi-VN')}</div>
              </div>
              <ChevronRight size={18} color="var(--muted)" />
            </Link>
          ))}
        </section>
      )}
    </main>
  )
}

export default function LearnPage() {
  return <Suspense><Learn /></Suspense>
}
