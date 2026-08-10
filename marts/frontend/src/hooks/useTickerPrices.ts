import { useState, useEffect, useCallback } from 'react'

export interface TickerItem {
  symbol: string
  price: string
  change: string
  up: boolean
  live: boolean
}

const PRICES_URL = '/marts/api/public/prices'

function fmt(n: number) {
  if (n >= 10000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n >= 100)   return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n >= 1)     return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

function fmtChange(n: number) {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

const INITIAL: TickerItem[] = [
  { symbol: 'BTC/USDT',  price: '...', change: '—', up: true,  live: false },
  { symbol: 'ETH/USDT',  price: '...', change: '—', up: true,  live: false },
  { symbol: 'BNB/USDT',  price: '...', change: '—', up: true,  live: false },
  { symbol: 'SOL/USDT',  price: '...', change: '—', up: true,  live: false },
  { symbol: 'XRP/USDT',  price: '...', change: '—', up: true,  live: false },
  { symbol: 'XAU/USD',   price: '$3,290.00', change: '+0.3%', up: true,  live: false },
  { symbol: 'XAG/USD',   price: '$32.80',    change: '+0.5%', up: true,  live: false },
  { symbol: 'OIL/WTI',   price: '$78.40',    change: '-0.2%', up: false, live: false },
  { symbol: 'NVDA',      price: '$131.40',   change: '+2.1%', up: true,  live: false },
  { symbol: 'AAPL',      price: '$211.50',   change: '+0.9%', up: true,  live: false },
  { symbol: 'TSLA',      price: '$248.70',   change: '-1.2%', up: false, live: false },
  { symbol: 'SPY',       price: '$564.20',   change: '+0.5%', up: true,  live: false },
]

export function useTickerPrices(intervalMs = 45000) {
  const [items, setItems] = useState<TickerItem[]>(INITIAL)

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(PRICES_URL)
      if (!res.ok) return
      const data = await res.json()

      const btc = data.bitcoin
      const eth = data.ethereum
      const bnb = data.binancecoin
      const sol = data.solana
      const xrp = data.ripple
      const m   = data.metals ?? {}
      const s   = data.stocks ?? {}

      const next: TickerItem[] = []

      if (btc) next.push({ symbol: 'BTC/USDT',  price: fmt(btc.usd), change: fmtChange(btc.usd_24h_change), up: btc.usd_24h_change >= 0, live: true })
      if (eth) next.push({ symbol: 'ETH/USDT',  price: fmt(eth.usd), change: fmtChange(eth.usd_24h_change), up: eth.usd_24h_change >= 0, live: true })
      if (bnb) next.push({ symbol: 'BNB/USDT',  price: fmt(bnb.usd), change: fmtChange(bnb.usd_24h_change), up: bnb.usd_24h_change >= 0, live: true })
      if (sol) next.push({ symbol: 'SOL/USDT',  price: fmt(sol.usd), change: fmtChange(sol.usd_24h_change), up: sol.usd_24h_change >= 0, live: true })
      if (xrp) next.push({ symbol: 'XRP/USDT',  price: fmt(xrp.usd), change: fmtChange(xrp.usd_24h_change), up: xrp.usd_24h_change >= 0, live: true })

      if (m.gold)     next.push({ symbol: 'XAU/USD', price: fmt(m.gold.usd),     change: fmtChange(m.gold.usd_24h_change),     up: m.gold.usd_24h_change     >= 0, live: true })
      if (m.silver)   next.push({ symbol: 'XAG/USD', price: fmt(m.silver.usd),   change: fmtChange(m.silver.usd_24h_change),   up: m.silver.usd_24h_change   >= 0, live: true })
      if (m.oil_wti)  next.push({ symbol: 'OIL/WTI', price: fmt(m.oil_wti.usd),  change: fmtChange(m.oil_wti.usd_24h_change),  up: m.oil_wti.usd_24h_change  >= 0, live: true })
      if (m.platinum) next.push({ symbol: 'XPT/USD', price: fmt(m.platinum.usd), change: fmtChange(m.platinum.usd_24h_change), up: m.platinum.usd_24h_change >= 0, live: true })

      if (s.NVDA) next.push({ symbol: 'NVDA', price: fmt(s.NVDA.usd), change: fmtChange(s.NVDA.usd_24h_change), up: s.NVDA.usd_24h_change >= 0, live: true })
      if (s.AAPL) next.push({ symbol: 'AAPL', price: fmt(s.AAPL.usd), change: fmtChange(s.AAPL.usd_24h_change), up: s.AAPL.usd_24h_change >= 0, live: true })
      if (s.TSLA) next.push({ symbol: 'TSLA', price: fmt(s.TSLA.usd), change: fmtChange(s.TSLA.usd_24h_change), up: s.TSLA.usd_24h_change >= 0, live: true })
      if (s.SPY)  next.push({ symbol: 'SPY',  price: fmt(s.SPY.usd),  change: fmtChange(s.SPY.usd_24h_change),  up: s.SPY.usd_24h_change  >= 0, live: true })
      if (s.MSFT) next.push({ symbol: 'MSFT', price: fmt(s.MSFT.usd), change: fmtChange(s.MSFT.usd_24h_change), up: s.MSFT.usd_24h_change >= 0, live: true })
      if (s.GOOGL)next.push({ symbol: 'GOOGL',price: fmt(s.GOOGL.usd),change: fmtChange(s.GOOGL.usd_24h_change),up: s.GOOGL.usd_24h_change>= 0, live: true })

      if (next.length > 0) setItems(next)
    } catch {
      // keep previous values on error
    }
  }, [])

  useEffect(() => {
    fetchPrices()
    const id = setInterval(fetchPrices, intervalMs)
    return () => clearInterval(id)
  }, [fetchPrices, intervalMs])

  return items
}

