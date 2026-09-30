'use client'
import { useState } from 'react'
import type { Brand } from '@/lib/products'
import { NamedIcon } from './icons'

export function Wordmark() {
  return <span className="wordmark">PG <b>NEXUS</b></span>
}

export function MasanMark() {
  return (
    <span className="masan" aria-label="Masan Consumer">
      <span>MASAN</span>
      <span>CONSUMER</span>
    </span>
  )
}

/** Product photo if /brand/<slug>.jpg is provided, otherwise a vector tile in brand colour. */
export function BrandVisual({ brand, size = 92 }: { brand: Brand; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/brand/${brand.slug}.jpg`} alt={brand.name} width={size} height={size} onError={() => setFailed(true)}
        style={{ width: size, height: size, objectFit: 'contain' }} />
    )
  }
  return (
    <div aria-hidden style={{
      width: size, height: size, borderRadius: 22, display: 'grid', placeItems: 'center', color: '#fff',
      background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${brand.color} 55%, white), ${brand.color} 70%)`,
      boxShadow: `0 10px 22px color-mix(in srgb, ${brand.color} 35%, transparent)`,
    }}>
      <NamedIcon name={brand.icon} size={size * 0.42} strokeWidth={1.8} />
    </div>
  )
}
