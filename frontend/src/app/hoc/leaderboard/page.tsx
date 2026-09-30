'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getToken } from '@/lib/auth'
import { api } from '@/lib/api'

interface LBEntry {
  rank: number
  user_id: string
  full_name: string
  store_code: string
  points: number
  is_current_user?: boolean
}

const MEDALS = ['🥇', '🥈', '🥉']
const PODIUM_COLORS = [
  { bg: 'linear-gradient(135deg, #B8860B, #FFB800)', border: '#FFB800', label: '#1A0A00' },
  { bg: 'linear-gradient(135deg, #6B7280, #9CA3AF)', border: '#9CA3AF', label: '#0A0A0A' },
  { bg: 'linear-gradient(135deg, #92400E, #F97316)', border: '#F97316', label: '#1A0A00' },
]

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()
  const hue = name.charCodeAt(0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue}, 60%, 30%)`,
      border: `2px solid hsl(${hue}, 60%, 50%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, color: 'white',
      fontSize: size > 44 ? '1rem' : '0.75rem',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LBEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [myRank, setMyRank]   = useState<LBEntry | null>(null)
  const token = getToken()!

  async function loadData() {
    setLoading(true)
    try {
      const [lb, me] = await Promise.all([api.leaderboard(token), api.myRank(token)])
      setEntries(Array.isArray(lb) ? lb : [])
      setMyRank(me)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const top3 = entries.slice(0, 3)
  const rest  = entries.slice(3)

  return (
    <div className="page" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(160deg, #0A0008 0%, #1A0010 100%)',
        padding: '20px 16px 0',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 800 }}>
            🏆 Bảng Xếp Hạng
          </h1>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, padding: '8px 12px',
              color: 'white', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
            }}
          >
            {loading ? <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>↻</span> : '↻'}
          </button>
        </div>

        {/* Podium */}
        {!loading && top3.length >= 2 && (
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            gap: 8, padding: '24px 0 0',
          }}>
            {/* 2nd */}
            {top3[1] && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{ textAlign: 'center', flex: 1 }}
              >
                <Avatar name={top3[1].full_name} size={48} />
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: 600 }}>
                  {top3[1].full_name.split(' ').pop()}
                </div>
                <div style={{
                  ...PODIUM_COLORS[1],
                  background: PODIUM_COLORS[1].bg,
                  marginTop: 8, borderRadius: '12px 12px 0 0',
                  height: 80, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${PODIUM_COLORS[1].border}`, borderBottom: 'none',
                }}>
                  <span style={{ fontSize: '1.5rem' }}>🥈</span>
                  <span style={{ color: PODIUM_COLORS[1].label, fontWeight: 700, fontSize: '0.8rem' }}>
                    {top3[1].points.toLocaleString()}
                  </span>
                </div>
              </motion.div>
            )}
            {/* 1st */}
            {top3[0] && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
                style={{ textAlign: 'center', flex: 1 }}
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Avatar name={top3[0].full_name} size={60} />
                </motion.div>
                <div style={{ fontSize: '0.8rem', color: 'white', marginTop: 4, fontWeight: 700 }}>
                  {top3[0].full_name.split(' ').pop()}
                </div>
                <div style={{
                  background: PODIUM_COLORS[0].bg,
                  marginTop: 8, borderRadius: '12px 12px 0 0',
                  height: 110, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${PODIUM_COLORS[0].border}`, borderBottom: 'none',
                  boxShadow: '0 -4px 24px rgba(255,184,0,0.3)',
                }}>
                  <span style={{ fontSize: '2rem' }}>🥇</span>
                  <span style={{ color: PODIUM_COLORS[0].label, fontWeight: 800, fontSize: '0.875rem' }}>
                    {top3[0].points.toLocaleString()}
                  </span>
                </div>
              </motion.div>
            )}
            {/* 3rd */}
            {top3[2] && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{ textAlign: 'center', flex: 1 }}
              >
                <Avatar name={top3[2].full_name} size={44} />
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: 600 }}>
                  {top3[2].full_name.split(' ').pop()}
                </div>
                <div style={{
                  background: PODIUM_COLORS[2].bg,
                  marginTop: 8, borderRadius: '12px 12px 0 0',
                  height: 60, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${PODIUM_COLORS[2].border}`, borderBottom: 'none',
                }}>
                  <span style={{ fontSize: '1.3rem' }}>🥉</span>
                  <span style={{ color: PODIUM_COLORS[2].label, fontWeight: 700, fontSize: '0.75rem' }}>
                    {top3[2].points.toLocaleString()}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* My rank sticky card */}
      {myRank && (
        <div style={{
          margin: '12px 16px 0',
          background: 'linear-gradient(135deg, rgba(200,16,46,0.2), rgba(200,16,46,0.05))',
          border: '1px solid rgba(200,16,46,0.4)',
          borderRadius: 14, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--red)', minWidth: 32 }}>
            #{myRank.rank}
          </span>
          <Avatar name={myRank.full_name} size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ color: 'white', fontWeight: 600, fontSize: '0.875rem' }}>
              {myRank.full_name} (Bạn)
            </div>
            <div style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>{myRank.store_code}</div>
          </div>
          <div style={{
            background: 'var(--red)', borderRadius: 10,
            padding: '4px 10px', color: 'white',
            fontWeight: 700, fontSize: '0.875rem',
          }}>
            {myRank.points.toLocaleString()} ⭐
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />
          ))
        ) : (
          <AnimatePresence>
            {rest.map((entry, i) => (
              <motion.div
                key={entry.user_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                style={{
                  background: entry.is_current_user
                    ? 'rgba(200,16,46,0.12)'
                    : 'var(--surface)',
                  border: `1px solid ${entry.is_current_user ? 'rgba(200,16,46,0.3)' : 'var(--border)'}`,
                  borderRadius: 12, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <span style={{
                  fontWeight: 700, fontSize: '1rem', color: 'var(--text2)',
                  minWidth: 28, textAlign: 'center',
                }}>
                  {entry.rank}
                </span>
                <Avatar name={entry.full_name} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: entry.is_current_user ? 'var(--red)' : 'var(--text)',
                    fontWeight: 600, fontSize: '0.875rem',
                  }}>
                    {entry.full_name}{entry.is_current_user ? ' (Bạn)' : ''}
                  </div>
                  <div style={{ color: 'var(--text3)', fontSize: '0.72rem' }}>{entry.store_code}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ color: '#FFB800', fontWeight: 700, fontSize: '0.875rem' }}>
                    {entry.points.toLocaleString()} ⭐
                  </span>
                  {/* Mini score bar */}
                  <div style={{ width: 60, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 99 }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (entry.points / (rest[0]?.points || entries[0]?.points || 1)) * 100)}%`,
                      background: 'linear-gradient(90deg, var(--red), #FF2D55)',
                      borderRadius: 99,
                    }} />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {!loading && entries.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px 0' }}>
            Chưa có dữ liệu xếp hạng
          </div>
        )}
      </div>
    </div>
  )
}
