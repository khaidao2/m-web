'use client'
import { useEffect, useState } from 'react'
import { api } from './api'

/** Authenticated media (bill photos) as an object URL, revoked on change/unmount. */
export function useBlobUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!path) return
    let live = true
    let made: string | null = null
    api<Blob>(path).then((b) => {
      if (!live) return
      made = URL.createObjectURL(b)
      setUrl(made)
    }).catch(() => {})
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [path])
  return path ? url : null
}
