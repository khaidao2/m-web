export type BillStatus = 'draft' | 'valid' | 'review' | 'rejected' | 'void'

export type Program = { id: string; name: string; activity: string; day: string; store_name: string; is_open: boolean }
export type Shift = { id: string; hours: number; program: Program }

export type BillLine = {
  name: string
  qty: number
  unit_price: number
  amount: number
  mch: boolean
  brand: string | null
  category: string | null
  slug: string | null
}

export type Bill = {
  id: string
  status: BillStatus
  program_id: string
  flags: { code: string; label: string; severity: 'review' | 'rejected' }[]
  bill_no: string | null
  store_name: string | null
  purchased_at: string | null
  total_vnd: number | null
  lines: BillLine[]
  mch_value_vnd: number
  mch_categories: string[]
  created_at: string
  confirmed_at: string | null
  program?: Program
  pg?: { id: string; name: string }
}

export type BillEvent = { action: string; detail: Record<string, unknown>; by: string; at: string }

export type BillResults = {
  mch_value_vnd: number
  bills: number
  shifts: number
  hours: number
  value_per_hour: number | null
  multi_category_rate: number | null
  value_per_bill: number | null
  units_per_bill: number | null
  needs_review: number
  rejected: number
  skus: { brand: string; category: string; slug: string | null; name: string; qty: number; amount: number }[]
}

export const BILL_STATUS: Record<BillStatus, { label: string; chip: string; color: string }> = {
  draft: { label: 'Nháp', chip: '', color: 'var(--muted)' },
  valid: { label: 'Hợp lệ', chip: 'green', color: 'var(--green)' },
  review: { label: 'Cần xem xét', chip: 'amber', color: 'var(--l2)' },
  rejected: { label: 'Loại', chip: 'red', color: 'var(--red)' },
  void: { label: 'Đã vô hiệu', chip: '', color: 'var(--muted)' },
}

export const vnd = (v: number | null | undefined) => (v == null ? '—' : `${v.toLocaleString('vi-VN')}đ`)
