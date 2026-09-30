'use client'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, Flag } from 'lucide-react'
import { GROUP_META } from './icons'
import type { Quest } from '@/lib/types'

export default function QuestItem({ quest }: { quest: Quest }) {
  const meta = GROUP_META[quest.scenario.group]
  const Icon = quest.done ? CheckCircle2 : meta.icon
  const href = quest.done && quest.session_id ? `/hoc/voice/phien/${quest.session_id}` : `/hoc/voice/${quest.scenario.code}?quest=${quest.id}`
  return (
    <Link href={href} className="item" style={quest.kind === 'red_flag' && !quest.done ? { boxShadow: 'inset 3px 0 0 var(--red), var(--shadow)' } : undefined}>
      <div className={`tile ${quest.done ? 'green' : meta.tone}`}><Icon size={21} /></div>
      <div className="grow">
        <div className="row" style={{ gap: 6 }}>
          {quest.kind === 'red_flag' ? (
            <span className="chip red" style={{ height: 22 }}><Flag size={12} /> Red Flag · {quest.competency?.toUpperCase()}</span>
          ) : (
            <span className="chip" style={{ height: 22 }}>Nhiệm vụ 3 phút</span>
          )}
          {quest.done && <span className="chip green" style={{ height: 22 }}>Đã xong</span>}
        </div>
        <div className="truncate" style={{ fontWeight: 600, marginTop: 6 }}>{quest.scenario.title}</div>
        <div className="tiny muted">{quest.scenario.code} · {quest.scenario.group_label}</div>
      </div>
      <ChevronRight size={18} color="var(--muted)" />
    </Link>
  )
}
