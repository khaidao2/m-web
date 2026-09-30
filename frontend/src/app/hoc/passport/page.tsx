'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getToken } from '@/lib/auth'
import { api } from '@/lib/api'
import PassportRadar from '@/components/PassportRadar'

interface PassportData {
  pg_name: string
  store_code: string
  overall_score: number
  total_points: number
  red_flags: string[]
  scores: {
    c1: number; c2: number; c3: number; c4: number;
    c5: number; c6: number; c7: number;
  }
  levels: Record<string, number>
}

const COMPETENCIES = [
  { key: 'c1', name: 'Tiếp cận & Kết nối',  icon: '🤝' },
  { key: 'c2', name: 'Thấu hiểu Nhu cầu',   icon: '💡' },
  { key: 'c3', name: 'Tư vấn Sản phẩm',     icon: '🎯' },
  { key: 'c4', name: 'Gia tăng Giá trị',    icon: '📈' },
  { key: 'c5', name: 'Xử lý Phản bác',      icon: '🛡️' },
  { key: 'c6', name: 'Đàm phán',            icon: '🤜' },
  { key: 'c7', name: 'Thái độ & Kỷ luật',   icon: '⭐' },
]

function getLevelLabel(l: number) {
  return ['', 'Cơ Bản', 'Đang Tiến Bộ', 'Thành Thạo', 'Xuất Sắc'][l] ?? 'Chưa Xác Định'
}

function ScoreBar({ score, max = 4 }: { score: number; max?: number }) {
  const pct = (score / max) * 100
  return (
    <div className="progress-track" style={{ marginTop: 6 }}>
      <motion.div
        className="progress-fill"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </div>
  )
}

export default function PassportPage() {
  const [data, setData] = useState<PassportData | null>(null)
  const [loading, setLoading] = useState(true)
  const token = getToken()!

  useEffect(() => {
    api.passport(token)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="page" style={{ padding: '16px' }}>
        <div className="skeleton" style={{ height: 200, borderRadius: 20, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 260, borderRadius: 20, marginBottom: 16 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 80, borderRadius: 14, marginBottom: 10 }} />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <span style={{ fontSize: '3rem' }}>📋</span>
        <p style={{ color: 'var(--text2)' }}>Chưa có dữ liệu hộ chiếu</p>
      </div>
    )
  }

  const scoreColor = data.overall_score >= 3
    ? '#22C55E' : data.overall_score >= 2
    ? '#FFB800' : '#C8102E'

  return (
    <div className="page">
      {/* Header banner */}
      <div style={{
        background: 'linear-gradient(160deg, #0A0008, #1A0010, #0A0A1A)',
        padding: '20px 16px 0',
      }}>
        <h1 style={{ color: 'white', fontWeight: 800, marginBottom: 4 }}>🎖️ Hộ Chiếu Năng Lực</h1>
        <p style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>
          {data.pg_name} · {data.store_code}
        </p>

        {/* Overall score */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 150 }}
          style={{
            marginTop: 20,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20, padding: '20px',
            display: 'flex', alignItems: 'center', gap: 20,
          }}
        >
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            border: `4px solid ${scoreColor}`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 24px ${scoreColor}60`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
              {data.overall_score.toFixed(1)}
            </span>
            <span style={{ color: 'var(--text3)', fontSize: '0.65rem' }}>/ 4.0</span>
          </div>
          <div>
            <div style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>Điểm Tổng Thể</div>
            <div style={{
              color: 'white', fontWeight: 700, fontSize: '1.1rem', marginTop: 2,
            }}>
              {data.overall_score >= 3.5 ? 'Xuất Sắc 🌟' :
               data.overall_score >= 2.5 ? 'Thành Thạo ✅' :
               data.overall_score >= 1.5 ? 'Đang Tiến Bộ 📈' : 'Cơ Bản 🌱'}
            </div>
            <div style={{
              marginTop: 8,
              background: 'linear-gradient(135deg, rgba(255,184,0,0.2), rgba(255,184,0,0.05))',
              border: '1px solid rgba(255,184,0,0.3)',
              borderRadius: 10, padding: '4px 12px',
              display: 'inline-block',
            }}>
              <span style={{ color: '#FFB800', fontWeight: 700 }}>
                ⭐ {data.total_points?.toLocaleString() ?? 0} điểm
              </span>
            </div>
          </div>
        </motion.div>

        {/* Red flags */}
        {data.red_flags?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              marginTop: 12,
              background: 'rgba(200,16,46,0.1)',
              border: '1px solid rgba(200,16,46,0.35)',
              borderRadius: 14, padding: '12px 16px',
            }}
          >
            <div style={{ color: '#FF4060', fontWeight: 600, fontSize: '0.875rem', marginBottom: 8 }}>
              🚩 Khu vực cần cải thiện
            </div>
            {data.red_flags.map(f => (
              <div key={f} style={{ color: 'rgba(255,100,100,0.8)', fontSize: '0.8rem', marginTop: 4 }}>
                • {f}
              </div>
            ))}
          </motion.div>
        )}

        {/* Radar */}
        <div style={{ marginTop: 16, marginBottom: -1 }}>
          <PassportRadar scores={data.scores} />
        </div>
      </div>

      {/* Competency cards */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ color: 'var(--text)', fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>
          Chi Tiết Năng Lực
        </h2>
        {COMPETENCIES.map((c, i) => {
          const score = data.scores[c.key as keyof typeof data.scores] ?? 0
          const level = data.levels?.[c.key] ?? Math.ceil(score)
          const isRed = score < 2.0
          return (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              style={{
                background: isRed ? 'rgba(200,16,46,0.08)' : 'var(--surface)',
                border: `1px solid ${isRed ? 'rgba(200,16,46,0.25)' : 'var(--border)'}`,
                borderRadius: 14, padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1 }}>
                  <span style={{ fontSize: '1.4rem' }}>{c.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>
                      {c.name}
                    </div>
                    <ScoreBar score={score} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: 12, flexShrink: 0 }}>
                  <div style={{
                    color: 'white', fontWeight: 700, fontSize: '1.1rem', lineHeight: 1,
                  }}>
                    {score.toFixed(1)}
                    <span style={{ color: 'var(--text3)', fontSize: '0.7rem', fontWeight: 400 }}>/4</span>
                  </div>
                  <span className={`level-badge level${level}`} style={{ marginTop: 4, display: 'inline-block' }}>
                    L{level} {getLevelLabel(level)}
                  </span>
                </div>
              </div>
              {isRed && (
                <div className="red-flag" style={{ marginTop: 8 }}>
                  🚩 Cần cải thiện — Hãy luyện tập thêm!
                </div>
              )}
            </motion.div>
          )
        })}
        <div style={{ height: 12 }} />
      </div>
    </div>
  )
}
