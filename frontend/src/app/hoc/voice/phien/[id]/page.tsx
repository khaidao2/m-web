'use client'
import { use } from 'react'
import Link from 'next/link'
import { ChevronLeft, IdCard, RotateCcw } from 'lucide-react'
import SessionReport from '@/components/SessionReport'
import { ErrorBox, Loading } from '@/components/ui'
import { useApi } from '@/lib/useApi'
import type { SessionView } from '@/lib/types'

export default function SessionResult({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const s = useApi<SessionView>(`/voice/sessions/${id}`)
  if (s.loading) return <Loading label="Đang chấm điểm…" />
  if (s.error || !s.data) return <main className="page"><ErrorBox error={s.error ?? ''} retry={s.reload} /></main>
  return (
    <main className="page">
      <Link href="/hoc/voice" className="row small muted" style={{ margin: '4px 0 10px' }}><ChevronLeft size={16} /> Thực chiến</Link>
      <SessionReport s={s.data} />
      <div className="stack" style={{ marginTop: 16 }}>
        <Link href={`/hoc/voice/${s.data.scenario_code}`} className="btn primary block"><RotateCcw size={18} /> Thử lại ngay</Link>
        <Link href="/hoc/passport" className="btn ghost block"><IdCard size={18} /> Xem Passport</Link>
      </div>
    </main>
  )
}
