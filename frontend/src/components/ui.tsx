'use client'
import type { ReactNode } from 'react'
import { levelColor, score1 } from '@/lib/format'
import type { Level } from '@/lib/types'

export function Loading({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="center-screen" role="status">
      <div className="stack" style={{ alignItems: 'center' }}>
        <div className="spinner" />
        <span className="muted small">{label}</span>
      </div>
    </div>
  )
}

export function ErrorBox({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div className="card stack" role="alert" style={{ alignItems: 'flex-start' }}>
      <b>Chưa tải được dữ liệu</b>
      <span className="muted small">{error}</span>
      {retry && <button className="btn sm ghost" onClick={retry}>Thử lại</button>}
    </div>
  )
}

export function Empty({ icon, title, text }: { icon: ReactNode; title: string; text?: string }) {
  return (
    <div className="card stack" style={{ alignItems: 'center', textAlign: 'center', padding: 24 }}>
      <div className="tile">{icon}</div>
      <b>{title}</b>
      {text && <span className="muted small">{text}</span>}
    </div>
  )
}

export function PageHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <header className="rise" style={{ margin: '6px 2px 16px' }}>
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="h1" style={{ marginTop: 6 }}>{title}</h1>
      {sub && <p className="muted small" style={{ marginTop: 6 }}>{sub}</p>}
    </header>
  )
}

/** Circular 0–10 score with level colour; `null` renders as "Chưa đánh giá". */
export function ScoreRing({ score, level, size = 76, stroke = 8 }: { score: number | null; level: Level; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = score === null ? 0 : score / 10
  return (
    <div style={{ position: 'relative', width: size, height: size }} aria-label={`Điểm ${score1(score)} trên 10`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={levelColor(level)} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: size * 0.27 }}>
        {score1(score)}
      </div>
    </div>
  )
}

export function LevelChip({ level }: { level: Level }) {
  if (!level) return <span className="chip">Chưa đánh giá</span>
  return (
    <span className="chip" style={{ background: `color-mix(in srgb, ${levelColor(level)} 14%, white)`, color: levelColor(level) }}>
      Level {level.level} · {level.name}
    </span>
  )
}

export function ScoreBar({ label, score, level, hint }: { label: string; score: number | null; level: Level; hint?: string }) {
  return (
    <div style={{ padding: '10px 0' }}>
      <div className="row between small">
        <span style={{ fontWeight: 600 }}>{label}</span>
        <b style={{ color: score === null ? 'var(--muted)' : levelColor(level) }}>{score1(score)}</b>
      </div>
      <div className="bar" style={{ marginTop: 8 }}>
        <i style={{ width: `${(score ?? 0) * 10}%`, background: levelColor(level) }} />
      </div>
      <div className="row between tiny muted" style={{ marginTop: 6 }}>
        <span>{level ? `Level ${level.level} · ${level.name}` : 'Chưa đánh giá'}</span>
        {hint && <span>{hint}</span>}
      </div>
    </div>
  )
}

export function Stat({ value, label, accent }: { value: ReactNode; label: string; accent?: boolean }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '16px 8px' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent ? 'var(--red)' : 'var(--ink)' }}>{value}</div>
      <div className="tiny muted" style={{ marginTop: 4 }}>{label}</div>
    </div>
  )
}
