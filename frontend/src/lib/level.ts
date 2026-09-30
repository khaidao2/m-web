import type { Level } from './types'

/* Mirrors backend content.LEVELS (doc §IV) for client-side labels. */
const BANDS: [number, 1 | 2 | 3 | 4, string][] = [
  [8.5, 4, 'Giỏi - Xuất sắc'],
  [7.0, 3, 'Khá - Thành thạo'],
  [5.0, 2, 'Trung bình - Đạt yêu cầu'],
  [0, 1, 'Cần cải thiện'],
]

export function level(score: number | null): Level {
  if (score === null) return null
  const [, lv, name] = BANDS.find(([floor]) => score >= floor) ?? BANDS[3]
  return { level: lv, name }
}
