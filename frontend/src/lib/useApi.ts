'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

const message = (e: unknown) => (e instanceof Error ? e.message : 'Lỗi không xác định')

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadedPath, setLoadedPath] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    if (!path) return
    let live = true
    api<T>(path).then(
      (d) => { if (live) { setData(d); setError(null); setLoadedPath(path) } },
      (e) => { if (live) { setError(message(e)); setLoadedPath(path) } },
    )
    return () => { live = false }
  }, [path])

  const reload = useCallback(async () => {
    if (!path) return
    setReloading(true)
    try {
      setData(await api<T>(path))
      setError(null)
    } catch (e) {
      setError(message(e))
    } finally {
      setReloading(false)
    }
  }, [path])

  return { data, error, loading: Boolean(path) && (loadedPath !== path || reloading), reload, setData }
}
