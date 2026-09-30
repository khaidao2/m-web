'use client'
import { ListChecks } from 'lucide-react'
import QuestItem from '@/components/QuestItem'
import { Empty, ErrorBox, Loading, PageHead } from '@/components/ui'
import { useApi } from '@/lib/useApi'
import type { Quest } from '@/lib/types'

export default function QuestsPage() {
  const q = useApi<Quest[]>('/quests/today')
  const red = q.data?.filter((x) => x.kind === 'red_flag') ?? []
  const daily = q.data?.filter((x) => x.kind === 'daily') ?? []
  return (
    <main className="page">
      <PageHead eyebrow="Nhiệm vụ 3 phút/ngày" title="Sửa đúng điểm nghẽn." sub="Bài Red Flag chưa xong được giữ lại và ưu tiên ở trên; bài hằng ngày lấy từ ngân hàng 50 tình huống." />
      {q.loading && <Loading />}
      {q.error && <ErrorBox error={q.error} retry={q.reload} />}
      {red.length > 0 && <div className="section-title">Ưu tiên · Red Flag</div>}
      {red.map((x) => <QuestItem key={x.id} quest={x} />)}
      {daily.length > 0 && <div className="section-title">Bài hằng ngày</div>}
      {daily.map((x) => <QuestItem key={x.id} quest={x} />)}
      {q.data?.length === 0 && <Empty icon={<ListChecks size={20} />} title="Chưa có nhiệm vụ" />}
    </main>
  )
}
