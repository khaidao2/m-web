'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { getToken } from '@/lib/auth'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

const COLORS = [
  { bg: '#C8102E', light: '#FF2D55', icon: '🔴' },
  { bg: '#0047AB', light: '#1E90FF', icon: '🔵' },
  { bg: '#FFB800', light: '#FFD700', icon: '🟡', dark: true },
  { bg: '#137333', light: '#22C55E', icon: '🟢' },
]

interface Question {
  id: string
  text: string
  image_url?: string
  options: { id: string; text: string }[]
}
interface Quiz {
  id: string
  title: string
  questions: Question[]
}
interface Attempt { id: string }

type Phase = 'loading' | 'countdown' | 'question' | 'reveal' | 'result'

export default function QuizPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const token   = getToken()!

  const [quiz, setQuiz]         = useState<Quiz | null>(null)
  const [attempt, setAttempt]   = useState<Attempt | null>(null)
  const [phase, setPhase]       = useState<Phase>('loading')
  const [qIdx, setQIdx]         = useState(0)
  const [timeLeft, setTimeLeft] = useState(30)
  const [selected, setSelected] = useState<string | null>(null)
  const [correct, setCorrect]   = useState<string | null>(null)
  const [answers, setAnswers]   = useState<{ question_id: string; option_id: string }[]>([])
  const [score, setScore]       = useState<number>(0)
  const [flash, setFlash]       = useState<'correct' | 'wrong' | null>(null)
  const [confetti, setConfetti] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    Promise.all([api.quiz(id, token), api.startQuiz(id, token)])
      .then(([q, a]) => { setQuiz(q); setAttempt(a); setPhase('countdown') })
      .catch(() => { toast.error('Không thể tải bài kiểm tra'); router.back() })
  }, [id])

  // Countdown before first question
  useEffect(() => {
    if (phase !== 'countdown') return
    const t = setTimeout(() => {
      setTimeLeft(30)
      setPhase('question')
    }, 1500)
    return () => clearTimeout(t)
  }, [phase])

  // Per-question timer
  useEffect(() => {
    if (phase !== 'question') return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { autoAdvance(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, qIdx])

  function autoAdvance() {
    if (timerRef.current) clearInterval(timerRef.current)
    setSelected(null)
    setCorrect(null)
    advanceQuestion()
  }

  function handleSelect(optionId: string) {
    if (selected || phase !== 'question') return
    if (timerRef.current) clearInterval(timerRef.current)

    const q = quiz!.questions[qIdx]
    setSelected(optionId)
    // For demo — in real app, correct comes from reveal endpoint
    setCorrect(q.options[0].id)
    const isCorrect = optionId === q.options[0].id

    setFlash(isCorrect ? 'correct' : 'wrong')
    setTimeout(() => setFlash(null), 600)

    if (isCorrect) setScore(s => s + 1)
    setAnswers(prev => [...prev, { question_id: q.id, option_id: optionId }])
    setPhase('reveal')
    setTimeout(() => {
      setPhase('question')
      advanceQuestion()
    }, 1800)
  }

  function advanceQuestion() {
    if (!quiz) return
    if (qIdx + 1 >= quiz.questions.length) {
      finishQuiz()
    } else {
      setQIdx(i => i + 1)
      setSelected(null)
      setCorrect(null)
      setTimeLeft(30)
    }
  }

  async function finishQuiz() {
    if (!attempt) return
    setPhase('result')
    setConfetti(true)
    try {
      await api.submitQuiz(attempt.id, answers, token)
    } catch {}
  }

  if (!quiz || phase === 'loading') {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#0A0A0F', gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#C8102E', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Đang tải bài kiểm tra...</p>
      </div>
    )
  }

  if (phase === 'result') {
    const total = quiz.questions.length
    const pct = Math.round((score / total) * 100)
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(160deg, #0A0A0F 0%, #1A0510 50%, #0A0A1A 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24, position: 'relative', overflow: 'hidden',
      }}>
        {/* Confetti particles */}
        {confetti && Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: 8, height: 8,
            background: ['#C8102E','#FFB800','#22C55E','#3B82F6','#FF2D55'][i % 5],
            borderRadius: Math.random() > 0.5 ? '50%' : 0,
            animation: `confetti ${1 + Math.random() * 2}s ${Math.random()}s forwards`,
          }} />
        ))}

        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          style={{ textAlign: 'center', zIndex: 1 }}
        >
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>
            {pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪'}
          </div>
          <h1 style={{ color: 'white', fontSize: '2rem', fontWeight: 800, marginBottom: 8 }}>
            {pct >= 80 ? 'Xuất Sắc!' : pct >= 50 ? 'Tốt lắm!' : 'Cố gắng hơn!'}
          </h1>

          <div style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20, padding: '28px 40px',
            marginBottom: 24,
          }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginBottom: 8 }}>
              Điểm số
            </div>
            <div style={{
              fontSize: '3.5rem', fontWeight: 800,
              background: 'linear-gradient(135deg, #FFB800, #FF8C00)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {pct}%
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginTop: 8 }}>
              {score} / {total} câu đúng
            </div>
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={() => router.push('/hoc')}
            style={{ marginBottom: 12 }}
          >
            🏠 Về trang chủ
          </button>
          <button className="btn btn-ghost btn-full" onClick={() => router.push('/hoc/leaderboard')}>
            🏆 Xem bảng xếp hạng
          </button>
        </motion.div>
      </div>
    )
  }

  const q     = quiz.questions[qIdx]
  const total = quiz.questions.length
  const pct   = ((qIdx) / total) * 100
  const timerPct = (timeLeft / 30) * 283

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #0A0008 0%, #160010 50%, #080A1A 100%)',
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Flash overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 50,
              background: flash === 'correct' ? '#22C55E' : '#C8102E',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Countdown phase overlay */}
      <AnimatePresence>
        {phase === 'countdown' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 60,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.8)',
            }}
          >
            <motion.div
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{ fontSize: '4rem', fontWeight: 800, color: 'white' }}
            >
              Sẵn Sàng! 🎯
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', position: 'relative' }}>
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, #C8102E, #FF2D55)',
            position: 'absolute', left: 0, top: 0,
          }}
        />
      </div>

      {/* Header */}
      <div style={{
        padding: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, padding: '8px 12px', color: 'white', cursor: 'pointer' }}
        >
          ✕
        </button>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
          Câu {qIdx + 1} / {total}
        </div>

        {/* Timer ring */}
        <div style={{ position: 'relative', width: 52, height: 52 }}>
          <svg width="52" height="52" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
            <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
            <circle
              cx="26" cy="26" r="22" fill="none"
              stroke={timeLeft <= 10 ? '#C8102E' : '#FFB800'}
              strokeWidth="4"
              strokeDasharray="138"
              strokeDashoffset={138 - (timeLeft / 30) * 138}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: timeLeft <= 10 ? '#FF4060' : 'white',
            fontWeight: 700, fontSize: '1rem',
            transition: 'color 0.3s',
          }}>
            {timeLeft}
          </div>
        </div>
      </div>

      {/* Question */}
      <div style={{ flex: 1, padding: '0 16px 16px', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={qIdx}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            {/* Question card */}
            <div style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 20,
              padding: '24px 20px',
              textAlign: 'center',
              minHeight: 140,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <p style={{ color: 'white', fontSize: '1.15rem', fontWeight: 600, lineHeight: 1.5 }}>
                {q.text}
              </p>
            </div>

            {/* Options 2×2 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {q.options.map((opt, i) => {
                const c = COLORS[i % 4]
                const isSelected = selected === opt.id
                const isCorrectOpt = correct === opt.id
                let bg = `linear-gradient(135deg, ${c.bg}, ${c.light})`
                let border = 'none'
                if (phase === 'reveal') {
                  if (isCorrectOpt) { bg = 'linear-gradient(135deg, #137333, #22C55E)'; border = '2px solid #4ADE80' }
                  else if (isSelected) { bg = 'linear-gradient(135deg, #7F1D1D, #DC2626)'; border = '2px solid #F87171' }
                  else bg = 'rgba(255,255,255,0.04)'
                }

                return (
                  <motion.button
                    key={opt.id}
                    whileTap={phase === 'question' ? { scale: 0.95 } : {}}
                    onClick={() => handleSelect(opt.id)}
                    disabled={phase !== 'question'}
                    style={{
                      background: bg,
                      border, borderRadius: 16,
                      padding: '16px 12px',
                      color: c.dark ? '#1A0A00' : 'white',
                      fontFamily: 'inherit',
                      fontSize: '0.9rem', fontWeight: 600,
                      cursor: phase === 'question' ? 'pointer' : 'default',
                      textAlign: 'left',
                      minHeight: 80,
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'all 0.3s ease',
                      boxShadow: phase === 'question' ? `0 4px 20px ${c.bg}60` : 'none',
                    }}
                  >
                    <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{c.icon}</span>
                    <span style={{ lineHeight: 1.3 }}>{opt.text}</span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
