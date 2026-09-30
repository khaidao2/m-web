'use client'
/* Browser speech: mock stand-in for Whisper (STT) and ElevenLabs/OpenAI TTS.
   Chrome (Android) and Safari (iOS 14.5+) both ship vi-VN recognition and voices. */

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => Recognition) | null
}

export const canRecognize = () => recognitionCtor() !== null
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export type Listener = { stop(): Promise<{ text: string; audio: Blob | null }> }

/** Starts listening; `onText` receives the running transcript. Recording is best-effort. */
export async function listen(onText: (text: string) => void, onError: (msg: string) => void): Promise<Listener> {
  let finalText = ''
  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  const chunks: Blob[] = []

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported?.(t))
    recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    recorder.start()
  } catch {
    onError('Không truy cập được micro. Hãy cho phép micro trong cài đặt trình duyệt.')
  }

  const Ctor = recognitionCtor()
  const rec = Ctor ? new Ctor() : null
  let ended: () => void = () => {}
  const endedP = new Promise<void>((r) => (ended = r))
  if (rec) {
    rec.lang = 'vi-VN'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript + ' '
        else interim += r[0].transcript
      }
      onText((finalText + interim).trim())
    }
    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') onError('Nhận diện giọng nói gặp lỗi, bạn có thể gõ câu trả lời.')
    }
    rec.onend = () => ended()
    try {
      rec.start()
    } catch {
      ended()
    }
  } else {
    ended()
  }

  return {
    async stop() {
      rec?.stop()
      const recorded = new Promise<Blob | null>((resolve) => {
        if (!recorder || recorder.state === 'inactive') return resolve(null)
        recorder.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: recorder!.mimeType.split(';')[0] }) : null)
        recorder.stop()
      })
      await Promise.race([endedP, new Promise((r) => setTimeout(r, 1200))])
      const audio = await recorded
      stream?.getTracks().forEach((t) => t.stop())
      return { text: finalText.trim(), audio }
    },
  }
}

const STYLE: Record<string, { rate: number; pitch: number }> = {
  customer: { rate: 1.05, pitch: 1.1 },
  store_manager: { rate: 0.95, pitch: 0.85 },
  store_staff: { rate: 1.1, pitch: 1.0 },
  promotion: { rate: 1.0, pitch: 1.05 },
  full_sale: { rate: 1.0, pitch: 1.1 },
}

/** Speaks the persona line with a tone per character group; resolves when finished. */
export function speak(text: string, group: string): Promise<void> {
  return new Promise((resolve) => {
    if (!canSpeak()) return resolve()
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'vi-VN'
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('vi'))
    if (voice) u.voice = voice
    Object.assign(u, STYLE[group] ?? STYLE.customer)
    u.onend = () => resolve()
    u.onerror = () => resolve()
    synth.speak(u)
    setTimeout(resolve, Math.max(4000, text.length * 110)) // safety net: some engines never fire onend
  })
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel()
}
