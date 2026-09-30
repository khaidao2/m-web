'use client'
import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Eye, EyeOff, Lock, Mic, ShieldCheck, Smartphone, UserRound } from 'lucide-react'
import { MasanMark, Wordmark } from '@/components/Brand'
import HeroArt from '@/components/HeroArt'
import { accessToken, currentRole, login, LoginError, type Role } from '@/lib/auth'

const POINTS = [
  { icon: BookOpen, text: 'Quiz 3 phút, kiến thức sát điểm bán' },
  { icon: Mic, text: '50 tình huống luyện nói thực chiến' },
  { icon: ShieldCheck, text: 'Passport năng lực, SUP đồng hành' },
]

const home = (role: Role) => (role === 'supervisor' ? '/sup' : '/hoc')

export default function Landing() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    accessToken().then((t) => {
      const role = t ? currentRole() : null
      if (role) router.replace(home(role))
    })
  }, [router])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const role = await login(username, password)
      if (role) router.replace(home(role))
      else setError('Tài khoản chưa được cấp quyền PG hoặc SUP. Liên hệ quản trị viên.')
    } catch (err) {
      setError(err instanceof LoginError ? err.message : 'Không đăng nhập được. Vui lòng thử lại.')
    } finally {
      setBusy(false)
      setPassword('')
    }
  }

  return (
    <main className="app" style={{ background: 'var(--card)' }}>
      <div className="topbar" style={{ background: 'var(--card)' }}>
        <Wordmark />
        <MasanMark />
      </div>
      <section style={{ position: 'relative', height: 180, overflow: 'hidden', color: '#fff' }}>
        <HeroArt />
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 18 }}>
          <div className="eyebrow" style={{ color: '#ffd7d9' }}>Masan Consumer • BHX HCM</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.12, marginTop: 8, letterSpacing: '-0.02em' }}>
            Học mỗi ngày.<br />Vững thực chiến.
          </h1>
        </div>
      </section>

      <section className="page bare" style={{ paddingTop: 22 }}>
        <div className="eyebrow">Chào mừng bạn trở lại</div>
        <h2 className="h2" style={{ marginTop: 8 }}>Sẵn sàng cho một ca bán hàng tốt hơn?</h2>
        <ul className="stack" style={{ listStyle: 'none', margin: '14px 0 20px' }}>
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="row small"><Icon size={18} color="var(--red)" /> {text}</li>
          ))}
        </ul>

        <form className="stack" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="username">Tên đăng nhập</label>
            <div style={{ position: 'relative' }}>
              <UserRound size={18} color="var(--muted)" style={{ position: 'absolute', left: 14, top: 14 }} />
              <input id="username" className="input" style={{ paddingLeft: 42 }} autoComplete="username" autoCapitalize="none"
                spellCheck={false} placeholder="VD: pg01" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="password">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--muted)" style={{ position: 'absolute', left: 14, top: 14 }} />
              <input id="password" className="input" style={{ paddingLeft: 42, paddingRight: 46 }} type={show ? 'text' : 'password'}
                autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShow(!show)}
                style={{ position: 'absolute', right: 6, top: 4, width: 38, height: 38, display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && (
            <div role="alert" className="note" style={{ background: 'var(--red-soft)', borderColor: '#f7c9cb', color: 'var(--red-deep)' }}>{error}</div>
          )}
          <button className="btn primary block" type="submit" disabled={busy || !username.trim() || !password} style={{ marginTop: 4 }}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
          <p className="tiny muted" style={{ textAlign: 'center' }}>Quên mật khẩu? Liên hệ Sales Supervisor để được cấp lại.</p>
        </form>

        <div className="note" style={{ marginTop: 18 }}>
          <Smartphone size={18} style={{ marginTop: 1 }} />
          <span>Thiết kế cho Chrome và Safari trên điện thoại. Khi luyện nói, hãy cho phép sử dụng micro.</span>
        </div>
        <p className="tiny muted" style={{ marginTop: 16 }}>
          Bản pilot PG NEXUS. Tài liệu học giả lập được đánh dấu riêng; không thay thế chính sách bán hàng hiện hành.
        </p>
      </section>
    </main>
  )
}
