import { Sparkles, WifiOff } from 'lucide-react'
import Link from 'next/link'

export default function OfflinePage() {
  return (
    <div style={{
      minHeight: '100vh', background: '#1A1A2E',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 24, textAlign: 'center', gap: 20
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 24,
        background: 'linear-gradient(135deg,var(--gold),var(--gold-light))',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <WifiOff size={36} color="white" />
      </div>
      <h1 style={{ color: 'white', fontSize: 22, fontWeight: 800 }}>لا يوجد اتصال</h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6 }}>
        يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى
      </p>
      <Link href="/" style={{
        background: 'linear-gradient(135deg,var(--gold),var(--gold-light))', color: 'white',
        border: 'none', padding: '12px 32px', borderRadius: 14, fontSize: 15,
        fontWeight: 700, textDecoration: 'none', marginTop: 8
      }}>
        إعادة المحاولة
      </Link>
    </div>
  )
}
