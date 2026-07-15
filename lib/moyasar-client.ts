'use client'

const FORM_VERSION = '1.7.3'
const SCRIPT_URL = `https://cdn.moyasar.com/mpf/${FORM_VERSION}/moyasar.js`
const CSS_URL = `https://cdn.moyasar.com/mpf/${FORM_VERSION}/moyasar.css`

let loadingPromise: Promise<void> | null = null

function loadMoyasarAssets(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).Moyasar) return Promise.resolve()
  if (loadingPromise) return loadingPromise

  loadingPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = CSS_URL
      document.head.appendChild(link)
    }
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`)
    if (existing) { resolve(); return }
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('تعذر تحميل نموذج الدفع'))
    document.head.appendChild(script)
  })
  return loadingPromise
}

export async function startMoyasarCheckout(opts: {
  elementSelector: string
  amountSar: number
  description: string
  publishableKey: string
  orderId?: string | null
  appointmentIds?: string[]
}) {
  await loadMoyasarAssets()
  const Moyasar = (window as any).Moyasar
  if (!Moyasar) throw new Error('تعذر تحميل نموذج الدفع')

  const callbackUrl = new URL('/payment-callback', window.location.origin)
  if (opts.orderId) callbackUrl.searchParams.set('orderId', opts.orderId)
  if (opts.appointmentIds?.length) callbackUrl.searchParams.set('appointmentIds', opts.appointmentIds.join(','))

  Moyasar.init({
    element: opts.elementSelector,
    amount: Math.round(opts.amountSar * 100),
    currency: 'SAR',
    description: opts.description,
    publishable_api_key: opts.publishableKey,
    callback_url: callbackUrl.toString(),
    methods: ['creditcard', 'applepay', 'stcpay'],
    metadata: {
      order_id: opts.orderId || undefined,
      appointment_ids: opts.appointmentIds?.length ? opts.appointmentIds.join(',') : undefined,
    },
  })
}
