'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Settings, Store, X } from 'lucide-react'
import BottomNav from './BottomNav'
import { MasanMark, Wordmark } from './Brand'
import { Loading } from './ui'
import { accessToken, currentRole, logout, type Role } from '@/lib/auth'
import { api } from '@/lib/api'
import type { Me } from '@/lib/types'

export default function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [sheet, setSheet] = useState(false)

  useEffect(() => {
    accessToken().then((token) => {
      const actual = token ? currentRole() : null
      if (!actual) router.replace('/')
      else if (actual !== role) router.replace(actual === 'supervisor' ? '/sup' : '/hoc')
      else setReady(true)
    })
  }, [role, router])

  if (!ready) return <div className="app"><Loading /></div>

  return (
    <div className="app">
      <div className="topbar">
        <Wordmark />
        <div className="row">
          <MasanMark />
          <button className="icon-btn" aria-label="Hồ sơ & cài đặt" onClick={() => setSheet(true)}><Settings size={19} /></button>
        </div>
      </div>
      {children}
      <BottomNav role={role} />
      {sheet && <ProfileSheet onClose={() => setSheet(false)} />}
    </div>
  )
}

function ProfileSheet({ onClose }: { onClose: () => void }) {
  const [me, setMe] = useState<Me | null>(null)
  const [store, setStore] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    api<Me>('/me').then((m) => {
      setMe(m)
      setStore(m.store_name ?? '')
    })
  }, [])

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      setMe(await api<Me>('/me', { method: 'PATCH', json: { store_name: store } }))
      setMsg('Đã lưu cửa hàng')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div role="dialog" aria-modal aria-label="Hồ sơ" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(23,26,35,.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="card rise" onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, borderRadius: '22px 22px 0 0', padding: '20px 16px calc(20px + var(--safe-b))' }}>
        <div className="row between">
          <div>
            <div className="eyebrow">Hồ sơ</div>
            <div className="h2" style={{ marginTop: 4 }}>{me?.full_name ?? '…'}</div>
            <div className="muted small">{me?.role === 'supervisor' ? 'Sales Supervisor' : 'PG · BHX HCM'}</div>
          </div>
          <button className="icon-btn" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
        </div>
        {me?.role === 'pg' && (
          <div className="field" style={{ marginTop: 18 }}>
            <label htmlFor="store"><Store size={13} style={{ verticalAlign: -2 }} /> Cửa hàng đang phụ trách</label>
            <input id="store" className="input" value={store} placeholder="VD: BHX Q7 - Huỳnh Tấn Phát" onChange={(e) => setStore(e.target.value)} />
            <button className="btn dark block" style={{ marginTop: 8 }} disabled={saving || store.trim().length < 2} onClick={save}>Lưu cửa hàng</button>
            {msg && <span className="small muted">{msg}</span>}
          </div>
        )}
        <button className="btn soft block" style={{ marginTop: 14 }} onClick={() => void logout()}><LogOut size={18} /> Đăng xuất</button>
      </div>
    </div>
  )
}
