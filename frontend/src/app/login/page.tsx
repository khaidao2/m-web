'use client'
import { motion } from 'framer-motion'
import { getLoginUrl } from '@/lib/auth'

const floaters = [
  { emoji: '🍜', delay: 0,   duration: 3.0, x: 15, y: 20 },
  { emoji: '🌶️', delay: 0.5, duration: 3.5, x: 80, y: 35 },
  { emoji: '🧂', delay: 1.0, duration: 2.8, x: 20, y: 65 },
  { emoji: '🫙', delay: 1.5, duration: 3.2, x: 75, y: 70 },
  { emoji: '🍜', delay: 2.0, duration: 3.8, x: 50, y: 10 },
]

export default function LoginPage() {
  function handleLogin() {
    const redirectUri = window.location.origin + '/callback'
    window.location.href = getLoginUrl(redirectUri)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #0A0005 0%, #1A0010 40%, #0A0A1A 70%, #000010 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      padding: '24px 16px',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(200,16,46,0.25) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', right: '-10%',
        width: 250, height: 250,
        background: 'radial-gradient(circle, rgba(255,184,0,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Floating emojis */}
      {floaters.map((f, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -14, 0] }}
          transition={{ duration: f.duration, delay: f.delay, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            left: `${f.x}%`, top: `${f.y}%`,
            fontSize: '2rem',
            opacity: 0.35,
            pointerEvents: 'none',
            filter: 'blur(0.5px)',
          }}
        >
          {f.emoji}
        </motion.div>
      ))}

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ marginBottom: 40, textAlign: 'center' }}
      >
        {/* Masan logo block */}
        <div style={{
          display: 'inline-block',
          background: 'linear-gradient(135deg, #C8102E, #8B0000)',
          borderRadius: 16,
          padding: '12px 24px',
          marginBottom: 16,
          boxShadow: '0 8px 32px rgba(200,16,46,0.5)',
        }}>
          <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: 700, letterSpacing: 3 }}>
            MASAN CONSUMER
          </span>
        </div>

        <div style={{ color: 'white', fontSize: '2.5rem', fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>
          PG<span style={{ color: '#FFB800' }}>-NEXUS</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: 8 }}>
          Nền tảng Đào tạo Kỹ năng PG
        </div>
      </motion.div>

      {/* Glass card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
        className="glass-strong"
        style={{ width: '100%', maxWidth: 360, padding: 32 }}
      >
        <h2 style={{ textAlign: 'center', marginBottom: 8, fontSize: '1.3rem' }}>
          Chào mừng trở lại 👋
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text2)', marginBottom: 28, fontSize: '0.875rem' }}>
          Đăng nhập để tiếp tục hành trình học tập của bạn
        </p>

        <button className="btn btn-primary btn-full" onClick={handleLogin} style={{ fontSize: '1rem', gap: 12 }}>
          <span>🔐</span>
          Đăng nhập với Keycloak
        </button>

        <div style={{ marginTop: 24, textAlign: 'center', color: 'var(--text3)', fontSize: '0.75rem' }}>
          Bảo mật bởi Keycloak SSO
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
          {['🎯 Bài kiểm tra', '🎙️ Luyện giọng AI', '🏆 Bảng xếp hạng'].map(f => (
            <span key={f} style={{
              padding: '4px 10px', background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 99,
              fontSize: '0.7rem', color: 'var(--text2)',
            }}>{f}</span>
          ))}
        </div>
      </motion.div>

      {/* Bottom brand */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        style={{ marginTop: 40, textAlign: 'center' }}
      >
        <div style={{ color: 'var(--text3)', fontSize: '0.7rem' }}>
          Được phát triển bởi
        </div>
        <div style={{ color: 'var(--text2)', fontSize: '0.8rem', fontWeight: 600, marginTop: 4 }}>
          Masan Consumer Corporation
        </div>
        <div style={{ color: 'var(--text3)', fontSize: '0.65rem', marginTop: 2 }}>
          Dành cho PG tại hệ thống Bách Hoá Xanh
        </div>
      </motion.div>
    </div>
  )
}
