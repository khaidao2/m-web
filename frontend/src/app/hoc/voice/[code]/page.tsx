'use client'
import { Suspense, use, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Clock, Info, Keyboard, Mic, RotateCcw, Send, Square, Volume2, Flag } from 'lucide-react'
import { GROUP_META } from '@/components/icons'
import { ErrorBox, Loading } from '@/components/ui'
import { api } from '@/lib/api'
import { canRecognize, listen, speak, stopSpeaking, unlockAudio, type Listener } from '@/lib/speech'
import { useApi } from '@/lib/useApi'
import type { Scenario, Turn } from '@/lib/types'

const TURN_LIMIT_MS = 60_000

function Session({ code }: { code: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const questId = params.get('quest')
  const kind = params.get('kind') === 'onboarding' ? 'onboarding' : questId ? 'quest' : 'practice'
  const minutes = kind === 'onboarding' ? 7 : 3
  const scenario = useApi<Scenario>(`/voice/scenarios/${code}`)

  const [consent, setConsent] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [listening, setListening] = useState(false)
  const [draft, setDraft] = useState('')
  const [audio, setAudio] = useState<Blob | null>(null)
  const [typing, setTyping] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ended, setEnded] = useState(false)
  const [turnsLeft, setTurnsLeft] = useState(8)
  const [error, setError] = useState<string | null>(null)
  const listener = useRef<Listener | null>(null)
  const toggleMicRef = useRef<() => Promise<void>>(async () => {})
  const aiDoneAt = useRef<number>(0)
  const replyStartedAt = useRef<number | null>(null)
  const autoStop = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const group = scenario.data?.group ?? 'customer'

  useEffect(() => {
    if (!sessionId) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [sessionId])
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [turns, draft, listening])
  useEffect(() => () => stopSpeaking(), [])

  const say = useCallback(async (text: string) => {
    await speak(text, group, (t, g) => api<Blob>('/voice/tts', { method: 'POST', json: { text: t, group: g } }))
    aiDoneAt.current = Date.now()
    replyStartedAt.current = null
  }, [group])

  async function begin() {
    unlockAudio()
    setBusy(true)
    setError(null)
    try {
      const r = await api<{ session_id: string; opening: string; max_turns: number }>('/voice/sessions', {
        method: 'POST', json: { scenario_code: code, kind, quest_id: questId },
      })
      setSessionId(r.session_id)
      setTurnsLeft(r.max_turns)
      setTurns([{ role: 'ai', text: r.opening }])
      setStartedAt(Date.now())
      setTyping(!canRecognize())
      setBusy(false)
      await say(r.opening)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không bắt đầu được')
      setBusy(false)
    }
  }

  async function toggleMic() {
    if (listening) {
      if (autoStop.current) clearTimeout(autoStop.current)
      const { text, audio: blob } = await listener.current!.stop()
      listener.current = null
      setListening(false)
      setDraft((d) => text || d)
      setAudio(blob)
      return
    }
    stopSpeaking()
    replyStartedAt.current ??= Date.now()
    setDraft('')
    setAudio(null)
    setError(null)
    listener.current = await listen(setDraft, setError)
    setListening(true)
    autoStop.current = setTimeout(() => void toggleMicRef.current(), TURN_LIMIT_MS)
  }

  useEffect(() => {
    toggleMicRef.current = toggleMic
  })

  async function send() {
    const text = draft.trim()
    if (!text || !sessionId) return
    setBusy(true)
    const latency = replyStartedAt.current && aiDoneAt.current ? Math.max(0, replyStartedAt.current - aiDoneAt.current) : null
    const form = new FormData()
    form.set('text', text)
    if (latency !== null) form.set('latency_ms', String(latency))
    if (audio) form.set('audio', audio, `turn.${audio.type.includes('mp4') ? 'm4a' : 'webm'}`)
    setTurns((t) => [...t, { role: 'pg', text }])
    setDraft('')
    setAudio(null)
    try {
      const r = await api<{ reply: string; action: string | null; mood: string; ended: boolean; turns_left: number }>(`/voice/sessions/${sessionId}/turns`, { method: 'POST', body: form })
      setTurns((t) => [...t, { role: 'ai', text: r.reply, action: r.action, mood: r.mood }])
      setTurnsLeft(r.turns_left)
      setEnded(r.ended || r.turns_left <= 0)
      setBusy(false)
      await say(r.reply)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không gửi được')
      setBusy(false)
    }
  }

  const finish = useCallback(async () => {
    if (!sessionId) return
    stopSpeaking()
    if (listener.current) await listener.current.stop()
    setBusy(true)
    try {
      await api(`/voice/sessions/${sessionId}/finish`, { method: 'POST' })
      router.replace(`/hoc/voice/phien/${sessionId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không chấm được điểm')
      setBusy(false)
    }
  }, [router, sessionId])

  const left = sessionId ? Math.min(minutes * 60, Math.max(0, minutes * 60 - (now - startedAt) / 1000)) : minutes * 60
  useEffect(() => {
    if (!sessionId || busy) return
    const t = setTimeout(() => void finish(), Math.max(0, startedAt + minutes * 60_000 - Date.now()))
    return () => clearTimeout(t)
  }, [busy, finish, minutes, sessionId, startedAt])

  if (scenario.loading) return <Loading />
  if (scenario.error || !scenario.data) return <main className="page"><ErrorBox error={scenario.error ?? ''} retry={scenario.reload} /></main>
  const s = scenario.data
  const meta = GROUP_META[s.group]

  if (!sessionId) {
    return (
      <main className="page">
        <button className="row small muted" onClick={() => router.back()} style={{ margin: '4px 0 10px' }}><ChevronLeft size={16} /> Quay lại</button>
        <div className="eyebrow">{s.code} · {s.group_label}</div>
        <h1 className="h1" style={{ marginTop: 6 }}>{s.title}</h1>
        <section className="card" style={{ marginTop: 14 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="chip"><Clock size={13} /> {minutes} phút</span>
            <span className="chip">Độ khó {s.difficulty}/3</span>
            {kind === 'onboarding' && <span className="chip blue">Bài đánh giá đầu vào</span>}
            {kind === 'quest' && <span className="chip red"><Flag size={12} /> Nhiệm vụ</span>}
          </div>
          <h3 style={{ fontSize: 15, marginTop: 14 }}>Bối cảnh của bạn</h3>
          <p className="small" style={{ marginTop: 6, color: 'var(--ink-2)' }}>{s.context}</p>
          <div className="divider" />
          <h3 style={{ fontSize: 15 }}>Dữ liệu để sử dụng</h3>
          <p className="small" style={{ marginTop: 6, color: 'var(--ink-2)' }}>{s.pg_data}</p>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {s.competencies.map((c) => <span key={c} className="chip dark">{c.toUpperCase()} · {s.competency_names?.[c]}</span>)}
          </div>
          <div className="note" style={{ marginTop: 14 }}><Info size={18} /> Giá, tồn kho và thể lệ trong bài là giả định để luyện tập.</div>
        </section>
        <section className="card">
          <h3 style={{ fontSize: 15 }}>Chuẩn bị trước khi nói</h3>
          <ul className="small" style={{ marginTop: 8, paddingLeft: 18, color: 'var(--ink-2)' }}>
            <li>Bạn sẽ nói chuyện với <b>{meta.persona}</b> do AI đóng vai.</li>
            <li>Chạm micro để bắt đầu, chạm lần nữa để dừng. Xem lại lời nhận diện rồi gửi. Mỗi lượt tối đa 60 giây.</li>
            <li>Nói tự nhiên như tại quầy — AI chấm theo bằng chứng trong lời bạn nói.</li>
          </ul>
          <p className="tiny muted" style={{ marginTop: 10 }}>
            Giọng trả lời tiếng Việt được tạo tự động (Piper · dữ liệu VAIS-1000, CC BY 4.0). Bản ghi và transcript được lưu để bạn và SUP kiểm chứng; không nói dữ liệu cá nhân của khách.
          </p>
          <label className="row small" style={{ marginTop: 12, fontWeight: 600 }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--red)' }} />
            Tôi đồng ý ghi âm và lưu bài luyện.
          </label>
          <button className="btn primary block" style={{ marginTop: 14 }} disabled={!consent || busy} onClick={begin}>
            <Mic size={18} /> {busy ? 'Đang kết nối…' : 'Bắt đầu trò chuyện'}
          </button>
          {error && <p className="small" style={{ color: 'var(--red)', marginTop: 8 }}>{error}</p>}
        </section>
      </main>
    )
  }

  const mm = Math.floor(left / 60)
  const ss = String(Math.floor(left % 60)).padStart(2, '0')
  return (
    <main className="page bare live-session" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 70px)', paddingBottom: 0 }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="row grow">
          <div className={`tile ${meta.tone}`} style={{ width: 40, height: 40 }}><meta.icon size={19} /></div>
          <div className="grow">
            <div className="small" style={{ fontWeight: 700 }}>{meta.persona}</div>
            <div className="tiny muted truncate">{s.code} · {s.title}</div>
          </div>
        </div>
        <span className="chip" style={{ color: left < 30 ? 'var(--red)' : undefined }}><Clock size={13} /> {mm}:{ss}</span>
      </div>

      <div className="grow stack" style={{ paddingBottom: 12 }}>
        {turns.map((t, i) => [
          <div key={i} className="pop" style={{
            alignSelf: t.role === 'pg' ? 'flex-end' : 'flex-start', maxWidth: '84%', padding: '11px 14px', borderRadius: 18,
            borderBottomRightRadius: t.role === 'pg' ? 6 : 18, borderBottomLeftRadius: t.role === 'ai' ? 6 : 18,
            background: t.role === 'pg' ? 'var(--red)' : 'var(--card)', color: t.role === 'pg' ? '#fff' : 'var(--ink)',
            boxShadow: 'var(--shadow)', fontSize: 14.5,
            borderLeft: t.role === 'ai' && t.mood === 'annoyed' ? '3px solid var(--l2)' : t.role === 'ai' && t.mood === 'pleased' ? '3px solid var(--green)' : undefined,
          }}>
            {t.text}
            {t.role === 'ai' && (
              <button aria-label="Nghe lại" onClick={() => void say(t.text)} style={{ marginLeft: 6, verticalAlign: -3, color: 'var(--muted)' }}><Volume2 size={15} /></button>
            )}
          </div>,
          t.action && (
            <div key={`${i}-action`} className="tiny pop" style={{ alignSelf: 'flex-start', maxWidth: '84%', fontStyle: 'italic', color: 'var(--ink-2)', padding: '0 6px' }}>
              {t.action}
            </div>
          ),
        ])}
        {(listening || draft) && (
          <div style={{ alignSelf: 'flex-end', maxWidth: '84%', padding: '11px 14px', borderRadius: 18, border: '1.5px dashed var(--red)', color: 'var(--red-deep)', fontSize: 14.5 }}>
            {draft || 'Đang nghe…'}
          </div>
        )}
        {busy && <div className="tiny muted">{meta.persona} đang trả lời…</div>}
        <div ref={bottom} />
      </div>

      <section style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', padding: '10px 0 calc(var(--safe-b) + 14px)' }}>
        {error && <p className="small" style={{ color: 'var(--red)', marginBottom: 8 }}>{error}</p>}
        {ended ? (
          <button className="btn primary block" onClick={finish} disabled={busy}>Kết thúc & xem điểm</button>
        ) : (
          <>
            {(typing || (draft && !listening)) && (
              <div className="row" style={{ marginBottom: 10 }}>
                <textarea className="input" rows={2} value={draft} placeholder="Nhập câu trả lời của bạn…"
                  onChange={(e) => { replyStartedAt.current ??= Date.now(); setDraft(e.target.value) }} style={{ minHeight: 52 }} />
                <button className="btn primary" style={{ width: 52, padding: 0 }} aria-label="Gửi" disabled={!draft.trim() || busy} onClick={send}><Send size={19} /></button>
              </div>
            )}
            <div className="row between">
              <button className="icon-btn" aria-label={typing ? 'Dùng giọng nói' : 'Gõ phím'} onClick={() => setTyping(!typing)} disabled={!canRecognize()}>
                <Keyboard size={19} />
              </button>
              <button onClick={toggleMic} disabled={busy} aria-label={listening ? 'Dừng ghi âm' : 'Bắt đầu nói'}
                style={{ width: 74, height: 74, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff',
                  background: listening ? 'var(--red-deep)' : 'var(--red)', boxShadow: 'var(--shadow-red)',
                  animation: listening ? 'pulse-ring 1.2s infinite' : undefined, opacity: busy ? 0.5 : 1 }}>
                {listening ? <Square size={26} fill="#fff" /> : <Mic size={30} />}
              </button>
              {draft && !listening ? (
                <button className="icon-btn" aria-label="Nói lại" onClick={() => { setDraft(''); setAudio(null) }}><RotateCcw size={19} /></button>
              ) : (
                <span style={{ width: 40 }} />
              )}
            </div>
            <div className="row between tiny muted" style={{ marginTop: 10 }}>
              <span>Còn {turnsLeft} lượt</span>
              <button className="tiny" style={{ color: 'var(--red)', fontWeight: 700 }} onClick={finish} disabled={busy || turns.length < 2}>Kết thúc & chấm điểm</button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default function VoicePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  return <Suspense><Session code={code} /></Suspense>
}
