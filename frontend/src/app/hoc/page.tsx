'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { getToken } from '@/lib/auth'
import { api } from '@/lib/api'
import PassportRadar from '@/components/PassportRadar'

interface UserData {
  full_name: string
  store_code: string
  points: number
  streak_days: number
}
interface RankData { rank: number; total: number }
interface PassportData {
  scores: Record<string, number>
  total_points: number
  red_flags: string[]
}
interface Quest { id: string; title: string; type: string; completed: boolean }

const QUICK_ACTIONS = [
  { icon: '🎯', label: 'Làm Bài Kiểm Tra', href: '/hoc/quests',      color: '#C8102E' },
  { icon: '🎙️', label: 'Luyện Giọng AI',   href: '/hoc/voice',       color: '#7C3AED' },
  { icon: '🏆', label: 'Bảng Xếp Hạng',   href: '/hoc/leaderboard', color: '#FFB800' },
  { icon: '📋', label: 'Nhiệm Vụ Hôm Nay', href: '/hoc/quests',      color: '#0EA5E9' },
]

function Skeleton({ w = '100%', h = 20, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r }} />
}

export default function HomePage() {
  const [user, setUser]       = useState<UserData | null>(null)
  const [rank, setRank]       = useState<RankData | null>(null)
  const [passport, setPassport] = useState<PassportData | null>(null)
  const [quests, setQuests]   = useState<Quest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()!
    Promise.all([
      api.me(token).catch(() => null),
      api.myRank(token).catch(() => null),
      api.passport(token).catch(() => null),
      api.quests(token).catch(() => []),
    ]).then(([u, r, p, q]) => {
      setUser(u)
      setRank(r)
      setPassport(p)
      setQuests(Array.isArray(q) ? q : [])
      setLoading(false)
    })
  }, [])

  const pendingQuests = quests.filter(q => !q.completed).length

  return (
    <div className="page" style={{ background: 'var(--bg)' }}>
      {/* Top Bar */}
      <div className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--red), #FF2D55)',
            borderRadius: 10, padding: '6px 12px',
            boxShadow: 'var(--shadow-red)',
          }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem', letterSpacing: -0.5 }}>
              PG<span style={{ color: '#FFB800' }}>-NEXUS</span>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', padding: 4 }}>🔔</button>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, var(--red), var(--red-light))',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: 'white', fontSize: '0.875rem',
            boxShadow: '0 2px 12px rgba(200,16,46,0.4)',
          }}>
            {user?.full_name?.[0] ?? '?'}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Welcome card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            marginTop: 16,
            padding: '20px 20px',
            borderRadius: 20,
            background: 'linear-gradient(135deg, #8B0000 0%, #C8102E 50%, #FF2D55 100%)',
            boxShadow: '0 8px 32px rgba(200,16,46,0.4)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative blur */}
          <div style={{
            position: 'absolute', top: -30, right: -30,
            width: 120, height: 120,
            background: 'rgba(255,184,0,0.2)',
            borderRadius: '50%', filter: 'blur(30px)',
          }} />
          {loading ? (
            <>
              <Skeleton h={22} w="60%" />
              <Skeleton h={16} w="80%" r={6} />
            </>
          ) : (
            <>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', marginBottom: 4 }}>
                Xin chào 👋
              </div>
              <div style={{ color: 'white', fontSize: '1.2rem', fontWeight: 700 }}>
                {user?.full_name ?? 'PG'}!
              </div>
              <div style={{
                color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem', marginTop: 6,
                background: 'rgba(0,0,0,0.2)', display: 'inline-block',
                padding: '4px 10px', borderRadius: 99,
              }}>
                🎯 Hôm nay bạn có{' '}
                <strong style={{ color: '#FFB800' }}>{pendingQuests} nhiệm vụ</strong> chờ hoàn thành
              </div>
            </>
          )}
        </motion.div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16 }}>
          {[
            {
              icon: '⭐', label: 'Điểm', value: loading ? '...' : (user?.points ?? 0).toLocaleString(),
              bg: 'linear-gradient(135deg, rgba(255,184,0,0.15), rgba(255,184,0,0.05))',
              border: 'rgba(255,184,0,0.3)', color: '#FFB800',
            },
            {
              icon: '🏆', label: 'Hạng', value: loading ? '...' : `#${rank?.rank ?? '-'}`,
              bg: 'linear-gradient(135deg, rgba(200,16,46,0.15), rgba(200,16,46,0.05))',
              border: 'rgba(200,16,46,0.3)', color: '#FF4060',
            },
            {
              icon: '🔥', label: 'Streak', value: loading ? '...' : `${user?.streak_days ?? 0}d`,
              bg: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))',
              border: 'rgba(249,115,22,0.3)', color: '#FB923C',
            },
          ].map(s => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              style={{
                background: s.bg, border: `1px solid ${s.border}`,
                borderRadius: 14, padding: '14px 10px', textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.4rem' }}>{s.icon}</div>
              <div style={{ color: s.color, fontSize: '1.1rem', fontWeight: 700, marginTop: 4 }}>
                {s.value}
              </div>
              <div style={{ color: 'var(--text3)', fontSize: '0.7rem', marginTop: 2 }}>{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="section-header" style={{ marginTop: 8 }}>
          <span className="section-title">Hành Động Nhanh</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {QUICK_ACTIONS.map((a, i) => (
            <motion.div
              key={a.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * i }}
            >
              <Link href={a.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: `${a.color}18`,
                  border: `1px solid ${a.color}40`,
                  borderRadius: 16,
                  padding: '18px 16px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                  cursor: 'pointer', transition: 'transform 0.15s ease',
                  minHeight: 90,
                }} className="card">
                  <span style={{ fontSize: '1.6rem' }}>{a.icon}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.3 }}>
                    {a.label}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Passport preview */}
        <div className="section-header" style={{ marginTop: 4 }}>
          <span className="section-title">📊 Hộ Chiếu Năng Lực</span>
          <Link href="/hoc/passport" style={{
            color: 'var(--red)', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
          }}>Xem chi tiết →</Link>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="card"
          style={{ padding: '16px 12px' }}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <div className="skeleton" style={{ width: 200, height: 200, borderRadius: '50%' }} />
            </div>
          ) : passport ? (
            <>
              <PassportRadar scores={passport.scores ?? {}} />
              {passport.red_flags?.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {passport.red_flags.map((f: string) => (
                    <span key={f} className="red-flag">🚩 {f}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0' }}>
              Chưa có dữ liệu năng lực
            </div>
          )}
        </motion.div>

        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}
