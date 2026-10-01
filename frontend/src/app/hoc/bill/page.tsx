'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import BillHistory from '@/components/bill/BillHistory'
import BillResults from '@/components/bill/BillResults'
import ScanFlow from '@/components/bill/ScanFlow'
import { PageHead } from '@/components/ui'
import type { Program } from '@/lib/billTypes'
import { useApi } from '@/lib/useApi'

type Tab = 'scan' | 'history' | 'results'

export default function BillPage() {
  const [tab, setTab] = useState<Tab>('scan')
  const [programId, setProgramId] = useState('')
  const [version, setVersion] = useState(0)
  const programs = useApi<{ programs: Program[] }>('/dday/programs')

  return (
    <main className="page">
      <Link href="/hoc" className="row small muted" style={{ margin: '4px 0 10px' }}><ChevronLeft size={16} /> Hôm nay</Link>
      <PageHead eyebrow="Bill intelligence · D-day" title="Scan bill D-day" sub="Chụp một lần. Kiểm tra đúng. Ghi nhận rõ." />
      <div className="tabs" role="tablist">
        {([['scan', 'Chụp bill'], ['history', 'Lịch sử'], ['results', 'Kết quả']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab !== 'scan' && (
        <select className="input" style={{ marginTop: 12 }} value={programId} onChange={(e) => setProgramId(e.target.value)} aria-label="Lọc theo chương trình">
          <option value="">Tất cả chương trình</option>
          {programs.data?.programs.map((p) => <option key={p.id} value={p.id}>{p.name} · {new Date(p.day).toLocaleDateString('vi-VN')}</option>)}
        </select>
      )}
      {tab === 'scan' && <ScanFlow key={version} onDone={() => setVersion((v) => v + 1)} />}
      {tab === 'history' && <BillHistory programId={programId} />}
      {tab === 'results' && <BillResults programId={programId} />}
    </main>
  )
}
