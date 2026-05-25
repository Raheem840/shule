import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

const STORAGE_KEY = 'shule_low_bandwidth'

type BandwidthCtx = {
  isLowBandwidth: boolean
  toggleBandwidth: () => void
}

const BandwidthContext = createContext<BandwidthCtx>({
  isLowBandwidth: false,
  toggleBandwidth: () => {},
})

export function BandwidthProvider({ children }: { children: ReactNode }) {
  const [isLowBandwidth, setIsLowBandwidth] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  useEffect(() => {
    if (isLowBandwidth) {
      document.documentElement.setAttribute('data-low-bandwidth', 'true')
    } else {
      document.documentElement.removeAttribute('data-low-bandwidth')
    }
  }, [isLowBandwidth])

  function toggleBandwidth() {
    setIsLowBandwidth(prev => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }

  return (
    <BandwidthContext.Provider value={{ isLowBandwidth, toggleBandwidth }}>
      {children}
    </BandwidthContext.Provider>
  )
}

export const useBandwidth = () => useContext(BandwidthContext)
