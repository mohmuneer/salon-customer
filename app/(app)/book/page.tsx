'use client'
import { useState, Suspense, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, Clock, Package, AlertCircle, Trash2, ShoppingBag, ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react'
import { useApi } from '@/lib/fetcher'
import { mutate } from 'swr'

const TIMES = ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']
const CACHE_BUSY: Record<string, { available: boolean; reason?: string }> = {}

function BookContent() {
  const router = useRouter()
  const params = useSearchParams()
  const deptSlug = params.get('dept') || ''
  const [step, setStep] = useState(1)
  const [sel, setSel] = useState({
    serviceIds: (params.get('service') ? [params.get('service')!] : []).map(String) as string[],
    linkedOrderIds: [] as string[],
    branch: '', staff: '', date: '', time: '', notes: ''
  })
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<Record<string, { busy: boolean; reason?: string }>>({})
  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderDetailModal, setOrderDetailModal] = useState<any>(null)

  const { data: svcData } = useApi<{ services: any[] }>('/api/services')
  const { data: branchesData } = useApi('/api/branches')
  const { data: deptData } = useApi<{ department: any; services: any[] }>(deptSlug ? `/api/departments/${deptSlug}` : null)
  const { data: departmentsData } = useApi<any[]>('/api/departments')
  const departments: any[] = Array.isArray(departmentsData) ? departmentsData : []
  const services: any[] = deptSlug ? (deptData?.services || []) : (svcData?.services || [])
  // Auto-advance to services step when dept slug is present and data loaded
  useEffect(() => {
    if (deptSlug && deptData?.services) setStep(2)
  }, [deptSlug, deptData])

  const firstSelectedService = services.find(s => String(s.id) === (sel.serviceIds[0] || ''))
  const activeDeptId = (deptData?.department?.id || firstSelectedService?.department_id || '') as string
  const { data: staffData } = useApi(activeDeptId ? `/api/staff?dept_id=${activeDeptId}` : '/api/staff')
  const staffLoaded = staffData !== undefined
  const staff: any[] = Array.isArray(staffData) ? staffData : []
  const branches: any[] = Array.isArray(branchesData) ? branchesData : []

  const selectedServices = services.filter(s => sel.serviceIds.includes(String(s.id)))
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration_min || 0), 0)
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price || 0), 0)
  const linkedOrders = orders.filter(o => sel.linkedOrderIds.includes(String(o.id)))
  const ordersTotal = linkedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0)
  const grandTotal = totalPrice + ordersTotal

  const firstServiceId = sel.serviceIds[0] || ''
  const { data: svcProducts } = useApi<any[]>(firstServiceId ? `/api/service-products?service_id=${firstServiceId}` : null)
  const serviceProducts: any[] = Array.isArray(svcProducts) ? svcProducts : []

  useEffect(() => { setSelectedProductIds([]) }, [firstServiceId])

  // Calculate sequential timeline
  const timeline = useCallback(() => {
    if (!sel.time || !selectedServices.length) return []
    let current = sel.time
    return selectedServices.map((svc) => {
      const [h, m] = current.split(':').map(Number)
      const total = h * 60 + m + svc.duration_min
      const end = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
      const slot = { service: svc, start: current, end }
      current = end
      return slot
    })
  }, [sel.time, selectedServices])
  const slots = timeline()

  // Check availability for a specific time slot (staff + customer)
  const checkTime = useCallback(async (staffId: string, date: string, time: string): Promise<{ available: boolean; reason?: string }> => {
    const key = `${staffId}_${date}_${time}`
    if (key in CACHE_BUSY) return CACHE_BUSY[key]
    try {
      const r = await fetch(`/api/check-availability?staff_id=${staffId}&date=${date}&time=${time}`)
      if (!r.ok) { CACHE_BUSY[key] = { available: true }; return { available: true } }
      const d = await r.json()
      const result = { available: !!d.available, reason: d.reason }
      CACHE_BUSY[key] = result
      return result
    } catch {
      CACHE_BUSY[key] = { available: true }
      return { available: true }
    }
  }, [])

  // When staff/date changes, check all times for availability (staff + customer)
  useEffect(() => {
    if (!sel.staff || !sel.date) { setBusy({}); return }
    let cancelled = false
    const checkAll = async () => {
      const results: Record<string, { busy: boolean; reason?: string }> = {}
      for (const t of TIMES) {
        if (cancelled) return
        const { available, reason } = await checkTime(sel.staff, sel.date, t)
        results[t] = { busy: !available, reason }
      }
      if (!cancelled) setBusy(results)
    }
    checkAll()
    return () => { cancelled = true }
  }, [sel.staff, sel.date, checkTime])

  // Clear time if busy
  useEffect(() => {
    if (sel.time && busy[sel.time]?.busy) setSel(f => ({ ...f, time: '' }))
  }, [busy, sel.time])

  // Fetch orders
  useEffect(() => {
    if (step >= 5) {
      setOrdersLoading(true)
      fetch('/api/orders').then(r => r.json()).then(d => {
        const pending = Array.isArray(d) ? d.filter((o: any) => o.status === 'pending') : []
        setOrders(pending)
        // Remove any previously linked orders from selection
        setSel(f => ({
          ...f,
          linkedOrderIds: f.linkedOrderIds.filter(id => {
            const o = pending.find((p: any) => String(p.id) === id)
            return o && !o.linked
          })
        }))
        setOrdersLoading(false)
      }).catch(() => setOrdersLoading(false))
    }
  }, [step])

  const toggleService = (serviceId: string) => {
    setSel(f => ({
      ...f,
      serviceIds: f.serviceIds.includes(String(serviceId)) ? [] : [String(serviceId)],
      staff: '',
    }))
  }

  const toggleOrder = (orderId: string) => {
    const order = orders.find((o: any) => String(o.id) === orderId)
    if (order?.linked) return
    setSel(f => ({
      ...f,
      linkedOrderIds: f.linkedOrderIds.includes(orderId)
        ? f.linkedOrderIds.filter(id => id !== orderId)
        : [...f.linkedOrderIds, orderId]
    }))
  }

  const cancelOrder = async (orderId: string) => {
    const r = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, action: 'cancel' })
    })
    if (r.ok) {
      setOrders(prev => prev.filter((o: any) => o.id !== orderId))
      setSel(f => ({ ...f, linkedOrderIds: f.linkedOrderIds.filter(id => id !== orderId) }))
    }
  }

  const book = async () => {
    setError('')
    const firstSlot = slots[0]
    if (!firstSlot) { setError('لم يتم تحديد الخدمات'); setLoading(false); return }

    setLoading(true)

    const servicesPayload = slots.map(s => ({
      service_id: s.service.id,
      staff_id: sel.staff,
      start_time: s.start
    }))
    try {
      const r = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: servicesPayload,
          date: sel.date,
          notes: sel.notes,
          product_ids: selectedProductIds.length > 0 ? selectedProductIds : undefined,
          linked_order_ids: sel.linkedOrderIds.length > 0 ? sel.linkedOrderIds : undefined
        })
      })
      if (r.ok) setDone(true)
      else setError('فشل الحجز. الرجاء المحاولة مرة أخرى')
    } catch {
      setError('حدث خطأ في الاتصال. الرجاء المحاولة مرة أخرى')
    }
    setLoading(false)
  }

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId])
  }

  if (done) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: 32, textAlign: 'center' }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#10B981,#34D399)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 8px 32px rgba(16,185,129,0.3)' }}>
        <Check size={40} color="white" />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>أُضيف للسلة!</h2>
      <p style={{ color: '#6B7280', marginBottom: 4 }}>{selectedServices.map(s => s.name_ar).join(' + ')}</p>
      <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 28 }}>{sel.date} - {slots[0]?.start}</p>
      <button className="btn-gold" onClick={() => { mutate('/api/appointments'); router.push('/orders') }}>عرض السلة والدفع</button>
      <button className="btn-outline" style={{ marginTop: 10 }} onClick={() => { setDone(false); setStep(1); setSel({ serviceIds: [], linkedOrderIds: [], branch: '', staff: '', date: '', time: '', notes: '' }) }}>حجز موعد جديد</button>
    </div>
  )

  return (
    <div>
      {/* Order Detail Modal */}
      {orderDetailModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'flex-end', justifyContent: 'center',
          padding: 0, overflow: 'hidden'
        }} onClick={() => setOrderDetailModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 430, maxHeight: '85vh',
            background: 'white', borderRadius: '20px 20px 0 0',
            padding: 24, overflowY: 'auto'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>تفاصيل الطلب #{orderDetailModal.id}</h3>
              <button onClick={() => setOrderDetailModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Order info */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#6B7280', fontSize: 13 }}>الحالة</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--gold)' }}>{orderDetailModal.status === 'pending' ? 'قيد الانتظار' : orderDetailModal.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#6B7280', fontSize: 13 }}>الإجمالي</span>
                <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--gold)' }}>{Number(orderDetailModal.total || 0).toLocaleString()} ر.س</span>
              </div>
              {orderDetailModal.shipping_address && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#6B7280', fontSize: 13 }}>عنوان التوصيل</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{orderDetailModal.shipping_address}</span>
                </div>
              )}
            </div>

            {/* Products */}
            <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: '#1A1A2E' }}>المنتجات</p>
            {(orderDetailModal.items || []).length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                لا توجد منتجات في هذا الطلب
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {orderDetailModal.items.map((item: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 12, borderRadius: 12, background: '#F9FAFB'
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, background: '#F1EDE4',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Package size={18} color="var(--gold)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name || 'منتج'}</div>
                      <div style={{ color: '#6B7280', fontSize: 12 }}>
                        {item.quantity || 1} × {Number(item.unit_price || 0).toLocaleString()} ر.س
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {((item.quantity || 1) * Number(item.unit_price || 0)).toLocaleString()} ر.س
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Services info */}
            <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: '#FEF3E2' }}>
              <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--gold)', marginBottom: 8 }}>
                <Package size={14} style={{ display: 'inline' }} /> سيتم استلام الطلب خلال الزيارة
              </p>
              <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                الخدمات المحددة: {selectedServices.map(s => s.name_ar).join('، ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#1A1A2E', padding: '16px 20px 20px', marginTop: -44 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 44 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer' }}>
            <ArrowRight size={20} color="white" />
          </button>
          <h1 style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>حجز موعد</h1>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
          {[1,2,3,4,5,6].map(s => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: step >= s ? 'var(--gold)' : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Step 1: Departments */}
        {step === 1 && (
          <div>
            <p className="section-title" style={{ marginTop: 8 }}>اختر القسم</p>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>اختر القسم الذي تريد حجز خدمة منه</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {departments.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
                  لا توجد أقسام متاحة
                </div>
              ) : (
                departments.map((dept: any) => (
                  <div key={dept.id} onClick={() => { router.push(`/book?dept=${dept.slug}`) }}
                    className="card"
                    style={{
                      padding: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                      border: '1px solid #E8E4DC'
                    }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                      background: 'linear-gradient(135deg,var(--gold),var(--gold-light))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700, fontSize: 24
                    }}>
                      {dept.icon || dept.name_ar?.charAt(0) || <Sparkles size={24} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{dept.name_ar}</div>
                      <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
                        {dept.service_count || 0} خدمة
                      </div>
                    </div>
                    <ArrowRight size={18} color="var(--gold)" />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 2: Services (multi-select) */}
        {step === 2 && (
          <div>
            <p className="section-title" style={{ marginTop: 8 }}>
              {deptData?.department ? `خدمات ${deptData.department.name_ar}` : 'اختر الخدمات'}
            </p>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>اختر الخدمة التي تريد حجزها.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {services.map(s => {
                const selected = sel.serviceIds.includes(s.id)
                return (
                  <div key={s.id} onClick={() => toggleService(s.id)}
                    className="card"
                    style={{
                      padding: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                      border: selected ? '2px solid var(--gold)' : '1px solid #E8E4DC',
                      background: selected ? '#FEF3E2' : 'white'
                    }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      border: selected ? '6px solid var(--gold)' : '2px solid #D1D5DB',
                      background: selected ? 'white' : 'transparent',
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{s.name_ar}</div>
                      <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
                        <Clock size={11} style={{ display: 'inline' }} /> {s.duration_min} دقيقة
                      </div>
                    </div>
                    <div style={{ color: 'var(--gold)', fontWeight: 800, fontSize: 16 }}>{Number(s.price).toLocaleString()} ر.س</div>
                  </div>
                )
              })}
            </div>

            {sel.serviceIds.length > 0 && (
              <div className="card" style={{ marginTop: 14, padding: 16, background: '#FEF3E2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#6B7280' }}>الخدمة المختارة</span>
                  <span style={{ fontWeight: 700 }}>{selectedServices[0]?.name_ar}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 6 }}>
                  <span style={{ color: '#6B7280' }}>المدة</span>
                  <span style={{ fontWeight: 700 }}>{totalDuration} دقيقة</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginTop: 6 }}>
                  <span style={{ color: '#6B7280' }}>السعر</span>
                  <span style={{ fontWeight: 800, color: 'var(--gold)' }}>{totalPrice.toLocaleString()} ر.س</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-outline" style={{ flex: 0.4 }} onClick={() => { setSel(f => ({ ...f, serviceIds: [] })); setStep(1) }}>رجوع</button>
              <button className="btn-gold" style={{ flex: 1 }} disabled={!sel.serviceIds.length} onClick={() => setStep(3)}>التالي</button>
            </div>
          </div>
        )}

        {/* Step 3: Branch */}
        {step === 3 && (
          <div>
            <p className="section-title" style={{ marginTop: 8 }}>اختر الفرع</p>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>اختر فرع الصالون الذي تفضل زيارته</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {branches.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>لا توجد فروع متاحة</div>
              )}
              {branches.map((b: any) => (
                <div key={b.id} onClick={() => setSel(f => ({ ...f, branch: b.id }))}
                  className="card"
                  style={{
                    padding: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                    border: sel.branch === b.id ? '2px solid var(--gold)' : '1px solid #E8E4DC',
                    background: sel.branch === b.id ? '#FEF3E2' : 'white'
                  }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg,var(--gold),var(--gold-light))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 700, fontSize: 20
                  }}>
                    {b.name?.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{b.name}</div>
                    {b.address && <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{b.address}</div>}
                    {b.opening_time && (
                      <div style={{ color: '#6B7280', fontSize: 12, marginTop: 1 }}>
                        {b.opening_time} - {b.closing_time}
                      </div>
                    )}
                  </div>
                  {sel.branch === b.id && (
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} color="white" strokeWidth={3} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-outline" style={{ flex: 0.4 }} onClick={() => setStep(2)}>رجوع</button>
              <button className="btn-gold" style={{ flex: 1 }} disabled={!sel.branch} onClick={() => setStep(4)}>التالي</button>
            </div>
          </div>
        )}

        {/* Step 4: Staff + Date + Time */}
        {step === 4 && (
          <div>
            <p className="section-title" style={{ marginTop: 8 }}>اختر الموظف والموعد</p>

            {selectedServices.length > 1 && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                {selectedServices.map((s, i) => (
                  <span key={s.id} style={{ background: '#FEF3E2', padding: '4px 10px', borderRadius: 6, fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>
                    {i + 1}. {s.name_ar} ({s.duration_min}د)
                  </span>
                ))}
              </div>
            )}

            {/* Staff */}
            {!staffLoaded ? (
              <div style={{ padding: '14px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginBottom: 20 }}>
                جارٍ تحميل الموظفين...
              </div>
            ) : staff.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#FFF5F5', border: '1px solid #FCA5A5', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
                <AlertCircle size={20} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#B91C1C' }}>لا يوجد موظفون متاحون لهذا القسم</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>الرجاء اختيار خدمة أخرى أو التواصل مع الصالون مباشرةً</div>
                </div>
              </div>
            ) : (
              <div className="scroll-row" style={{ marginBottom: 20 }}>
                {staff.map((s: any) => (
                  <div key={s.id} onClick={() => setSel(f => ({ ...f, staff: s.id }))}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 16px', borderRadius: 14, border: sel.staff === s.id ? '2px solid var(--gold)' : '1px solid #E8E4DC', background: sel.staff === s.id ? '#FEF3E2' : 'white', cursor: 'pointer', minWidth: 90 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,var(--gold),var(--gold-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18 }}>
                      {s.name?.charAt(0)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'center' }}>{s.name?.split(' ')[0]}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>⭐ {Number(s.rating || 0).toFixed(1)}</div>
                  </div>
                ))}
              </div>
            )}

            {staffLoaded && staff.length === 0 ? null : <>
            {/* Date */}
            <label style={{ fontSize: 13, color: '#6B7280', display: 'block', marginBottom: 6 }}>التاريخ</label>
            <input className="input" type="date" min={minDate} value={sel.date} onChange={e => setSel(f => ({ ...f, date: e.target.value }))} style={{ marginBottom: 16 }} />

            {/* Time */}
            <label style={{ fontSize: 13, color: '#6B7280', display: 'block', marginBottom: 8 }}>وقت البدء</label>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>سيتم حساب الأوقات المتبقية تلقائياً حسب مدة كل خدمة</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {TIMES.map(t => {
                const info = busy[t]
                const isBusy = info?.busy
                const reason = info?.reason
                const isCustomerConflict = isBusy && reason === 'customer_busy'
                const isSelected = sel.time === t
                return (
                  <button key={t} onClick={() => { if (!isBusy) setSel(f => ({ ...f, time: t })) }}
                    disabled={isBusy}
                    style={{
                      padding: '10px 16px', borderRadius: 10,
                      border: isBusy ? (isCustomerConflict ? '1px dashed #F59E0B' : '1px dashed #FCA5A5') : isSelected ? '2px solid var(--gold)' : '1px solid #E8E4DC',
                      background: isBusy ? (isCustomerConflict ? '#FFFBEB' : '#FFF5F5') : isSelected ? 'var(--gold)' : 'white',
                      color: isBusy ? (isCustomerConflict ? '#B45309' : '#EF4444') : isSelected ? 'white' : '#374151',
                      fontWeight: 600, fontSize: 13, cursor: isBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: isBusy ? 0.7 : 1, position: 'relative' }}>
                    {t}
                    {isBusy && <span style={{ display: 'block', fontSize: 9, color: isCustomerConflict ? '#B45309' : '#EF4444', marginTop: 2 }}>{isCustomerConflict ? 'لديك موعد' : 'محجوز'}</span>}
                  </button>
                )
              })}
            </div>
            {sel.time && busy[sel.time]?.busy && busy[sel.time]?.reason === 'customer_busy' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFBEB', border: '1px solid #F59E0B', color: '#B45309', padding: '12px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>
                <AlertCircle size={16} />
                لديك موعد آخر في هذا الوقت. الرجاء اختيار وقت آخر
              </div>
            )}
            {sel.time && busy[sel.time]?.busy && busy[sel.time]?.reason === 'staff_busy' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF5F5', color: '#EF4444', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>
                <AlertCircle size={16} />
                هذا الموعد غير متاح لهذا الموظف، الرجاء اختيار وقت آخر
              </div>
            )}
            {sel.time && busy[sel.time]?.busy && !busy[sel.time]?.reason && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF5F5', color: '#EF4444', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>
                <AlertCircle size={16} />
                هذا الموعد محجوز مسبقاً، الرجاء اختيار وقت آخر
              </div>
            )}

            {/* Notes */}
            <label style={{ fontSize: 13, color: '#6B7280', display: 'block', marginBottom: 6 }}>ملاحظات (اختياري)</label>
            <textarea className="input" rows={2} placeholder="أي طلبات خاصة..." value={sel.notes} onChange={e => setSel(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'none', marginBottom: 16 }} />
            </>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-outline" style={{ flex: 0.4 }} onClick={() => setStep(3)}>رجوع</button>
              <button className="btn-gold" style={{ flex: 1 }} disabled={!sel.staff || !sel.date || !sel.time || busy[sel.time]?.busy} onClick={() => setStep(5)}>التالي</button>
            </div>
          </div>
        )}

        {/* Step 5: Products (optional) + Orders */}
        {step === 5 && (
          <div>
            <p className="section-title" style={{ marginTop: 8 }}>منتجات إضافية (اختياري)</p>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>
              أضف منتجات للجلسة
            </p>
            {serviceProducts.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 14, marginBottom: 20 }}>
                <Package size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                لا توجد منتجات إضافية للخدمة الأولى
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {serviceProducts.map((sp: any) => {
                  const selected = selectedProductIds.includes(sp.product_id)
                  return (
                    <div key={sp.id} onClick={() => sp.is_optional && toggleProduct(sp.product_id)}
                      className="card"
                      style={{
                        padding: 16, display: 'flex', alignItems: 'center', gap: 14,
                        cursor: sp.is_optional ? 'pointer' : 'default',
                        border: selected ? '2px solid var(--gold)' : '1px solid #E8E4DC',
                        background: selected ? '#FEF3E2' : sp.is_optional ? 'white' : '#F9FAFB',
                        opacity: !sp.is_optional ? 0.7 : 1
                      }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F1EDE4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={20} color="var(--gold)" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{sp.name_ar}</div>
                        <div style={{ color: '#6B7280', fontSize: 12, marginTop: 1 }}>
                          {sp.is_optional ? `إضافة اختيارية +${Number(sp.extra_price || 0).toLocaleString()} ر.س` : 'مشمول في الخدمة'}
                        </div>
                      </div>
                      {!sp.is_optional && <Check size={18} color="#10B981" />}
                      {sp.is_optional && (
                        <div style={{ width: 24, height: 24, borderRadius: 6, border: selected ? 'none' : '2px solid #D1D5DB', background: selected ? 'var(--gold)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {selected && <Check size={16} color="white" strokeWidth={3} />}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Orders section */}
            <p className="section-title">طلباتي</p>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>
              اختر طلباً لاستلامه خلال الزيارة أو ألغِ طلباً
            </p>
            {ordersLoading ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#9CA3AF' }}>جارٍ تحميل الطلبات...</div>
            ) : orders.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                <ShoppingBag size={24} style={{ margin: '0 auto 6px', display: 'block', opacity: 0.4 }} />
                لا توجد طلبات pending
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {orders.map((order: any) => {
                  const selected = sel.linkedOrderIds.includes(String(order.id))
                  const isLinked = order.linked === true
                  return (
                    <div key={order.id} className="card" style={{
                      padding: 14, display: 'flex', alignItems: 'center', gap: 8,
                      border: isLinked ? '1px dashed #D1D5DB' : selected ? '2px solid var(--gold)' : '1px solid #E8E4DC',
                      background: isLinked ? '#F9FAFB' : selected ? '#FEF3E2' : 'white',
                      opacity: isLinked ? 0.6 : 1
                    }}>
                      <div onClick={() => { if (!isLinked) toggleOrder(String(order.id)) }} style={{ cursor: isLinked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          border: isLinked ? '2px solid #D1D5DB' : selected ? 'none' : '2px solid #D1D5DB',
                          background: isLinked ? '#E5E7EB' : selected ? 'var(--gold)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {selected && <Check size={14} color="white" strokeWidth={3} />}
                          {isLinked && <X size={12} color="#9CA3AF" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            طلب #{order.id}
                            {isLinked && <span style={{ background: '#E5E7EB', color: '#6B7280', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>مستخدم</span>}
                          </div>
                          <div style={{ color: '#6B7280', fontSize: 12 }}>
                            {Number(order.total || 0).toLocaleString()} ر.س · {order.items_count || 0} منتجات
                          </div>
                        </div>
                      </div>
                      <button onClick={() => setOrderDetailModal(order)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', padding: 6 }}>
                        <ChevronDown size={18} />
                      </button>
                      {!isLinked && (
                        <button onClick={() => cancelOrder(String(order.id))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 6 }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-outline" style={{ flex: 0.4 }} onClick={() => setStep(4)}>رجوع</button>
              <button className="btn-gold" style={{ flex: 1 }} onClick={() => setStep(6)}>التالي</button>
            </div>
          </div>
        )}

        {/* Step 6: Confirm */}
        {step === 6 && (
          <div>
            <p className="section-title" style={{ marginTop: 8 }}>تأكيد الحجز</p>

            {/* Timeline */}
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A2E', marginBottom: 14 }}>الجدول الزمني</div>
              {slots.map((slot, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  paddingBottom: i < slots.length - 1 ? 14 : 0,
                  marginBottom: i < slots.length - 1 ? 14 : 0,
                  borderBottom: i < slots.length - 1 ? '1px solid #F1EDE4' : 'none',
                  position: 'relative'
                }}>
                  {/* Time column */}
                  <div style={{ textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--gold)' }}>{slot.start}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>{slot.end}</div>
                  </div>
                  {/* Connector */}
                  <div style={{ position: 'relative', paddingLeft: 8 }}>
                    <div style={{ width: 2, height: '100%', background: '#E8E4DC', position: 'absolute', left: 3, top: 0 }} />
                  </div>
                  {/* Service info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{slot.service.name_ar}</div>
                    <div style={{ color: '#6B7280', fontSize: 12 }}>{slot.service.duration_min} دقيقة · {Number(slot.service.price).toLocaleString()} ر.س</div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '2px solid var(--gold)' }}>
                <span style={{ fontWeight: 700 }}>إجمالي الخدمات</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)' }}>{totalPrice.toLocaleString()} ر.س</span>
              </div>
              {ordersTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontWeight: 500, fontSize: 14, color: '#6B7280' }}>الطلبات المحددة</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>+{ordersTotal.toLocaleString()} ر.س</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: ordersTotal > 0 ? 12 : 16, paddingTop: ordersTotal > 0 ? 12 : 14, borderTop: ordersTotal > 0 ? '2px solid #1A1A2E' : '0' }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>الإجمالي الكلي</span>
                <span style={{ fontWeight: 900, fontSize: 22, color: '#1A1A2E' }}>{grandTotal.toLocaleString()} ر.س</span>
              </div>
            </div>

            {/* Selected orders with details */}
            {sel.linkedOrderIds.length > 0 && (
              <div className="card" style={{ padding: 16, marginBottom: 16, background: '#FEF3E2', border: '1px solid var(--gold)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: 'var(--gold)', marginBottom: 12 }}>
                  <ShoppingBag size={16} />
                  الطلبات المحددة ({sel.linkedOrderIds.length})
                </div>
                {linkedOrders.map(o => (
                  <div key={o.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0', borderBottom: '1px solid color-mix(in srgb, var(--gold) 20%, transparent)'
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>طلب #{o.id}</span>
                      <span style={{ color: '#6B7280', fontSize: 12 }}> · {o.items_count || 0} منتجات</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>+{Number(o.total || 0).toLocaleString()} ر.س</span>
                      <button onClick={() => setOrderDetailModal(o)}
                        style={{ background: 'none', border: '1px solid var(--gold)', borderRadius: 6, cursor: 'pointer', color: 'var(--gold)', padding: '4px 8px', fontSize: 11 }}>
                        تفاصيل
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)' }}>
                  <span style={{ fontSize: 13, color: '#6B7280' }}>إجمالي الطلبات</span>
                  <span style={{ fontWeight: 700, color: 'var(--gold)' }}>+{ordersTotal.toLocaleString()} ر.س</span>
                </div>
              </div>
            )}

            {/* Staff + Date info */}
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              {[
                { label: 'الفرع', value: branches.find(b => b.id === sel.branch)?.name },
                { label: 'الموظف', value: staff.find(s => s.id === sel.staff)?.name },
                { label: 'التاريخ', value: sel.date },
                { label: 'وقت البدء', value: sel.time },
                { label: 'المدة الإجمالية', value: `${totalDuration} دقيقة` },
                ...(selectedProductIds.length > 0 ? [{ label: 'منتجات إضافية', value: `${selectedProductIds.length} منتج` }] : []),
                ...(sel.notes ? [{ label: 'ملاحظات', value: sel.notes }] : []),
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid #F1EDE4' }}>
                  <span style={{ color: '#6B7280', fontSize: 14 }}>{label}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{value}</span>
                </div>
              ))}
            </div>

            {error && <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: '#FEE2E2', color: '#EF4444', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-outline" style={{ flex: 0.4 }} onClick={() => setStep(5)}>رجوع</button>
              <button className="btn-gold" style={{ flex: 1 }} disabled={loading} onClick={book}>{loading ? 'جارٍ الحجز...' : 'تأكيد الحجز'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BookPage() {
  return <Suspense><BookContent /></Suspense>
}
