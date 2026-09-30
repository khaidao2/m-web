'use client'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from 'recharts'

const COMPETENCIES = [
  { key: 'c1', label: 'Tiếp cận' },
  { key: 'c2', label: 'Thấu hiểu' },
  { key: 'c3', label: 'Tư vấn SP' },
  { key: 'c4', label: 'Gia tăng GT' },
  { key: 'c5', label: 'Xử lý PB' },
  { key: 'c6', label: 'Đàm phán' },
  { key: 'c7', label: 'Thái độ' },
]

interface Props {
  scores: Record<string, number>
}

export default function PassportRadar({ scores }: Props) {
  const data = COMPETENCIES.map(c => ({
    subject: c.label,
    score: scores[c.key] ?? 0,
    fullMark: 4,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 11, fontFamily: 'Be Vietnam Pro' }}
        />
        <PolarRadiusAxis
          angle={90} domain={[0, 4]} tickCount={5}
          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
          axisLine={false}
        />
        <Radar
          name="Năng lực"
          dataKey="score"
          stroke="#C8102E"
          fill="#C8102E"
          fillOpacity={0.45}
          strokeWidth={2}
          dot={{ fill: '#C8102E', strokeWidth: 0, r: 4 }}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(26,26,40,0.95)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            color: '#F0F0F8',
            fontSize: 12,
          }}
          formatter={(v: number) => [`${v}/4.0`, 'Điểm']}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
