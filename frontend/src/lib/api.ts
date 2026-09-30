'use client'
import { accessToken } from './auth'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = await accessToken()
  if (!token) {
    window.location.replace('/')
    throw new ApiError(401, 'Phiên đăng nhập đã hết hạn')
  }
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  let body = init.body
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(init.json)
  }
  const res = await fetch(`/api/v1${path}`, { ...init, headers, body })
  if (!res.ok) {
    let detail = `Lỗi ${res.status}`
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') detail = data.detail
    } catch {}
    throw new ApiError(res.status, detail)
  }
  const type = res.headers.get('content-type') || ''
  return (type.includes('application/json') ? res.json() : res.blob()) as Promise<T>
}
