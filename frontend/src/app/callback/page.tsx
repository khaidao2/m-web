'use client'
import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { storeToken } from '@/lib/auth'

const KEYCLOAK_URL   = process.env.NEXT_PUBLIC_KEYCLOAK_URL    || 'http://localhost:8180'
const KEYCLOAK_REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM  || 'pgnexus'
const CLIENT_ID      = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'pgnexus-frontend'

function CallbackInner() {
  const router = useRouter()
  const params = useSearchParams()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const code = params.get('code')
    if (!code) { router.replace('/login'); return }

    const redirectUri = window.location.origin + '/callback'
    const tokenUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`

    const body = new URLSearchParams({
      grant_type:   'authorization_code',
      client_id:    CLIENT_ID,
      code,
      redirect_uri: redirectUri,
    })

    fetch(tokenUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    })
      .then(r => r.json())
      .then(data => {
        if (data.access_token) {
          storeToken(data.access_token)
          router.replace('/hoc')
        } else {
          console.error('Token exchange failed', data)
          router.replace('/login')
        }
      })
      .catch(() => router.replace('/login'))
  }, [params, router])

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48,
        border: '3px solid rgba(255,255,255,0.1)',
        borderTopColor: 'var(--red)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>Đang xác thực...</p>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100dvh', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'var(--bg)',
      }}>
        <div style={{
          width: 48, height: 48,
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: 'var(--red)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    }>
      <CallbackInner />
    </Suspense>
  )
}
