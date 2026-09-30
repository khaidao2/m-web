export const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8180'
export const KEYCLOAK_REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'pgnexus'
export const KEYCLOAK_CLIENT_ID = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'pgnexus-frontend'

export function getLoginUrl(redirectUri: string) {
  return (
    `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth?` +
    `client_id=${KEYCLOAK_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&scope=openid+profile+email`
  )
}

export function getLogoutUrl(redirectUri: string) {
  return (
    `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout?` +
    `post_logout_redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `client_id=${KEYCLOAK_CLIENT_ID}`
  )
}

export function storeToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem('pg_token', token)
}

export function getToken() {
  if (typeof window !== 'undefined') return localStorage.getItem('pg_token')
  return null
}

export function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem('pg_token')
}
