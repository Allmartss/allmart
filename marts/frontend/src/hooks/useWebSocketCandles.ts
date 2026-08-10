import { useState, useEffect, useRef, useCallback } from 'react'

export interface Candle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface UseWebSocketCandlesResult {
  candles: Candle[]
  connected: boolean
  lastPrice: number | null
}


export function useWebSocketCandles(pair: string, tf: string): UseWebSocketCandlesResult {
  const [candles, setCandles] = useState<Candle[]>([])
  const [connected, setConnected] = useState(false)
  const [lastPrice, setLastPrice] = useState<number | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pairRef = useRef(pair)
  const tfRef = useRef(tf)
  pairRef.current = pair
  tfRef.current = tf

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    const symbol = encodeURIComponent(pair.replace('/', '_'))
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/marts/ws/prices/${symbol}?tf=${tf}`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
      }

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data)
          if (data.type === 'candles') {
            setCandles(data.candles)
            if (data.candles.length > 0) {
              setLastPrice(data.candles[data.candles.length - 1].close)
            }
          } else if (data.type === 'tick') {
            setCandles(prev => {
              if (prev.length === 0) return prev
              const updated = [...prev]
              const last = { ...updated[updated.length - 1] }
              const p = data.price
              last.close = p
              last.high = Math.max(last.high, p)
              last.low = Math.min(last.low, p)
              updated[updated.length - 1] = last
              return updated
            })
            setLastPrice(data.price)
          }
        } catch {
        }
      }

      ws.onerror = () => {
        setConnected(false)
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        reconnectTimer.current = setTimeout(() => {
          if (pairRef.current === pair && tfRef.current === tf) {
            connect()
          }
        }, 3000)
      }
    } catch {
      setConnected(false)
    }
  }, [pair, tf])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setConnected(false)
    }
  }, [connect])

  return { candles, connected, lastPrice }
}
