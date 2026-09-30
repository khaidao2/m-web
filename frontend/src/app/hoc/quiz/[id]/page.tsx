'use client'
import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Circle, Clock, Diamond, Flame, Mic, RotateCcw, Square, Triangle, X, type LucideIcon } from 'lucide-react'
import { NamedIcon } from '@/components/icons'
import { ErrorBox, Loading } from '@/components/ui'
import { api } from '@/lib/api'
import type { Me } from '@/lib/types'

type Question = {
  id: string
  category: string
  prompt: string
  options: string[]
  visual: { icon: string; tone: string; label: string }
  answered?: { choice: number | null; correct: boolean; points: number }
  answer?: number
  explain?: string
}
type Result = { correct: number; total: number; points: number; leaderboard_points: number; percent: number; by_category: Record<string, { correct: number; total: number }> }
type Attempt = {
  attempt_id: string
  started_at: string
  time_limit_seconds: number
  question_seconds: number
  categories: Record<string, { label: string }>
  note: string
  questions: Question[]
  result: Result | null
}
type Feedback = { correct: boolean; answer: number; explain: string; points: number; streak: number; choice: number | null }

const TILES: { color: string; shape: LucideIcon }[] = [
  { color: '#e21b3c', shape: Triangle },
  { color: '#1368ce', shape: Diamond },
  { color: '#d89e00', shape: Circle },
  { color: '#26890c', shape: Square },
]
const TONES: Record<string, string> = { red: '#d71920', amber: '#e08a00', blue: '#2f6fed', green: '#12a150', brown: '#7a4a24' }

