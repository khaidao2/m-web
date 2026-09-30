'use client'
import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Crown, Medal, Minus, Sparkles, Star, Target, Trophy } from 'lucide-react'
import { ErrorBox, LevelChip, Loading, PageHead } from '@/components/ui'
import { initials, num, score1 } from '@/lib/format'
import { useApi } from '@/lib/useApi'
import type { LeaderEntry, Leaderboard } from '@/lib/types'

const PERIODS = [['week', 'Tuần này'], ['month', 'Tháng này'], ['quarter', 'Quý này']] as const
const PODIUM = [
  { place: 2, color: 'var(--silver)', bg: '#eef1f6', h: 92 },
  { place: 1, color: 'var(--gold)', bg: '#fff3cc', h: 118 },
  { place: 3, color: 'var(--bronze)', bg: '#f8e6d8', h: 78 },
]

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="tiny muted">mới</span>
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus
  const color = pct > 0 ? 'var(--green)' : pct < 0 ? 'var(--red)' : 'var(--muted)'
  return <span className="tiny row" style={{ gap: 2, color, fontWeight: 700 }}><Icon size={13} />{Math.abs(pct)}%</span>
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Leaderboard['period']>('month')
  const board = useApi<Leaderboard>(`/leaderboard?period=${period}`)
  const entries = board.data?.entries ?? []
  const top = [entries[1], entries[0], entries[2]] as (LeaderEntry | undefined)[]
  const me = board.data?.me

  return (
    <main className="page">
      <PageHead eyebrow="Bảng vàng PG NEXUS" title="Cùng học. Cùng bứt phá." sub="Thành tích thật từ hành trình học của mỗi người." />
      <div className="tabs" role="tablist">
        {PERIODS.map(([k, label]) => <button key={k} role="tab" aria-selected={period === k} onClick={() => setPeriod(k)}>{label}</button>)}
      </div>

      {board.loading && !board.data && <Loading />}
      {board.error && <ErrorBox error={board.error} retry={board.reload} />}

      {board.data && (
        <>
          <section className="card" style={{ marginTop: 14 }}>
            <div className="row between"><b>Top 3 nổi bật</b><Trophy size={20} color="var(--gold)" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 1fr', gap: 8, alignItems: 'end', marginTop: 16 }}>
              {PODIUM.map(({ place, color, bg, h }, i) => {
                const e = top[i]
                return (
                  <div key={place} className="rise" style={{ textAlign: 'center', animationDelay: `${i * 80}ms` }}>
                    {place === 1 && <Crown size={22} color={color} fill={color} style={{ margin: '0 auto 2px', display: 'block' }} />}
                    <div style={{ width: place === 1 ? 58 : 48, height: place === 1 ? 58 : 48, margin: '0 auto', borderRadius: '50%', display: 'grid', placeItems: 'center',
                      fontWeight: 800, background: '#fff', border: `3px solid ${color}`, color: 'var(--ink)', fontSize: place === 1 ? 18 : 15 }}>
                      {e ? initials(e.name) : '—'}
                    </div>
                    <div className="tiny truncate" style={{ fontWeight: 700, marginTop: 6 }}>{e?.name ?? 'Chờ người học'}</div>
                    <div style={{ height: h, marginTop: 8, borderRadius: '14px 14px 6px 6px', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderTop: `4px solid ${color}` }}>
                      <b style={{ fontSize: 24, color }}>{place}</b>
                      <span className="tiny" style={{ fontWeight: 600 }}>{num(e?.points ?? 0)} điểm</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {me && (
            <section className="card" style={{ marginTop: 14, border: '1.5px solid var(--red)' }}>
              <div className="row between">
                <div className="row"><div className="tile"><Star size={20} /></div>
                  <div><b>Vị trí của bạn: #{me.rank}</b><div className="tiny muted">{num(me.points)} điểm trong kỳ · {me.total_pgs} PG</div></div>
                </div>
                <Change pct={me.change_pct} />
              </div>
              <div className="divider" />
              <div className="small">
                {me.rank === 1 ? 'Bạn đang dẫn đầu — giữ vững phong độ!' : <>Còn <b>{num(me.gap_to_next)} điểm</b> để vượt lên hạng #{me.rank - 1}.</>}
                <span className="muted"> Kỳ trước: {num(me.previous_points)} điểm.</span>
              </div>
              <div style={{ marginTop: 10 }}><LevelChip level={me.level} /></div>
              <div className="grid2" style={{ marginTop: 12 }}>
                <div style={{ padding: 12, borderRadius: 12, background: 'var(--green-bg)' }}>
                  <div className="row tiny" style={{ color: 'var(--green)', fontWeight: 700, gap: 4 }}><Sparkles size={13} /> Cần phát huy</div>
                  <div className="small" style={{ fontWeight: 600, marginTop: 4 }}>{me.strongest ? `${me.strongest.name} · ${score1(me.strongest.score)}` : 'Chưa đủ dữ liệu'}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 12, background: 'var(--red-soft)' }}>
                  <div className="row tiny" style={{ color: 'var(--red)', fontWeight: 700, gap: 4 }}><Target size={13} /> Cần cải thiện</div>
                  <div className="small" style={{ fontWeight: 600, marginTop: 4 }}>{me.weakest ? `${me.weakest.name} · ${score1(me.weakest.score)}` : 'Chưa đủ dữ liệu'}</div>
                </div>
              </div>
            </section>
          )}

          <div className="section-title">Bảng xếp hạng</div>
          <section className="card" style={{ padding: '4px 14px' }}>
            {entries.map((e) => (
              <div key={e.user_id} className="row" style={{ padding: '11px 0', borderTop: e.rank > 1 ? '1px solid var(--line)' : undefined, background: e.is_me ? 'var(--red-soft)' : undefined, margin: e.is_me ? '0 -14px' : undefined, paddingInline: e.is_me ? 14 : undefined }}>
                <span style={{ width: 26, textAlign: 'center', fontWeight: 800, color: e.rank === 1 ? 'var(--gold)' : e.rank === 2 ? 'var(--silver)' : e.rank === 3 ? 'var(--bronze)' : 'var(--muted)' }}>
                  {e.rank <= 3 ? <Medal size={18} style={{ verticalAlign: -3 }} /> : e.rank}
                </span>
                <div className="grow">
                  <div className="small truncate" style={{ fontWeight: 600 }}>{e.name}{e.is_me && ' (bạn)'} {e.is_demo && <span className="chip" style={{ height: 18, fontSize: 10 }}>Demo</span>}</div>
                  <div className="tiny muted truncate">{e.store ?? 'BHX HCM'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="small" style={{ fontWeight: 700 }}>{num(e.points)}</div>
                  <Change pct={e.change_pct} />
                </div>
              </div>
            ))}
          </section>
          <p className="tiny muted" style={{ marginTop: 12 }}>
            Top 3 tháng/quý được ghi nhận. Phần thưởng cụ thể chờ phê duyệt. Điểm: quiz (theo tốc độ & độ chính xác), bài luyện AI (điểm × 10), +20 khi hoàn thành nhiệm vụ.
          </p>
        </>
      )}
    </main>
  )
}
