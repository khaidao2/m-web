import type { Flag, Level, Passport, SessionSummary } from './types'

export type Kpi = { code: string; name: string; value: number | null; unit: string; target: string }
export type TeamRow = { id: string; name: string; store: string | null; overall: number | null; level: Level; onboarded: boolean; open_flags: number; ready_flags: number; quests_week: number }
export type Overview = { kpis: Kpi[]; team: TeamRow[] }
export type QueueFlag = Flag & { pg: { id: string; name: string; store: string | null }; current_score: number | null; latest_session: SessionSummary | null }
export type Audit = { id: string; period: string; revenue_vnd: number | null; dday_units: number | null; activations: number | null; extra_displays: number | null; c7_score: number | null; note: string | null }
export type PgDetail = {
  pg: { id: string; name: string; store: string | null }
  onboarding: { quiz_done: boolean; voice_done: boolean; complete: boolean }
  passport: Passport
  sessions: SessionSummary[]
  audits: Audit[]
}
