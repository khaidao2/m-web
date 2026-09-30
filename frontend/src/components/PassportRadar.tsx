import type { Competency } from '@/lib/types'

/* 7-axis radar on the 0–10 scale; unassessed competencies are drawn as hollow markers at 0. */
export default function PassportRadar({ items, size = 260 }: { items: Competency[]; size?: number }) {
  const c = size / 2
  const R = c - 34
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / items.length - Math.PI / 2
    return [c + Math.cos(a) * R * (v / 10), c + Math.sin(a) * R * (v / 10)]
  }
  const poly = items.map((it, i) => pt(i, it.score ?? 0).join(',')).join(' ')
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size, display: 'block', margin: '0 auto' }} role="img"
      aria-label={items.map((i) => `${i.key.toUpperCase()} ${i.score ?? 'chưa đánh giá'}`).join(', ')}>
      {[2.5, 5, 7, 10].map((ring) => (
        <polygon key={ring} points={items.map((_, i) => pt(i, ring).join(',')).join(' ')} fill="none"
          stroke={ring === 5 ? '#f3b4b6' : ring === 7 ? '#b9cffb' : 'var(--line)'} strokeDasharray={ring === 5 || ring === 7 ? '4 4' : undefined} />
      ))}
      {items.map((_, i) => {
        const [x, y] = pt(i, 10)
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" />
      })}
      <polygon points={poly} fill="rgba(215,25,32,.16)" stroke="var(--red)" strokeWidth="2" strokeLinejoin="round" />
      {items.map((it, i) => {
        const [x, y] = pt(i, it.score ?? 0)
        const [lx, ly] = pt(i, 12.6)
        return (
          <g key={it.key}>
            <circle cx={x} cy={y} r="4" fill={it.score === null ? '#fff' : 'var(--red)'} stroke="var(--red)" strokeWidth="1.5" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="var(--ink-2)">
              {it.key.toUpperCase()}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
