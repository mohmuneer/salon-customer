'use client'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'

export default function SalonLogo({ src, size = 40, borderRadius = 12 }: { src?: string; size?: number; borderRadius?: number }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return (
      <div style={{ width: size, height: size, borderRadius, overflow: 'hidden', flexShrink: 0 }}>
        <img src={src} alt="" style={{ width: size, height: size, objectFit: 'cover' }} onError={() => setFailed(true)} />
      </div>
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius,
      background: 'linear-gradient(135deg,var(--gold),var(--gold-light))',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }}>
      <Sparkles size={Math.round(size * 0.5)} color="white" />
    </div>
  )
}
