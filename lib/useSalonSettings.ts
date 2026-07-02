import { useEffect, useState, useCallback } from 'react'

export interface SalonSettings {
  name: string
  name_en: string
  logo_url: string
  address: string
  city: string
  phone: string
  email?: string
  opening_time: string
  closing_time: string
  theme?: string
  primary_color?: string
}

const defaults: SalonSettings = {
  name: 'صالون جلامور',
  name_en: 'Glamour Salon',
  logo_url: '/logo.png',
  address: 'جدة، حي الروضة',
  city: 'جدة',
  phone: '+966500000000',
  opening_time: '10:00',
  closing_time: '22:00',
  theme: 'gold',
}

export function useSalonSettings() {
  const [settings, setSettings] = useState<SalonSettings>(defaults)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        setSettings(d)
        setLoaded(true)
        if (d.theme) document.documentElement.setAttribute('data-theme', d.theme)
        if (d.primary_color) {
          document.documentElement.style.setProperty('--primary', d.primary_color)
        } else {
          document.documentElement.style.removeProperty('--primary')
        }
      })
      .catch(() => setLoaded(true))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { settings, loaded, refresh }
}
