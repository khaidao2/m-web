const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function apiFetch(path: string, options?: RequestInit, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> || {}) },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  me: (token: string) => apiFetch('/users/me', {}, token),
  passport: (token: string) => apiFetch('/passport', {}, token),
  leaderboard: (token: string) => apiFetch('/leaderboard', {}, token),
  myRank: (token: string) => apiFetch('/leaderboard/me', {}, token),
  quizzes: (token: string) => apiFetch('/quizzes', {}, token),
  quiz: (id: string, token: string) => apiFetch(`/quizzes/${id}`, {}, token),
  startQuiz: (id: string, token: string) =>
    apiFetch(`/quizzes/${id}/start`, { method: 'POST' }, token),
  submitQuiz: (attemptId: string, answers: unknown[], token: string) =>
    apiFetch(`/quizzes/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }, token),
  scenarios: (token: string) => apiFetch('/voice/scenarios', {}, token),
  createSession: (scenarioId: string, token: string) =>
    apiFetch('/voice/sessions', {
      method: 'POST',
      body: JSON.stringify({ scenario_id: scenarioId }),
    }, token),
  transcribe: (sessionId: string, audioBlob: Blob, token: string) => {
    const fd = new FormData()
    fd.append('audio', audioBlob, 'audio.webm')
    return fetch(`${API_BASE}/api/v1/voice/sessions/${sessionId}/transcribe`, {
      method: 'POST',
      body: fd,
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json())
  },
  chat: (sessionId: string, transcript: string, token: string) =>
    apiFetch(`/voice/sessions/${sessionId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    }, token),
  tts: (sessionId: string, text: string, token: string) =>
    fetch(`${API_BASE}/api/v1/voice/sessions/${sessionId}/tts`, {
      method: 'POST',
      body: JSON.stringify({ text }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }),
  completeSession: (sessionId: string, token: string) =>
    apiFetch(`/voice/sessions/${sessionId}/complete`, { method: 'POST' }, token),
  quests: (token: string) => apiFetch('/quests/today', {}, token),
}