export default function QuizGame({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [score, setScore] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [qStart, setQStart] = useState(() => Date.now())
  const [me, setMe] = useState<Me | null>(null)
  const sending = useRef(false)

  useEffect(() => {
    api<Attempt>(`/quiz/${id}`)
      .then((a) => {
        setAttempt(a)
        setResult(a.result)
        const first = a.questions.findIndex((q) => !q.answered)
        setIndex(first === -1 ? a.questions.length : first)
        setScore(a.questions.reduce((s, q) => s + (q.answered?.points ?? 0), 0))
        setQStart(Date.now())
      })
      .catch((e) => setError(e.message))
    api<Me>('/me').then(setMe).catch(() => {})
  }, [id])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const finish = useCallback(async () => {
    if (sending.current) return
    sending.current = true
    try {
      setResult(await api<Result>(`/quiz/${id}/finish`, { method: 'POST' }))
      api<Me>('/me').then(setMe).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không nộp được bài')
    } finally {
      sending.current = false
    }
  }, [id])

  const choose = useCallback(async (choice: number | null) => {
    if (!attempt || feedback || sending.current) return
    const q = attempt.questions[index]
    sending.current = true
    try {
      const fb = await api<Omit<Feedback, 'choice'>>(`/quiz/${id}/answer`, {
        method: 'POST', json: { question_id: q.id, choice, time_ms: Date.now() - qStart },
      })
      setFeedback({ ...fb, choice })
      setScore((s) => s + fb.points)
    } catch (e) {
      // time is up on the server: close the attempt
      sending.current = false
      if (e instanceof Error && /hết|kết thúc/.test(e.message)) return finish()
      setError(e instanceof Error ? e.message : 'Lỗi gửi câu trả lời')
    }
    sending.current = false
  }, [attempt, feedback, finish, id, index, qStart])

  const next = useCallback(() => {
    if (!attempt) return
    setFeedback(null)
    setQStart(Date.now())
    if (index + 1 >= attempt.questions.length) {
      setIndex(attempt.questions.length)
      void finish()
    } else setIndex(index + 1)
  }, [attempt, finish, index])

  // timers: `now` only drives the display; expiry is scheduled so state changes happen in callbacks
  const totalLeft = attempt ? Math.max(0, attempt.time_limit_seconds - (now - Date.parse(attempt.started_at)) / 1000) : 0
  const qLeft = attempt ? Math.max(0, attempt.question_seconds - (now - qStart) / 1000) : 0
  useEffect(() => {
    if (!attempt || result || index >= attempt.questions.length) return
    const totalMs = Date.parse(attempt.started_at) + attempt.time_limit_seconds * 1000 - Date.now()
    const questionMs = feedback ? Infinity : qStart + attempt.question_seconds * 1000 - Date.now()
    const t = setTimeout(() => void (totalMs <= questionMs ? finish() : choose(null)), Math.max(0, Math.min(totalMs, questionMs)))
    return () => clearTimeout(t)
  }, [attempt, choose, feedback, finish, index, qStart, result])
  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(next, feedback.correct ? 1600 : 3200)
    return () => clearTimeout(t)
  }, [feedback, next])

  if (error) return <main className="page"><ErrorBox error={error} retry={() => router.refresh()} /></main>
  if (!attempt) return <Loading label="Đang chuẩn bị câu hỏi…" />
  if (result) return <ResultView attempt={attempt} result={result} me={me} />
  if (index >= attempt.questions.length) return <Loading label="Đang chấm điểm…" />

  const q = attempt.questions[index]
  const tone = TONES[q.visual.tone] ?? TONES.red
  const mm = Math.floor(totalLeft / 60)
  const ss = String(Math.floor(totalLeft % 60)).padStart(2, '0')

  return (
    <main className="page bare" style={{ paddingTop: 4 }}>
      <div className="row between small" style={{ fontWeight: 700 }}>
        <span>Câu {index + 1}/{attempt.questions.length}</span>
        <span className="chip" style={{ color: totalLeft < 30 ? 'var(--red)' : undefined }}><Clock size={13} /> {mm}:{ss}</span>
        <span className="chip dark">{score.toLocaleString('vi-VN')} điểm</span>
      </div>
      <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${(index / attempt.questions.length) * 100}%` }} /></div>

      <section className="card pop" key={q.id} style={{ marginTop: 14, padding: 0, overflow: 'hidden' }}>
        <div style={{ position: 'relative', height: 130, display: 'grid', placeItems: 'center', color: '#fff',
          background: `radial-gradient(circle at 20% 20%, color-mix(in srgb, ${tone} 55%, white), ${tone} 75%)` }}>
          <NamedIcon name={q.visual.icon} size={58} strokeWidth={1.6} />
          <span className="chip" style={{ position: 'absolute', left: 12, top: 12, background: 'rgba(255,255,255,.2)', color: '#fff' }}>
            {attempt.categories[q.category]?.label}
          </span>
          <span style={{ position: 'absolute', left: 12, bottom: 10, fontWeight: 700, fontSize: 13, opacity: 0.9 }}>{q.visual.label}</span>
          <CountRing left={qLeft} total={attempt.question_seconds} />
        </div>
        <h2 style={{ fontSize: 17.5, fontWeight: 700, lineHeight: 1.35, padding: 16 }}>{q.prompt}</h2>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        {q.options.map((opt, i) => {
          const { color, shape: Shape } = TILES[i]
          const isAnswer = feedback && feedback.answer === i
          const dim = feedback && !isAnswer && feedback.choice !== i
          return (
            <button key={i} onClick={() => choose(i)} disabled={Boolean(feedback)}
              style={{
                minHeight: 92, borderRadius: 16, padding: 12, background: color, color: '#fff', textAlign: 'left',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8, fontWeight: 600, fontSize: 14,
                opacity: dim ? 0.35 : 1, boxShadow: isAnswer ? '0 0 0 4px #fff, 0 0 0 7px ' + color : '0 4px 0 rgba(0,0,0,.18)',
                transition: 'opacity .2s, box-shadow .2s',
              }}>
              <span className="row between" style={{ width: '100%' }}>
                <Shape size={20} fill="#fff" />
                {isAnswer && <Check size={20} />}
                {feedback && feedback.choice === i && !feedback.correct && <X size={20} />}
              </span>
              <span style={{ lineHeight: 1.3 }}>{opt}</span>
            </button>
          )
        })}
      </section>

      {feedback && (
        <section className="card pop" style={{ marginTop: 12, borderTop: `4px solid ${feedback.correct ? 'var(--green)' : 'var(--red)'}` }} onClick={next}>
          <div className="row between">
            <b style={{ color: feedback.correct ? 'var(--green)' : 'var(--red)', fontSize: 17 }}>
              {feedback.choice === null ? 'Hết giờ!' : feedback.correct ? 'Chính xác!' : 'Chưa đúng'}
            </b>
            {feedback.correct && (
              <span className="row" style={{ gap: 6 }}>
                {feedback.streak >= 3 && <span className="chip amber"><Flame size={13} /> Chuỗi {feedback.streak}</span>}
                <span className="chip green">+{feedback.points}</span>
              </span>
            )}
          </div>
          <p className="small" style={{ marginTop: 6, color: 'var(--ink-2)' }}>{feedback.explain}</p>
          <p className="tiny muted" style={{ marginTop: 6 }}>Chạm để sang câu tiếp</p>
        </section>
      )}
      <p className="tiny muted" style={{ textAlign: 'center', marginTop: 14 }}>{attempt.note}</p>
    </main>
  )
}

function CountRing({ left, total }: { left: number; total: number }) {
  const r = 17
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'absolute', right: 12, top: 12, width: 42, height: 42 }} aria-label={`Còn ${Math.ceil(left)} giây`}>
      <svg width="42" height="42" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="21" cy="21" r={r} fill="rgba(0,0,0,.18)" stroke="rgba(255,255,255,.3)" strokeWidth="4" />
        <circle cx="21" cy="21" r={r} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - left / total)} />
      </svg>
      <b style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 14 }}>{Math.ceil(left)}</b>
    </div>
  )
}

function ResultView({ attempt, result, me }: { attempt: Attempt; result: Result; me: Me | null }) {
  const router = useRouter()
  const [again, setAgain] = useState(false)
  const needVoice = me && !me.onboarding.voice_done
  const tone = result.percent >= 80 ? 'var(--green)' : result.percent >= 50 ? 'var(--l2)' : 'var(--red)'

  async function replay() {
    setAgain(true)
    const { attempt_id } = await api<{ attempt_id: string }>('/quiz/start', { method: 'POST' })
    router.push(`/hoc/quiz/${attempt_id}`)
  }

  return (
    <main className="page bare">
      <section className="card pop" style={{ textAlign: 'center', padding: 24 }}>
        <div className="eyebrow">Kết quả thử thách 180 giây</div>
        <div style={{ fontSize: 56, fontWeight: 800, color: tone, marginTop: 8, lineHeight: 1 }}>{result.percent}%</div>
        <div className="muted" style={{ marginTop: 6 }}>{result.correct}/{result.total} câu đúng</div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
          <span className="chip dark">{result.points.toLocaleString('vi-VN')} điểm game</span>
          <span className="chip green">+{result.leaderboard_points} điểm tích lũy</span>
        </div>
      </section>

      <section className="card">
        <b>Theo nhóm kiến thức</b>
        {Object.entries(result.by_category).map(([cat, r]) => (
          <div key={cat} style={{ marginTop: 12 }}>
            <div className="row between small"><span>{attempt.categories[cat]?.label ?? cat}</span><b>{r.correct}/{r.total}</b></div>
            <div className="bar" style={{ marginTop: 6 }}>
              <i style={{ width: `${r.total ? (r.correct / r.total) * 100 : 0}%`, background: r.correct === r.total ? 'var(--green)' : r.correct ? 'var(--l2)' : 'var(--red)' }} />
            </div>
          </div>
        ))}
      </section>

      <div className="stack" style={{ marginTop: 16 }}>
        {needVoice && (
          <Link href={`/hoc/voice/${me!.onboarding.voice_scenario}?kind=onboarding`} className="btn primary block">
            <Mic size={18} /> Tiếp tục: đánh giá giọng nói 7 phút
          </Link>
        )}
        <button className={`btn block ${needVoice ? 'ghost' : 'primary'}`} onClick={replay} disabled={again}><RotateCcw size={18} /> Chơi lượt mới</button>
        <Link href="/hoc/passport" className="btn ghost block">Xem Passport năng lực</Link>
      </div>
    </main>
  )
}
