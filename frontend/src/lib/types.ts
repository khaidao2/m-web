export type Level = { level: 1 | 2 | 3 | 4; name: string } | null

export type Me = {
  stats: { points: number; days_learned: number; open_flags: number }
  id: string
  username: string
  full_name: string
  role: 'pg' | 'supervisor'
  store_name: string | null
  onboarding: { quiz_done: boolean; voice_done: boolean; voice_scenario: string; complete: boolean }
}

export type Competency = { key: string; name: string; name_en: string; score: number | null; level: Level }

export type Flag = {
  id: string
  competency: string
  competency_name: string
  status: 'open' | 'ready' | 'closed'
  opened_score: number
  opened_at: string
  ready_at: string | null
  closed_at: string | null
  sup_score: number | null
  sup_note: string | null
}

export type Passport = { overall: number | null; overall_level: Level; competencies: Competency[]; red_flags: Flag[] }

export type ScenarioGroup = 'customer' | 'store_manager' | 'store_staff' | 'promotion' | 'full_sale'

export type Scenario = {
  code: string
  title: string
  group: ScenarioGroup
  group_label: string
  difficulty: number
  competencies: string[]
  context: string
  pg_data: string
  opening: string
  best?: number | null
  competency_names?: Record<string, string>
}

export type Quest = {
  id: string
  day: string
  kind: 'red_flag' | 'daily'
  competency: string | null
  competency_name: string | null
  scenario: Scenario
  done: boolean
  session_id: string | null
}

export type Turn = { role: 'pg' | 'ai'; text: string; action?: string | null; latency_ms?: number | null; has_audio?: boolean; mood?: string }

export type SessionSummary = {
  id: string
  scenario_code: string
  title: string
  group: ScenarioGroup
  kind: string
  overall: number | null
  level: Level
  points: number
  started_at: string
  completed_at: string | null
  sup_reviewed: boolean
}

export type Report = {
  scores: Record<string, number | null>
  overall: number | null
  evidence: Record<string, string[]>
  metrics: { avg_latency_ms: number | null; questions: number; usp_keywords: string[]; pg_turns: number; words: number }
  fix: { competency: string; quote: string; tip: string } | null
  critical: boolean
  critical_error: string | null
  strengths: string[]
  behaviors: string[]
  sup_review?: { scores: Record<string, number>; note: string | null; by: string; at: string }
}

export type SessionView = SessionSummary & {
  scenario: Scenario
  turns: Turn[]
  scores: { key: string; name: string; score: number | null; level: Level }[]
  report: Report
  pg?: { id: string; name: string; store: string | null }
}

export type LeaderEntry = {
  rank: number
  user_id: string
  name: string
  store: string | null
  points: number
  change_pct: number | null
  is_me: boolean
  is_demo: boolean
}

export type Leaderboard = {
  period: 'week' | 'month' | 'quarter'
  entries: LeaderEntry[]
  me:
    | (LeaderEntry & {
        previous_points: number
        total_pgs: number
        gap_to_next: number
        overall: number | null
        level: Level
        strongest: { key: string; name: string; score: number } | null
        weakest: { key: string; name: string; score: number } | null
      })
    | null
}
