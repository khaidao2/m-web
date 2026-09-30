'use client'
/* Branded login in front of Keycloak: the app's own form exchanges credentials at the realm's
   token endpoint (same origin, /auth). Keycloak stays the identity provider — it verifies passwords,
   applies brute-force lockout and signs tokens — but its pages are never shown to users. */

const OIDC = '/auth/realms/pgnexus/protocol/openid-connect'
const CLIENT_ID = 'pgnexus-web'
const STORE = 'pgnexus.tokens'

export type Role = 'pg' | 'supervisor'
type Tokens = { access_token: string; refresh_token: string; expires_at: number; refresh_expires_at: number }
type Claims = { exp: number; name?: string; preferred_username?: string; realm_access?: { roles?: string[] } }

let refreshing: Promise<Tokens | null> | null = null

function read(): Tokens | null {
  try {
    return JSON.parse(localStorage.getItem(STORE) || 'null')
  } catch {
    return null
  }
}

function write(t: Tokens | null) {
  try {
    if (t) localStorage.setItem(STORE, JSON.stringify(t))
    else localStorage.removeItem(STORE)
  } catch {
    /* storage unavailable (private mode): the session just won't survive a reload */
  }
}

export function claims(): Claims | null {
  const t = read()
  if (!t) return null
  try {
    const b64 = t.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(escape(atob(b64))))
  } catch {
    return null
  }
}

export function currentRole(): Role | null {
  const t = read()
  if (!t || t.refresh_expires_at < Date.now()) return null
  const roles = claims()?.realm_access?.roles ?? []
  return roles.includes('supervisor') ? 'supervisor' : roles.includes('pg') ? 'pg' : null
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const res = await fetch(`${OIDC}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new LoginError(data.error || '', data.error_description || '')
  const now = Date.now()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: now + data.expires_in * 1000,
    refresh_expires_at: data.refresh_expires_in ? now + data.refresh_expires_in * 1000 : now + 30 * 86400_000,
  }
}

export class LoginError extends Error {
  constructor(public code: string, detail: string) {
    super(
      code === 'invalid_grant' && /disabled|locked/i.test(detail)
        ? 'Tài khoản tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau hoặc liên hệ SUP.'
        : code === 'invalid_grant'
          ? 'Sai tên đăng nhập hoặc mật khẩu.'
          : 'Không kết nối được máy chủ đăng nhập. Vui lòng thử lại sau.',
    )
  }
}

export async function login(username: string, password: string): Promise<Role | null> {
  write(await tokenRequest({ grant_type: 'password', username: username.trim(), password, scope: 'openid' }))
  return currentRole()
}

/** A valid access token, refreshed when it is about to expire; null when the session is over. */
export async function accessToken(): Promise<string | null> {
  const t = read()
  if (!t) return null
  if (t.expires_at - Date.now() > 30_000) return t.access_token
  if (t.refresh_expires_at < Date.now()) {
    write(null)
    return null
  }
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token })
    .then((fresh) => { write(fresh); return fresh })
    .catch(() => { write(null); return null })
    .finally(() => { refreshing = null })
  return (await refreshing)?.access_token ?? null
}

export async function logout() {
  const t = read()
  write(null)
  if (t) {
    await fetch(`${OIDC}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, refresh_token: t.refresh_token }),
    }).catch(() => {})
  }
  window.location.replace('/')
}
