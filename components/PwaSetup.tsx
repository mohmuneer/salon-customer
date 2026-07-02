'use client'
import { useEffect, useState } from 'react'
import { WifiOff, Share2, ExternalLink } from 'lucide-react'
import { useSalonSettings } from '@/lib/useSalonSettings'
import SalonLogo from '@/components/SalonLogo'

const STORAGE_KEY = 'glamour-pwa-dismissed'

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isInStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
}

export default function PwaSetup() {
  const { settings } = useSalonSettings()
  const [deferred, setDeferred] = useState<any>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [showIOSInstall, setShowIOSInstall] = useState(false)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed) return

    const isIOSDevice = isIOS()
    const standalone = isInStandalone()

    if (isIOSDevice && !standalone) {
      const timer = setTimeout(() => setShowIOSInstall(true), 1500)
      return () => clearTimeout(timer)
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e)
      setShowInstall(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  useEffect(() => {
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setOffline(!navigator.onLine)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferred) return
    deferred.prompt()
    const result = await deferred.userChoice
    if (result.outcome === 'accepted') {
      setShowInstall(false)
      localStorage.setItem(STORAGE_KEY, '1')
    }
    setDeferred(null)
  }

  const dismissInstall = () => {
    setShowInstall(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  const dismissIOSInstall = () => {
    setShowIOSInstall(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  return (
    <>
      {showInstall && (
        <div style={{
          position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 999,
          background: 'white', borderRadius: 16, padding: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)', border: '1px solid #E8E4DC',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <SalonLogo src={settings.logo_url} size={48} borderRadius={12} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A2E' }}>تثبيت التطبيق</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>احصل على تجربة أسرع</div>
          </div>
          <button onClick={handleInstall} style={{
            background: 'linear-gradient(135deg,var(--gold),var(--gold-light))', color: 'white',
            border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13,
            fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            تثبيت
          </button>
          <button onClick={dismissInstall} style={{
            background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
            color: '#9CA3AF', padding: 4
          }}>
            ✕
          </button>
        </div>
      )}

      {showIOSInstall && (
        <div style={{
          position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 999,
          background: 'white', borderRadius: 16, padding: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)', border: '1px solid #E8E4DC',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <SalonLogo src={settings.logo_url} size={44} borderRadius={12} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A2E' }}>تثبيت التطبيق</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>للحصول على تجربة أسرع</div>
            </div>
            <button onClick={dismissIOSInstall} style={{
              background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
              color: '#9CA3AF', padding: 4
            }}>
              ✕
            </button>
          </div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ background: '#F3F4F6', borderRadius: 6, padding: '2px 8px', fontWeight: 600, fontSize: 11 }}>1</span>
              اضغط على زر المشاركة
              <Share2 size={14} style={{ color: '#6B7280' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ background: '#F3F4F6', borderRadius: 6, padding: '2px 8px', fontWeight: 600, fontSize: 11 }}>2</span>
              اختر &quot;إضافة إلى الشاشة الرئيسية&quot;
              <ExternalLink size={14} style={{ color: '#6B7280' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: '#F3F4F6', borderRadius: 6, padding: '2px 8px', fontWeight: 600, fontSize: 11 }}>3</span>
              اضغط على &quot;إضافة&quot; في الأعلى
            </div>
          </div>
        </div>
      )}

      {offline && (
        <div style={{
          position: 'fixed', top: 52, left: 16, right: 16, zIndex: 999,
          background: '#FEE2E2', borderRadius: 12, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#991B1B'
        }}>
          <WifiOff size={16} />
          لا يوجد اتصال بالإنترنت
        </div>
      )}
    </>
  )
}
