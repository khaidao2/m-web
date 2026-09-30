import type { Level } from './types'

export const LEVEL_COLOR = { 1: 'var(--l1)', 2: 'var(--l2)', 3: 'var(--l3)', 4: 'var(--l4)' } as const

export const levelColor = (level: Level) => (level ? LEVEL_COLOR[level.level] : 'var(--line)')

export const score1 = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : v.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const num = (v: number) => v.toLocaleString('vi-VN')

export const firstName = (full: string) => full.trim().split(/\s+/).slice(-1)[0] || full

export const initials = (full: string) =>
  full
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

export function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
}

export const FLAG_STATUS = {
  open: { label: 'Cần cải thiện', chip: 'red' },
  ready: { label: 'Chờ SUP xác nhận', chip: 'amber' },
  closed: { label: 'Đã đóng', chip: 'green' },
} as const
