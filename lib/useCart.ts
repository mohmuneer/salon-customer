'use client'
import { useState, useEffect, useCallback } from 'react'

const PAID_APPTS_KEY = 'glamour-paid-appts'
const PAID_EVENT     = 'glamour-paid-appts-changed'

export function usePaidAppts() {
  const [ids, setIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(PAID_APPTS_KEY)
        setIds(new Set(raw ? JSON.parse(raw) : []))
      } catch {}
    }
    load()
    window.addEventListener(PAID_EVENT, load)
    return () => window.removeEventListener(PAID_EVENT, load)
  }, [])

  const markPaid = useCallback((apptIds: string[]) => {
    setIds(prev => {
      const next = new Set([...prev, ...apptIds])
      try {
        localStorage.setItem(PAID_APPTS_KEY, JSON.stringify([...next]))
        window.dispatchEvent(new CustomEvent(PAID_EVENT))
      } catch {}
      return next
    })
  }, [])

  const unmark = useCallback((apptId: string) => {
    setIds(prev => {
      const next = new Set([...prev])
      next.delete(apptId)
      try {
        localStorage.setItem(PAID_APPTS_KEY, JSON.stringify([...next]))
        window.dispatchEvent(new CustomEvent(PAID_EVENT))
      } catch {}
      return next
    })
  }, [])

  return { ids, markPaid, unmark }
}

export interface CartProduct {
  product_id: string
  name_ar: string
  price: number
  quantity: number
  image_url?: string
  brand?: string
}

const KEY = 'glamour-cart-v1'

export function useCart() {
  const [items, setItems] = useState<CartProduct[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {}
    setReady(true)
  }, [])

  const persist = (next: CartProduct[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
    setItems(next)
  }

  const addItem = useCallback((p: Omit<CartProduct, 'quantity'>, qty = 1) => {
    setItems(prev => {
      const exists = prev.find(i => i.product_id === p.product_id)
      const next = exists
        ? prev.map(i => i.product_id === p.product_id ? { ...i, quantity: i.quantity + qty } : i)
        : [...prev, { ...p, quantity: qty }]
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const setQty = useCallback((product_id: string, qty: number) => {
    setItems(prev => {
      const next = qty <= 0
        ? prev.filter(i => i.product_id !== product_id)
        : prev.map(i => i.product_id === product_id ? { ...i, quantity: qty } : i)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const remove = useCallback((product_id: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.product_id !== product_id)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const clear = useCallback(() => {
    try { localStorage.removeItem(KEY) } catch {}
    setItems([])
  }, [])

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const count = items.reduce((s, i) => s + i.quantity, 0)

  return { items, total, count, ready, addItem, setQty, remove, clear, persist }
}
