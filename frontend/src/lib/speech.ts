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

/* Persona voice. The server renders Vietnamese with Piper (same clear voice on every phone);
   the browser's own voice is used only if it really is Vietnamese; otherwise the text on
   screen is the fallback — never an English voice reading Vietnamese. */
let player: HTMLAudioElement | null = null
let playingUrl: string | null = null
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA='

/** Call from a tap (e.g. "Bắt đầu") so iOS Safari allows later audio playback. */
export function unlockAudio() {
  if (typeof window === 'undefined') return
  player ??= new Audio()
  player.src = SILENCE
  void player.play().catch(() => {})
}

function vietnameseVoice(): SpeechSynthesisVoice | undefined {
  return canSpeak() ? window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().replace('_', '-').startsWith('vi')) : undefined
}

function speakInBrowser(text: string): Promise<void> {
  const voice = vietnameseVoice()
  if (!voice) return Promise.resolve()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.voice = voice
    u.lang = voice.lang
    u.volume = 1
    u.onend = u.onerror = () => resolve()
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
    setTimeout(resolve, Math.max(4000, text.length * 110)) // some engines never fire onend
  })
}

/** Speaks a persona line; resolves when playback ends (or immediately if no voice is available). */
export async function speak(text: string, group: string, fetchAudio: (text: string, group: string) => Promise<Blob>): Promise<void> {
  stopSpeaking()
  try {
    const blob = await fetchAudio(text, group)
    player ??= new Audio()
    if (playingUrl) URL.revokeObjectURL(playingUrl)
    playingUrl = URL.createObjectURL(blob)
    player.src = playingUrl
    player.volume = 1
    await new Promise<void>((resolve) => {
      player!.onended = player!.onerror = player!.onpause = () => resolve()
      player!.play().catch(() => resolve())
    })
  } catch {
    await speakInBrowser(text)
  }
}

export function stopSpeaking(): void {
  if (player && !player.paused) player.pause()
  if (canSpeak()) window.speechSynthesis.cancel()
}
