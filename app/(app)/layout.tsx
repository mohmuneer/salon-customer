'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Calendar, ShoppingBag, ShoppingCart, User } from 'lucide-react'
import { useCart, usePaidAppts } from '@/lib/useCart'
import { useApi } from '@/lib/fetcher'
import { useSalonSettings } from '@/lib/useSalonSettings'

const tabs = [
  { href: '/home',         icon: Home,        label: 'الرئيسية' },
  { href: '/appointments', icon: Calendar,    label: 'مواعيدي' },
  { href: '/store',        icon: ShoppingBag, label: 'المتجر' },
  { href: '/orders',       icon: ShoppingCart,label: 'طلباتي' },
  { href: '/profile',      icon: User,        label: 'حسابي' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { count: cartCount } = useCart()
  const { ids: paidApptIds }  = usePaidAppts()
  useSalonSettings() // apply dynamic theme from DB to all app pages
  const { data: apptsData }  = useApi<any[]>('/api/appointments')
  const activeAppts = Array.isArray(apptsData)
    ? apptsData.filter(a =>
        !['cancelled', 'completed', 'no_show'].includes(a.status) &&
        !paidApptIds.has(String(a.id))
      ).length
    : 0
  const badge = cartCount + activeAppts

  return (
    <div className="app-screen">
      {/* Status bar */}
      <div style={{ height: 44, background: '#1A1A2E' }} />

      {children}

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const isCart = href === '/orders'
          return (
            <button key={href} className={`nav-item ${active ? 'active' : ''}`} onClick={() => router.push(href)} style={{ position: 'relative' }}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {isCart && badge > 0 && (
                <span style={{
                  position: 'absolute', top: 0, right: '50%', transform: 'translateX(8px)',
                  background: '#EF4444', color: 'white', fontSize: 9, fontWeight: 800,
                  borderRadius: '50%', minWidth: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px', lineHeight: 1,
                }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
