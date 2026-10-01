'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Camera, CheckCircle2, ImagePlus, Plus, RotateCcw, Sun, Trash2, XCircle } from 'lucide-react'
import { BrandVisual } from '../Brand'
import { api } from '@/lib/api'
import { BILL_STATUS, vnd, type Bill, type Program, type Shift } from '@/lib/billTypes'
import { compressPhoto } from '@/lib/image'
import { BRANDS } from '@/lib/products'

type Draft = Pick<Bill, 'bill_no' | 'store_name' | 'purchased_at' | 'total_vnd'> & { lines: EditLine[] }
type EditLine = { name: string; qty: string; amount: string; mch?: boolean; slug?: string | null; brand?: string | null }

const toLocalInput = (iso: string | null) => (iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 16).replace(' ', 'T') : '')
const digits = (s: string) => s.replace(/\D/g, '')

async function fetchShifts() {
  const [shifts, p] = await Promise.all([api<Shift[]>('/dday/shifts'), api<{ programs: Program[] }>('/dday/programs')])
  return { shifts, programs: p.programs }
}

export default function ScanFlow({ onDone }: { onDone: () => void }) {
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [shiftId, setShiftId] = useState<string>('')
  const [joinProgram, setJoinProgram] = useState('')
  const [hours, setHours] = useState('8')
  const [photo, setPhoto] = useState<string | null>(null)
  const [bill, setBill] = useState<Bill | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [result, setResult] = useState<Bill | null>(null)
  const [busy, setBusy] = useState<'join' | 'scan' | 'confirm' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)

  function apply({ shifts: s, programs: p }: { shifts: Shift[]; programs: Program[] }) {
    const open = s.filter((x) => x.program.is_open)
    setShifts(open)
    setPrograms(p.filter((pr) => !s.some((x) => x.program.id === pr.id)))
    return open
  }
  useEffect(() => {
    let live = true
    fetchShifts()
      .then((d) => { if (live) setShiftId(apply(d)[0]?.id ?? '') })
      .catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [])

  async function join() {
    setBusy('join')
    setError(null)
    try {
      const s = await api<Shift>('/dday/shifts', { method: 'POST', json: { program_id: joinProgram, hours: Number(hours.replace(',', '.')) } })
      apply(await fetchShifts())
      setShiftId(s.id)
      setJoinProgram('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tham gia được')
    } finally {
      setBusy(null)
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setResult(null)
    setBusy('scan')
    setPhoto(URL.createObjectURL(file))
    try {
      const blob = await compressPhoto(file)
      const form = new FormData()
      form.set('shift_id', shiftId)
      form.set('image', blob, 'bill.jpg')
      const b = await api<Bill>('/bills', { method: 'POST', body: form })
      setBill(b)
      setDraft({
        bill_no: b.bill_no, store_name: b.store_name, purchased_at: b.purchased_at, total_vnd: b.total_vnd,
        lines: b.lines.map((l) => ({ name: l.name, qty: String(l.qty), amount: String(l.amount), mch: l.mch, slug: l.slug, brand: l.brand })),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không đọc được bill')
      setPhoto(null)
    } finally {
      setBusy(null)
    }
  }

  const sums = useMemo(() => {
    if (!draft) return null
    const lineSum = draft.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
    const total = draft.total_vnd ?? 0
    return { lineSum, total, ok: !total || Math.abs(lineSum - total) <= Math.max(1000, total * 0.02) }
  }, [draft])

  function setLine(i: number, patch: Partial<EditLine>) {
    setDraft((d) => d && { ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch, ...(patch.name !== undefined ? { mch: undefined } : {}) } : l)) })
  }

  async function confirm() {
    if (!bill || !draft) return
    setBusy('confirm')
    setError(null)
    try {
      const lines = draft.lines.filter((l) => l.name.trim() && Number(l.amount) > 0).map((l) => {
        const qty = Math.max(1, Number(l.qty) || 1)
        const amount = Number(l.amount)
        return { name: l.name.trim(), qty, unit_price: Math.round(amount / qty), amount }
      })
      await api(`/bills/${bill.id}`, {
        method: 'PATCH',
        json: {
          bill_no: draft.bill_no, store_name: draft.store_name, total_vnd: draft.total_vnd, lines,
          purchased_at: draft.purchased_at ? new Date(draft.purchased_at).toISOString() : null,
        },
      })
      setResult(await api<Bill>(`/bills/${bill.id}/confirm`, { method: 'POST' }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xác nhận được')
    } finally {
      setBusy(null)
    }
  }

  function reset() {
    if (photo) URL.revokeObjectURL(photo)
    setPhoto(null)
    setBill(null)
    setDraft(null)
    setResult(null)
    onDone()
  }

  const step = result ? 3 : draft ? 2 : 1
  const activeShift = shifts?.find((s) => s.id === shiftId)

  return (
    <section style={{ marginTop: 14 }}>
      <div className="steps" aria-hidden>{[1, 2, 3].map((n) => <span key={n} className={n <= step ? 'on' : ''} />)}</div>
      {error && <div className="note" role="alert" style={{ background: 'var(--red-soft)', borderColor: '#f7c9cb', color: 'var(--red-deep)', marginBottom: 12 }}>{error}</div>}

      {result ? (
        <ResultCard bill={result} onNext={reset} />
      ) : draft && sums ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          {photo && <div className="scan-photo"><img src={photo} alt="Ảnh bill" /></div>}
          <div className="card" style={{ marginTop: 12 }}>
            <b>Kiểm tra thông tin bill</b>
            <p className="tiny muted" style={{ marginTop: 4 }}>Hệ thống đã đọc ảnh. Sửa nếu đọc sai — mọi chỉnh sửa đều được lưu vết.</p>
            <div className="grid2" style={{ marginTop: 12 }}>
              <div className="field"><label htmlFor="bno">Số bill</label>
                <input id="bno" className="input" value={draft.bill_no ?? ''} onChange={(e) => setDraft({ ...draft, bill_no: e.target.value })} /></div>
              <div className="field"><label htmlFor="bat">Ngày giờ trên bill</label>
                <input id="bat" type="datetime-local" className="input" value={toLocalInput(draft.purchased_at)}
                  onChange={(e) => setDraft({ ...draft, purchased_at: e.target.value ? `${e.target.value}:00+07:00` : null })} /></div>
            </div>
            <div className="field" style={{ marginTop: 10 }}><label htmlFor="bst">Cửa hàng trên bill</label>
              <input id="bst" className="input" value={draft.store_name ?? ''} onChange={(e) => setDraft({ ...draft, store_name: e.target.value })} /></div>
          </div>

          <div className="section-title">Sản phẩm trên bill <span className="chip">{draft.lines.length} dòng</span></div>
          {draft.lines.map((l, i) => {
            const brand = BRANDS.find((b) => b.slug === l.slug)
            return (
              <div key={i} className="line-card">
                <div>{brand && l.mch !== false ? <BrandVisual brand={brand} size={40} /> : <div className="tile" style={{ width: 40, height: 40, background: 'var(--bg)', color: 'var(--muted)' }}><ImagePlus size={17} /></div>}</div>
                <div>
                  <div className="row" style={{ gap: 6 }}>
                    <input className="input grow" aria-label="Tên sản phẩm" value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} />
                    <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="Xóa dòng" onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
                  </div>
                  <div className="nums">
                    <input className="input" inputMode="numeric" aria-label="Số lượng" value={l.qty} onChange={(e) => setLine(i, { qty: digits(e.target.value) })} />
                    <input className="input" inputMode="numeric" aria-label="Thành tiền" value={l.amount} onChange={(e) => setLine(i, { amount: digits(e.target.value) })} />
                    {l.mch === undefined ? <span className="chip">Sẽ kiểm tra</span> : l.mch ? <span className="chip red">MCH · {l.brand}</span> : <span className="chip">Khác</span>}
                  </div>
                </div>
              </div>
            )
          })}
          <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => setDraft({ ...draft, lines: [...draft.lines, { name: '', qty: '1', amount: '' }] })}>
            <Plus size={17} /> Thêm dòng sản phẩm
          </button>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="field"><label htmlFor="btotal">Tổng tiền in trên bill</label>
              <input id="btotal" className="input" inputMode="numeric" value={draft.total_vnd ?? ''} onChange={(e) => setDraft({ ...draft, total_vnd: digits(e.target.value) ? Number(digits(e.target.value)) : null })} /></div>
            <div className="row small" style={{ marginTop: 10, color: sums.ok ? 'var(--green)' : 'var(--l2)', fontWeight: 600 }}>
              {sums.ok ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
              Tổng các dòng {vnd(sums.lineSum)} {sums.ok ? 'khớp tổng bill' : `lệch ${vnd(Math.abs(sums.lineSum - sums.total))} so với tổng bill`}
            </div>
          </div>
          <div className="stack" style={{ marginTop: 14 }}>
            <button className="btn primary block" onClick={confirm} disabled={busy === 'confirm' || !draft.lines.length}>
              <CheckCircle2 size={18} /> {busy === 'confirm' ? 'Đang kiểm tra…' : 'Xác nhận & gửi bill'}
            </button>
            <button className="btn ghost block" onClick={reset}><RotateCcw size={17} /> Chụp lại</button>
          </div>
        </>
      ) : (
        <>
          <div className="card">
            <b>1. Ca D-day của bạn</b>
            {shifts === null ? <p className="small muted" style={{ marginTop: 8 }}>Đang tải…</p> : (
              <>
                {shifts.length > 0 && (
                  <div className="stack" style={{ marginTop: 10 }}>
                    {shifts.map((s) => (
                      <label key={s.id} className="row" style={{ padding: 12, borderRadius: 12, border: `1.5px solid ${s.id === shiftId ? 'var(--red)' : 'var(--line)'}`, background: s.id === shiftId ? 'var(--red-soft)' : 'var(--card)', cursor: 'pointer' }}>
                        <input type="radio" name="shift" checked={s.id === shiftId} onChange={() => setShiftId(s.id)} style={{ accentColor: 'var(--red)' }} />
                        <div className="grow">
                          <div className="small" style={{ fontWeight: 700 }}>{s.program.name}</div>
                          <div className="tiny muted">{s.program.activity} · {new Date(s.program.day).toLocaleDateString('vi-VN')} · {s.program.store_name} · {s.hours} giờ</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {programs.length > 0 ? (
                  <div className="stack" style={{ marginTop: 12 }}>
                    <div className="tiny muted">{shifts.length ? 'Hoặc tham gia chương trình khác' : 'Tham gia chương trình do Supervisor cấu hình'}</div>
                    <select className="input" value={joinProgram} onChange={(e) => setJoinProgram(e.target.value)} aria-label="Chương trình D-day">
                      <option value="">Chọn chương trình D-day</option>
                      {programs.map((p) => <option key={p.id} value={p.id}>{p.name} · {new Date(p.day).toLocaleDateString('vi-VN')} · {p.store_name}</option>)}
                    </select>
                    <div className="row">
                      <input className="input" style={{ width: 110 }} inputMode="decimal" aria-label="Giờ công" value={hours} onChange={(e) => setHours(e.target.value)} />
                      <span className="small muted grow">giờ công (tự khai)</span>
                      <button className="btn sm dark" onClick={join} disabled={!joinProgram || busy === 'join'}>Tham gia</button>
                    </div>
                  </div>
                ) : shifts.length === 0 && (
                  <p className="small muted" style={{ marginTop: 8 }}>Chưa có chương trình đang mở. Nhờ Supervisor cấu hình chương trình trước khi chụp bill.</p>
                )}
              </>
            )}
          </div>

          <div className="card" style={{ marginTop: 14, opacity: activeShift ? 1 : 0.5 }}>
            <b>2. Chụp trọn bill</b>
            {busy === 'scan' && photo ? (
              <div className="scan-photo" style={{ marginTop: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img src={photo} alt="Ảnh bill đang đọc" />
                <div className="laser" />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, color: '#fff', background: 'linear-gradient(transparent, rgba(0,0,0,.7))', fontWeight: 600 }}>Đang đọc bill…</div>
              </div>
            ) : (
              <>
                <button className="scan-target" style={{ width: '100%', marginTop: 12 }} disabled={!activeShift} onClick={() => camera.current?.click()}>
                  <Camera size={40} strokeWidth={1.6} />
                  <b style={{ fontSize: 16 }}>Chụp bill</b>
                  <span className="small">Đặt bill phẳng, đủ sáng, thấy rõ số bill, ngày giờ và từng dòng</span>
                </button>
                <button className="btn ghost block" style={{ marginTop: 10 }} disabled={!activeShift} onClick={() => gallery.current?.click()}><ImagePlus size={17} /> Chọn ảnh có sẵn</button>
                <div className="row tiny muted" style={{ marginTop: 10, gap: 6 }}><Sun size={14} /> Tránh bóng đổ và nếp gấp. Che thông tin cá nhân của khách nếu có.</div>
              </>
            )}
            <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
            <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
          </div>
          <p className="tiny muted" style={{ marginTop: 12 }}>
            Ngày, cửa hàng và điều kiện lấy từ chương trình; PG không tự thay đổi. Ảnh gốc được lưu để SUP đối chiếu. Giờ công hiện do PG tự khai.
          </p>
        </>
      )}
    </section>
  )
}

function ResultCard({ bill, onNext }: { bill: Bill; onNext: () => void }) {
  const s = BILL_STATUS[bill.status]
  const Icon = bill.status === 'valid' ? CheckCircle2 : bill.status === 'review' ? AlertTriangle : XCircle
  return (
    <div className="card pop" style={{ textAlign: 'center', padding: 24 }}>
      <Icon size={52} color={s.color} style={{ margin: '0 auto' }} />
      <div className="h2" style={{ marginTop: 10, color: s.color }}>{s.label}</div>
      <p className="small muted" style={{ marginTop: 6 }}>
        {bill.status === 'valid' ? `Đã ghi nhận ${vnd(bill.mch_value_vnd)} sản phẩm Masan vào kết quả D-day.`
          : bill.status === 'review' ? 'Bill được giữ lại để Supervisor kiểm tra trước khi tính.' : 'Bill không được tính vào kết quả.'}
      </p>
      {bill.flags.length > 0 && (
        <ul className="stack small" style={{ listStyle: 'none', marginTop: 14, textAlign: 'left' }}>
          {bill.flags.map((f) => (
            <li key={f.code} className="row" style={{ gap: 8 }}><AlertTriangle size={15} color={f.severity === 'rejected' ? 'var(--red)' : 'var(--l2)'} /> {f.label}</li>
          ))}
        </ul>
      )}
      {bill.status === 'valid' && bill.mch_categories.length > 1 && <span className="chip green" style={{ marginTop: 12 }}>Bill đa ngành hàng · {bill.mch_categories.join(' + ')}</span>}
      <button className="btn primary block" style={{ marginTop: 18 }} onClick={onNext}><Camera size={18} /> Chụp bill tiếp</button>
    </div>
  )
}
