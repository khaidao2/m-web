'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getToken } from '@/lib/auth'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

interface Scenario {
  id: string
  title: string
  description: string
  persona_name: string
  persona_role: string
  type: string
  difficulty: number
}

interface Message {
  role: 'user' | 'assistant'
  text: string
}

type MicState = 'idle' | 'recording' | 'processing'
type AppState = 'select' | 'session'

const MAX_DURATION = 7 * 60

export default function VoicePage() {
  const [appState, setAppState] = useState<AppState>('select')
  const [scenarios, setScenarios]   = useState<Scenario[]>([])
  const [scenario, setScenario]     = useState<Scenario | null>(null)
  const [sessionId, setSessionId]   = useState<string | null>(null)
  const [messages, setMessages]     = useState<Message[]>([])
  const [micState, setMicState]     = useState<MicState>('idle')
  const [sessionSecs, setSessionSecs] = useState(0)
  const [loadingScenarios, setLoadingScenarios] = useState(true)

  const recorderRef   = useRef<MediaRecorder | null>(null)
  const chunksRef     = useRef<Blob[]>([])
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef      = useRef<HTMLAudioElement | null>(null)
  const chatEndRef    = useRef<HTMLDivElement>(null)
  const token         = getToken()!

  useEffect(() => {
    api.scenarios(token)
      .then(d => { setScenarios(Array.isArray(d) ? d : []); setLoadingScenarios(false) })
      .catch(() => setLoadingScenarios(false))
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function startSession(sc: Scenario) {
    try {
      const session = await api.createSession(sc.id, token)
      setSessionId(session.id)
      setScenario(sc)
      setMessages([{
        role: 'assistant',
        text: `Xin chào! Tôi là ${sc.persona_name}. Hãy bắt đầu cuộc trò chuyện nào!`,
      }])
      setAppState('session')
      timerRef.current = setInterval(() => {
        setSessionSecs(s => {
          if (s >= MAX_DURATION - 1) { endSession(); return s }
          return s + 1
        })
      }, 1000)
    } catch {
      toast.error('Không thể bắt đầu phiên')
    }
  }

  async function endSession() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (sessionId) {
      try { await api.completeSession(sessionId, token) } catch {}
    }
    setAppState('select')
    setMessages([])
    setSessionSecs(0)
    setSessionId(null)
    setScenario(null)
  }

  async function startRecording() {
    if (micState !== 'idle') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec    = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = handleRecordingStop
      rec.start()
      recorderRef.current = rec
      setMicState('recording')
    } catch {
      toast.error('Không thể truy cập microphone')
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current?.stream.getTracks().forEach(t => t.stop())
    setMicState('processing')
  }

  async function handleRecordingStop() {
    if (!sessionId) return
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    try {
      const { transcript } = await api.transcribe(sessionId, blob, token)
      if (!transcript?.trim()) { setMicState('idle'); return }

      setMessages(prev => [...prev, { role: 'user', text: transcript }])

      const { response } = await api.chat(sessionId, transcript, token)
      setMessages(prev => [...prev, { role: 'assistant', text: response }])

      // TTS
      const ttsRes = await api.tts(sessionId, response, token)
      const audioBlob = await ttsRes.blob()
      const url = URL.createObjectURL(audioBlob)
      if (audioRef.current) { audioRef.current.src = url; audioRef.current.play() }
    } catch {
      toast.error('Lỗi xử lý — thử lại nhé')
    } finally {
      setMicState('idle')
    }
  }

  const timeStr = `${String(Math.floor(sessionSecs / 60)).padStart(2, '0')}:${String(sessionSecs % 60).padStart(2, '0')}`
  const timeLeft = MAX_DURATION - sessionSecs

  /* ─── SCENARIO SELECT ─── */
  if (appState === 'select') {
    return (
      <div className="page">
        <div className="top-bar">
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>🎙️ Luyện Giọng AI</h1>
        </div>
        <div style={{ padding: '12px 16px' }}>
          <p style={{ color: 'var(--text2)', fontSize: '0.875rem', marginBottom: 16 }}>
            Chọn kịch bản để luyện tập kỹ năng giao tiếp với AI
          </p>
          {loadingScenarios ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 110, borderRadius: 16, marginBottom: 12 }} />
            ))
          ) : scenarios.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 0' }}>
              Chưa có kịch bản nào
            </div>
          ) : (
            scenarios.map((sc, i) => (
              <motion.div
                key={sc.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 16, padding: '16px',
                  marginBottom: 12, cursor: 'pointer',
                }}
                onClick={() => startSession(sc)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'white', fontWeight: 700, marginBottom: 4 }}>{sc.title}</div>
                    <div style={{ color: 'var(--text2)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                      {sc.description}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <span className="badge badge-blue">👤 {sc.persona_name}</span>
                      <span className="badge badge-orange">{sc.persona_role}</span>
                    </div>
                  </div>
                  <div style={{ marginLeft: 12, flexShrink: 0, textAlign: 'center' }}>
                    <div style={{ color: '#FFB800', fontSize: '0.9rem' }}>
                      {'★'.repeat(sc.difficulty)}{'☆'.repeat(3 - sc.difficulty)}
                    </div>
                    <div style={{ color: 'var(--text3)', fontSize: '0.65rem', marginTop: 2 }}>độ khó</div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
        <audio ref={audioRef} style={{ display: 'none' }} />
      </div>
    )
  }

  /* ─── SESSION ─── */
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #0A0010 0%, #080820 100%)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={endSession}
          style={{
            background: 'rgba(255,255,255,0.08)', border: 'none',
            borderRadius: 10, padding: '8px 12px',
            color: 'white', cursor: 'pointer',
          }}
        >←</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>
            {scenario?.title}
          </div>
          <div style={{ color: 'var(--text2)', fontSize: '0.75rem' }}>
            {scenario?.persona_name} · {scenario?.persona_role}
          </div>
        </div>
        {/* Session timer */}
        <div style={{
          background: timeLeft < 60 ? 'rgba(200,16,46,0.2)' : 'rgba(255,255,255,0.08)',
          border: `1px solid ${timeLeft < 60 ? 'rgba(200,16,46,0.4)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 10, padding: '6px 12px',
          color: timeLeft < 60 ? '#FF4060' : 'var(--text2)',
          fontWeight: 700, fontSize: '0.875rem',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {timeStr}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                maxWidth: '78%',
                background: m.role === 'user'
                  ? 'linear-gradient(135deg, var(--red), #FF2D55)'
                  : 'rgba(255,255,255,0.09)',
                border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.12)',
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                padding: '12px 16px',
                color: 'white',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                boxShadow: m.role === 'user' ? '0 4px 20px rgba(200,16,46,0.3)' : 'none',
              }}>
                {m.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {micState === 'processing' && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '18px 18px 18px 4px',
              padding: '12px 20px',
              display: 'flex', gap: 6, alignItems: 'center',
            }}>
              {[0, 0.15, 0.3].map((d, i) => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.5)',
                  animation: `bounce 0.8s ${d}s ease-in-out infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Mic button */}
      <div style={{
        padding: '20px 16px 32px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 16,
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>
          {micState === 'idle' ? '👆 Nhấn giữ để nói'
           : micState === 'recording' ? '🔴 Đang ghi âm...'
           : '⏳ Đang xử lý...'}
        </div>

        <div style={{ position: 'relative' }}>
          {/* Pulse rings */}
          {micState === 'recording' && [1, 2].map(r => (
            <div key={r} style={{
              position: 'absolute',
              inset: -(r * 18),
              borderRadius: '50%',
              border: `2px solid rgba(200,16,46,${0.5 / r})`,
              animation: `pulseLarge ${0.8 + r * 0.3}s ease-out infinite`,
              pointerEvents: 'none',
            }} />
          ))}
          {micState === 'idle' && [1].map(r => (
            <div key={r} style={{
              position: 'absolute',
              inset: -20,
              borderRadius: '50%',
              border: '2px solid rgba(100,100,255,0.3)',
              animation: 'pulseLarge 2s ease-out infinite',
              pointerEvents: 'none',
            }} />
          ))}

          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={e => { e.preventDefault(); startRecording() }}
            onTouchEnd={e => { e.preventDefault(); stopRecording() }}
            disabled={micState === 'processing'}
            style={{
              width: 80, height: 80,
              borderRadius: '50%',
              border: 'none',
              background: micState === 'recording'
                ? 'linear-gradient(135deg, #8B0000, var(--red))'
                : micState === 'processing'
                ? 'rgba(255,255,255,0.1)'
                : 'linear-gradient(135deg, #1E3A8A, #3B82F6)',
              boxShadow: micState === 'recording'
                ? '0 0 40px rgba(200,16,46,0.6)'
                : '0 4px 24px rgba(59,130,246,0.4)',
              fontSize: micState === 'processing' ? '1.4rem' : '2rem',
              cursor: micState !== 'processing' ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: micState === 'processing' ? 'spin 1s linear infinite' : undefined,
              transition: 'background 0.3s, box-shadow 0.3s',
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none',
            }}
          >
            {micState === 'idle' ? '🎙️' : micState === 'recording' ? '⏸' : '⚙️'}
          </button>
        </div>
      </div>

      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  )
}