export function useLivePricesMap(intervalMs = 45000) {
  const [map, setMap] = useState<Record<string, { usd: number; change: number }>>({})

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(PRICES_URL)
      if (!res.ok) return
      const data = await res.json()
      const out: Record<string, { usd: number; change: number }> = {}

      const crypto: Record<string, string> = {
        bitcoin: 'BTC/USDT', ethereum: 'ETH/USDT', binancecoin: 'BNB/USDT',
        solana: 'SOL/USDT', ripple: 'XRP/USDT', cardano: 'ADA/USDT',
        dogecoin: 'DOGE/USDT', polkadot: 'DOT/USDT', chainlink: 'LINK/USDT',
        'avalanche-2': 'AVAX/USDT', 'matic-network': 'MATIC/USDT',
        litecoin: 'LTC/USDT', uniswap: 'UNI/USDT', stellar: 'XLM/USDT',
      }
      for (const [id, sym] of Object.entries(crypto)) {
        if (data[id]) out[sym] = { usd: data[id].usd, change: data[id].usd_24h_change }
      }

      const metals = data.metals ?? {}
      const metalMap: Record<string, string> = {
        gold: 'XAU/USD', silver: 'XAG/USD', platinum: 'XPT/USD',
        palladium: 'XPD/USD', copper: 'COPPER', oil_wti: 'OIL/WTI', nat_gas: 'NATGAS',
      }
      for (const [k, sym] of Object.entries(metalMap)) {
        if (metals[k]) out[sym] = { usd: metals[k].usd, change: metals[k].usd_24h_change }
      }

      const stocks = data.stocks ?? {}
      for (const [sym, v] of Object.entries(stocks) as [string, { usd: number; usd_24h_change: number }][]) {
        out[sym] = { usd: v.usd, change: v.usd_24h_change }
      }

      if (Object.keys(out).length > 0) setMap(out)
    } catch { /* keep */ }
  }, [])

  useEffect(() => {
    fetchPrices()
    const id = setInterval(fetchPrices, intervalMs)
    return () => clearInterval(id)
  }, [fetchPrices, intervalMs])

  return { map, refetch: fetchPrices }
}
