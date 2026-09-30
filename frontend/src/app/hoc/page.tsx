'use client'
import Link from 'next/link'
import { ChevronRight, ClipboardCheck, Mic, Play, Trophy, Zap, CheckCircle2 } from 'lucide-react'
import { BRANDS } from '@/lib/products'
import { BrandVisual } from '@/components/Brand'
import QuestItem from '@/components/QuestItem'
import { ErrorBox, Loading, Stat } from '@/components/ui'
import { firstName, greeting, initials, num } from '@/lib/format'
import { useApi } from '@/lib/useApi'
import type { Leaderboard, Me, Quest } from '@/lib/types'

export default function Home() {
  const me = useApi<Me>('/me')
  const quests = useApi<Quest[]>('/quests/today')
  const board = useApi<Leaderboard>('/leaderboard?period=week')

  if (me.loading && !me.data) return <Loading />
  if (me.error || !me.data) return <div className="page"><ErrorBox error={me.error ?? ''} retry={me.reload} /></div>
  const u = me.data
  const ob = u.onboarding
  const steps = [
    { done: ob.quiz_done, icon: Zap, tone: '', title: 'Quiz phản xạ · 3 phút', sub: '10 câu · 5 nhóm · Kiến thức tại điểm bán', href: '/hoc/quiz' },
    { done: ob.voice_done, icon: Mic, tone: 'blue', title: 'Đánh giá giọng nói đầu vào', sub: '7 phút · AI đóng vai khách hàng', href: `/hoc/voice/${ob.voice_scenario}?kind=onboarding` },
    { done: ob.complete, icon: ClipboardCheck, tone: '', title: 'Xác nhận tại điểm bán', sub: 'SUP bổ sung số liệu & quan sát', href: '/hoc/passport' },
  ]
  const doneSteps = steps.filter((s) => s.done).length
  const next = !ob.quiz_done ? steps[0] : !ob.voice_done ? steps[1] : null
  const pending = quests.data?.filter((q) => !q.done) ?? []

  return (
    <main className="page">
      <section className="row between rise" style={{ margin: '6px 2px 16px' }}>
        <div className="grow">
          <div className="eyebrow">Hành trình thực chiến</div>
          <h1 className="h1" style={{ marginTop: 6 }}>{greeting()}, {firstName(u.full_name)}!</h1>
          <p className="muted small truncate" style={{ marginTop: 4 }}>{u.store_name ?? 'Cập nhật cửa hàng trong hồ sơ'} · BHX HCM</p>
        </div>
        <div className="tile" style={{ width: 48, height: 48, fontWeight: 800 }}>{initials(u.full_name)}</div>
      </section>

      <section className="rise" style={{
        position: 'relative', overflow: 'hidden', borderRadius: 22, padding: 22, color: '#fff',
        background: 'linear-gradient(135deg, #d71920 0%, #b3121b 100%)', boxShadow: 'var(--shadow-red)',
      }}>
        <span aria-hidden style={{ position: 'absolute', right: -6, bottom: -26, fontSize: 120, fontWeight: 800, opacity: 0.1, lineHeight: 1 }}>
          {next ? '03' : String(pending.length).padStart(2, '0')}
        </span>
        <span className="chip" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}><Zap size={13} /> Mỗi ngày một bước tiến</span>
        {next ? (
          <>
            <h2 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.25, marginTop: 14 }}>{next === steps[0] ? <>3 phút hôm nay.<br />Tự tin cả ca làm.</> : <>7 phút với AI.<br />Biết mình mạnh ở đâu.</>}</h2>
            <p style={{ opacity: 0.88, fontSize: 13.5, marginTop: 8 }}>{next === steps[0] ? 'Khởi động kiến thức, sẵn sàng đón khách.' : 'Hoàn thành bài đầu vào để mở Digital Passport.'}</p>
            <Link href={next.href} className="btn" style={{ background: '#fff', color: 'var(--red-deep)', marginTop: 16, height: 46 }}>
              <Play size={17} /> {next === steps[0] ? 'Bắt đầu quiz hôm nay' : 'Bắt đầu đánh giá giọng nói'}
            </Link>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.25, marginTop: 14 }}>
              {pending.length ? <>{pending.length} nhiệm vụ 3 phút<br />đang chờ bạn.</> : <>Xong nhiệm vụ hôm nay.<br />Giữ vững phong độ!</>}
            </h2>
            <p style={{ opacity: 0.88, fontSize: 13.5, marginTop: 8 }}>Bài luyện nhắm thẳng vào điểm nghẽn trên Passport của bạn.</p>
            <Link href={pending[0] ? `/hoc/voice/${pending[0].scenario.code}?quest=${pending[0].id}` : '/hoc/quiz'} className="btn"
              style={{ background: '#fff', color: 'var(--red-deep)', marginTop: 16, height: 46 }}>
              <Play size={17} /> {pending.length ? 'Luyện ngay' : 'Chơi thử thách 180 giây'}
            </Link>
          </>
        )}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
        <Stat value={num(u.stats.points)} label="Điểm tích lũy" accent />
        <Stat value={u.stats.days_learned} label="Ngày đã học" />
        <Stat value={u.stats.open_flags} label="Điểm cần cải thiện" />
      </section>

      {!ob.complete ? (
        <>
          <div className="section-title">Lộ trình của bạn <span className="chip">{doneSteps}/3 đầu vào</span></div>
          {steps.map((s) => (
            <Link key={s.title} href={s.href} className="item">
              <div className={`tile ${s.done ? 'green' : s.tone}`}>{s.done ? <CheckCircle2 size={21} /> : <s.icon size={21} />}</div>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{s.title}</div>
                <div className="tiny muted">{s.sub}</div>
              </div>
              <ChevronRight size={18} color="var(--muted)" />
            </Link>
          ))}
        </>
      ) : (
        <>
          <div className="section-title">Nhiệm vụ hôm nay <Link href="/hoc/quests">Tất cả <ChevronRight size={14} /></Link></div>
          {quests.error && <ErrorBox error={quests.error} retry={quests.reload} />}
          {quests.data?.slice(0, 3).map((q) => <QuestItem key={q.id} quest={q} />)}
        </>
      )}

      <div className="section-title">Hiểu sản phẩm, bán tự tin <Link href="/hoc/quiz">Khám phá <ChevronRight size={14} /></Link></div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', margin: '0 -16px', padding: '2px 16px 8px', scrollSnapType: 'x mandatory' }}>
        {BRANDS.map((b) => (
          <Link key={b.slug} href={`/hoc/quiz?brand=${b.slug}`} className="card" style={{ minWidth: 132, textAlign: 'center', scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <BrandVisual brand={b} size={76} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{b.name}</div>
              <div className="tiny muted">{b.category}</div>
            </div>
          </Link>
        ))}
      </div>

      <Link href="/hoc/leaderboard" className="item" style={{ marginTop: 14 }}>
        <div className="tile amber"><Trophy size={21} /></div>
        <div className="grow">
          <div style={{ fontWeight: 600 }}>Bảng vàng PG NEXUS</div>
          <div className="tiny muted">
            {board.data?.me ? `Hạng #${board.data.me.rank}/${board.data.me.total_pgs} tuần này · ${num(board.data.me.points)} điểm` : 'Xem vị trí và tiến bộ của bạn'}
          </div>
        </div>
        <ChevronRight size={18} color="var(--muted)" />
      </Link>
    </main>
  )
}
