import { useState, useEffect, useCallback } from 'react'

export interface CoinPrice {
  usd: number
  usd_24h_change: number
}

export interface LivePrices {
  bitcoin: CoinPrice
  ethereum: CoinPrice
  [key: string]: CoinPrice
}

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'

export function useLivePrices(intervalMs = 60000) {
  const [prices, setPrices] = useState<LivePrices | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchPrices = useCallback(async () => {
    try {
      const res = await window.fetch(COINGECKO_URL)
      if (!res.ok) throw new Error('Bad response')
      const data: LivePrices = await res.json()
      setPrices(data)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrices()
    const id = setInterval(fetchPrices, intervalMs)
    return () => clearInterval(id)
  }, [fetchPrices, intervalMs])

  const btc = prices?.bitcoin
  const eth = prices?.ethereum

  return {
    loading,
    error,
    btcPrice: btc?.usd ?? null,
    btcChange: btc?.usd_24h_change ?? null,
    ethPrice: eth?.usd ?? null,
    ethChange: eth?.usd_24h_change ?? null,
    refetch: fetchPrices,
  }
}
