'use client'
import { useState } from 'react'
import { AlertTriangle, Gauge, Lightbulb, MessageCircleQuestion, Pause, Play, Quote, Sparkles, Tags } from 'lucide-react'
import { LevelChip, ScoreBar, ScoreRing } from './ui'
import { api } from '@/lib/api'
import { levelColor, score1 } from '@/lib/format'
import { level } from '@/lib/level'
import type { SessionView } from '@/lib/types'

export default function SessionReport({ s, showTranscript = true }: { s: SessionView; showTranscript?: boolean }) {
  const r = s.report
  const names = Object.fromEntries(s.scores.map((c) => [c.key, c.name]))
  return (
    <>
      <section className="card pop" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <ScoreRing score={s.overall} level={s.level} size={92} stroke={9} />
        <div className="grow">
          <div className="eyebrow">{s.kind === 'onboarding' ? 'Đánh giá đầu vào' : 'Kết quả luyện tập'}</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>{s.title}</div>
          <div style={{ marginTop: 8 }}><LevelChip level={s.level} /></div>
          <div className="tiny muted" style={{ marginTop: 6 }}>+{s.points} điểm tích lũy</div>
        </div>
      </section>

      {r.critical && (
        <div className="note" style={{ marginTop: 14, background: 'var(--red-soft)', borderColor: '#f7c9cb', color: 'var(--red-deep)' }}>
          <AlertTriangle size={18} />
          <span><b>Lỗi trọng yếu:</b> {r.critical_error}</span>
        </div>
      )}

      <section className="card">
        <b>Điểm theo năng lực</b>
        {s.scores.map((c) => (
          <div key={c.key}>
            <ScoreBar label={`${c.key.toUpperCase()} · ${c.name}`} score={c.score} level={c.level}
              hint={r.sup_review?.scores[c.key] !== undefined ? `SUP: ${score1(r.sup_review.scores[c.key])}` : undefined} />
            {r.evidence[c.key]?.[0] && (
              <p className="tiny" style={{ color: 'var(--ink-2)', margin: '-2px 0 6px', display: 'flex', gap: 6 }}>
                <Quote size={12} style={{ marginTop: 2 }} /> “{r.evidence[c.key][0]}”
              </p>
            )}
          </div>
        ))}
      </section>

      {r.fix && (
        <section className="card" style={{ borderLeft: '4px solid var(--l2)' }}>
          <div className="row"><Lightbulb size={18} color="var(--l2)" /><b>1 điểm cần sửa · {names[r.fix.competency] ?? r.fix.competency.toUpperCase()}</b></div>
          <p className="small muted" style={{ marginTop: 8 }}>Bạn đã nói:</p>
          <p className="small" style={{ fontStyle: 'italic' }}>“{r.fix.quote}”</p>
          <p className="small muted" style={{ marginTop: 8 }}>Thử nói:</p>
          <p className="small" style={{ fontWeight: 600 }}>{r.fix.tip}</p>
        </section>
      )}

      {r.strengths.length > 0 && (
        <section className="card row"><Sparkles size={18} color="var(--green)" /><span className="small">Cần phát huy: <b>{r.strengths.join(', ')}</b></span></section>
      )}

      <section className="grid2" style={{ marginTop: 14 }}>
        <div className="card">
          <Gauge size={18} color="var(--blue)" />
          <div style={{ fontWeight: 800, fontSize: 20, marginTop: 6 }}>{r.metrics.avg_latency_ms != null ? `${(r.metrics.avg_latency_ms / 1000).toFixed(1)}s` : '—'}</div>
          <div className="tiny muted">Độ trễ phản xạ TB (mục tiêu &lt; 2s)</div>
        </div>
        <div className="card">
          <MessageCircleQuestion size={18} color="var(--blue)" />
          <div style={{ fontWeight: 800, fontSize: 20, marginTop: 6 }}>{r.metrics.questions}</div>
          <div className="tiny muted">Câu hỏi khai thác nhu cầu</div>
        </div>
      </section>
      {r.metrics.usp_keywords?.length > 0 && (
        <section className="card">
          <div className="row small"><Tags size={16} /> <b>Từ khóa sản phẩm đã dùng</b></div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {r.metrics.usp_keywords.map((k) => <span key={k} className="chip blue">{k}</span>)}
          </div>
        </section>
      )}

      {r.behaviors?.length > 0 && (
        <section className="card">
          <b>Hành vi được quan sát khi chấm</b>
          <ul className="small" style={{ marginTop: 8, paddingLeft: 18, color: 'var(--ink-2)' }}>
            {r.behaviors.map((b) => <li key={b} style={{ marginTop: 4 }}>{b}</li>)}
          </ul>
        </section>
      )}

      {showTranscript && (
        <section className="card">
          <b>Transcript</b>
          <div className="stack" style={{ marginTop: 10 }}>
            {s.turns.map((t, i) => (
              <div key={i} className="small" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span className={`chip ${t.role === 'pg' ? 'red' : ''}`} style={{ height: 22, minWidth: 40, justifyContent: 'center' }}>{t.role === 'pg' ? 'PG' : 'AI'}</span>
                <span className="grow">
                  {t.text}{t.role === 'pg' && t.latency_ms != null && <span className="tiny muted"> · {(t.latency_ms / 1000).toFixed(1)}s</span>}
                  {t.action && <span className="tiny muted" style={{ display: 'block', fontStyle: 'italic' }}>{t.action}</span>}
                </span>
                {t.has_audio && <AudioClip sessionId={s.id} turn={i} />}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

/** Recordings need the bearer token, so they're fetched as a blob and played from an object URL. */
export function AudioClip({ sessionId, turn }: { sessionId: string; turn: number }) {
  const [el, setEl] = useState<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  async function toggle() {
    if (el && playing) {
      el.pause()
      return
    }
    try {
      let audio = el
      if (!audio) {
        const blob = await api<Blob>(`/voice/sessions/${sessionId}/audio/${turn}`)
        audio = new Audio(URL.createObjectURL(blob))
        audio.onplay = () => setPlaying(true)
        audio.onpause = audio.onended = () => setPlaying(false)
        setEl(audio)
      }
      await audio.play()
    } catch {
      setFailed(true)
    }
  }

  return (
    <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Nghe ghi âm" onClick={toggle} disabled={failed}>
      {playing ? <Pause size={15} /> : <Play size={15} />}
    </button>
  )
}

export const scoreColor = (v: number | null) => levelColor(level(v))
