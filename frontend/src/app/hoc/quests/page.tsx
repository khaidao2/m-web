'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/auth'
import { api } from '@/lib/api'

interface Quest {
  id: string
  title: string
  description: string
  type: 'quiz' | 'voice' | string
  target_competency: string
  target_id?: string
  completed: boolean
  points_reward: number
}

const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  quiz:  { icon: '🎯', color: '#C8102E', label: 'Bài Kiểm Tra' },
  voice: { icon: '🎙️', color: '#7C3AED', label: 'Luyện Giọng'  },
}

const COMPETENCY_LABELS: Record<string, string> = {
  c1: 'Tiếp cận & Kết nối',
  c2: 'Thấu hiểu Nhu cầu',
  c3: 'Tư vấn Sản phẩm',
  c4: 'Gia tăng Giá trị',
  c5: 'Xử lý Phản bác',
  c6: 'Đàm phán',
  c7: 'Thái độ & Kỷ luật',
}

function formatDate() {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date())
}

export default function QuestsPage() {
  const [quests, setQuests]   = useState<Quest[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)
  const router = useRouter()
  const token  = getToken()!

  useEffect(() => {
    api.quests(token)
      .then(d => { setQuests(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function handleStart(q: Quest) {
    if (q.type === 'quiz' && q.target_id) {
      router.push(`/hoc/quiz/${q.target_id}`)
    } else if (q.type === 'voice') {
      router.push('/hoc/voice')
    }
  }

  const done    = quests.filter(q => q.completed)
  const pending = quests.filter(q => !q.completed)
  const progress = quests.length > 0 ? (done.length / quests.length) * 100 : 0

  return (
    <div className="page">
      {/* Header */}
      <div className="top-bar">
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>📋 Nhiệm Vụ Hôm Nay</h1>
          <div style={{ color: 'var(--text3)', fontSize: '0.75rem', marginTop: 1 }}>
            {formatDate()}
          </div>
        </div>
        <div style={{
          background: done.length === quests.length && quests.length > 0
            ? 'rgba(34,197,94,0.15)' : 'rgba(255,184,0,0.12)',
          border: `1px solid ${done.length === quests.length && quests.length > 0
            ? 'rgba(34,197,94,0.3)' : 'rgba(255,184,0,0.25)'}`,
          borderRadius: 10, padding: '6px 12px',
          color: done.length === quests.length && quests.length > 0 ? '#4ADE80' : '#FFB800',
          fontWeight: 700, fontSize: '0.875rem',
        }}>
          {done.length}/{quests.length}
        </div>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {/* Progress bar */}
        {!loading && quests.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ marginBottom: 20 }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              color: 'var(--text2)', fontSize: '0.8rem', marginBottom: 8,
            }}>
              <span>Tiến độ hôm nay</span>
              <span style={{ color: '#FFB800', fontWeight: 600 }}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className="progress-track progress-gold">
              <motion.div
                className="progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                style={{ background: 'linear-gradient(90deg, #CC9400, #FFB800)' }}
              />
            </div>
          </motion.div>
        )}

        {/* All done state */}
        {!loading && pending.length === 0 && done.length > 0 && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring' }}
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 20, marginBottom: 20,
            }}
          >
            <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>🎉</div>
            <h2 style={{ color: '#4ADE80', marginBottom: 8 }}>Tuyệt vời!</h2>
            <p style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>
              Bạn đã hoàn thành tất cả nhiệm vụ hôm nay!
            </p>
          </motion.div>
        )}

        {/* Pending quests */}
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16, marginBottom: 12 }} />
          ))
        ) : (
          <AnimatePresence>
            {pending.map((q, i) => {
              const meta = TYPE_META[q.type] ?? { icon: '📌', color: '#6B7280', label: q.type }
              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ delay: i * 0.06 }}
                  style={{
                    background: `${meta.color}10`,
                    border: `1px solid ${meta.color}30`,
                    borderRadius: 16, padding: '16px',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{
                      width: 48, height: 48, flexShrink: 0,
                      background: `${meta.color}20`,
                      border: `1px solid ${meta.color}40`,
                      borderRadius: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.6rem',
                    }}>
                      {meta.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'flex-start', gap: 8,
                      }}>
                        <div style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3 }}>
                          {q.title}
                        </div>
                        <span style={{
                          background: 'rgba(255,184,0,0.15)',
                          border: '1px solid rgba(255,184,0,0.3)',
                          borderRadius: 99, padding: '2px 8px',
                          color: '#FFB800', fontSize: '0.7rem', fontWeight: 700,
                          flexShrink: 0,
                        }}>
                          +{q.points_reward} ⭐
                        </span>
                      </div>
                      <div style={{ color: 'var(--text2)', fontSize: '0.78rem', marginTop: 4, lineHeight: 1.4 }}>
                        {q.description}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                        <span className="badge" style={{
                          background: `${meta.color}20`,
                          color: meta.color,
                          border: `1px solid ${meta.color}40`,
                        }}>
                          {meta.label}
                        </span>
                        {q.target_competency && (
                          <span style={{ color: 'var(--text3)', fontSize: '0.7rem' }}>
                            {COMPETENCY_LABELS[q.target_competency] ?? q.target_competency}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary btn-full btn-sm"
                    style={{ marginTop: 14, background: `linear-gradient(135deg, ${meta.color}, ${meta.color}CC)` }}
                    onClick={() => handleStart(q)}
                    disabled={completing === q.id}
                  >
                    {completing === q.id ? '⏳ Đang xử lý...' : '🚀 Bắt đầu'}
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}

        {/* Completed quests */}
        {done.length > 0 && (
          <>
            <div style={{ color: 'var(--text3)', fontSize: '0.8rem', fontWeight: 600, margin: '16px 0 10px' }}>
              ✅ Đã hoàn thành ({done.length})
            </div>
            {done.map(q => {
              const meta = TYPE_META[q.type] ?? { icon: '📌', color: '#6B7280', label: q.type }
              return (
                <div key={q.id} style={{
                  background: 'rgba(34,197,94,0.06)',
                  border: '1px solid rgba(34,197,94,0.15)',
                  borderRadius: 14, padding: '14px 16px',
                  marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12,
                  opacity: 0.75,
                }}>
                  <span style={{ fontSize: '1.4rem' }}>{meta.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      color: 'var(--text2)', fontWeight: 600, fontSize: '0.875rem',
                      textDecoration: 'line-through',
                    }}>
                      {q.title}
                    </div>
                  </div>
                  <span style={{ fontSize: '1.2rem' }}>✅</span>
                </div>
              )
            })}
          </>
        )}

        {!loading && quests.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '80px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📭</div>
            <p>Không có nhiệm vụ nào hôm nay</p>
          </div>
        )}

        <div style={{ height: 16 }} />
      </div>
    </div>
  )
}
