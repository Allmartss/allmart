import { useState, useEffect, useCallback } from 'react'
import { Search, TrendingUp, TrendingDown, LayoutGrid, LayoutList, RefreshCw } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { useNavigate } from 'react-router-dom'

interface MarketItem {
  symbol: string
  name: string
  price: number
  change: number
  vol: string
  mcap: string
  cat: 'crypto' | 'stocks' | 'metals'
  live: boolean
}

const sparkline = (up: boolean, volatility = 10) =>
  Array.from({ length: 14 }, (_, i) => ({
    v: 50 + (up ? 1 : -1) * i * 2.5 + (Math.random() * volatility - volatility / 2),
  }))

const ASSET_META: Record<string, { name: string; vol: string; mcap: string }> = {
  'BTC/USDT':  { name: 'Bitcoin',        vol: '$28.4B', mcap: '$1.92T' },
  'ETH/USDT':  { name: 'Ethereum',       vol: '$12.1B', mcap: '$384B'  },
  'BNB/USDT':  { name: 'BNB',            vol: '$1.8B',  mcap: '$91B'   },
  'SOL/USDT':  { name: 'Solana',         vol: '$4.2B',  mcap: '$78B'   },
  'XRP/USDT':  { name: 'XRP',            vol: '$3.1B',  mcap: '$29B'   },
  'ADA/USDT':  { name: 'Cardano',        vol: '$0.8B',  mcap: '$17B'   },
  'DOGE/USDT': { name: 'Dogecoin',       vol: '$1.2B',  mcap: '$24B'   },
  'DOT/USDT':  { name: 'Polkadot',       vol: '$0.5B',  mcap: '$10B'   },
  'LINK/USDT': { name: 'Chainlink',      vol: '$0.6B',  mcap: '$9B'    },
  'AVAX/USDT': { name: 'Avalanche',      vol: '$0.9B',  mcap: '$16B'   },
  'MATIC/USDT':{ name: 'Polygon',        vol: '$0.4B',  mcap: '$8B'    },
  'LTC/USDT':  { name: 'Litecoin',       vol: '$0.5B',  mcap: '$7B'    },
  'UNI/USDT':  { name: 'Uniswap',        vol: '$0.3B',  mcap: '$5B'    },
  'XLM/USDT':  { name: 'Stellar',        vol: '$0.2B',  mcap: '$3B'    },
  'XAU/USD':   { name: 'Gold',           vol: '$182B',  mcap: '$15.7T' },
  'XAG/USD':   { name: 'Silver',         vol: '$8.1B',  mcap: '$1.74T' },
  'XPT/USD':   { name: 'Platinum',       vol: '$0.9B',  mcap: '$220B'  },
  'XPD/USD':   { name: 'Palladium',      vol: '$0.4B',  mcap: '$48B'   },
  'COPPER':    { name: 'Copper',         vol: '$3.2B',  mcap: '—'      },
  'OIL/WTI':   { name: 'Crude Oil WTI',  vol: '$42B',   mcap: '—'      },
  'NATGAS':    { name: 'Natural Gas',    vol: '$6.8B',  mcap: '—'      },
  'AAPL':  { name: 'Apple Inc.',        vol: '$4.1B',  mcap: '$3.18T' },
  'TSLA':  { name: 'Tesla Inc.',        vol: '$12.8B', mcap: '$794B'  },
  'NVDA':  { name: 'NVIDIA Corp.',      vol: '$18.5B', mcap: '$3.21T' },
  'SPY':   { name: 'S&P 500 ETF',       vol: '$22.3B', mcap: '—'      },
  'MSFT':  { name: 'Microsoft Corp.',   vol: '$5.8B',  mcap: '$3.22T' },
  'GOOGL': { name: 'Alphabet Inc.',     vol: '$4.9B',  mcap: '$2.18T' },
  'AMZN':  { name: 'Amazon.com Inc.',   vol: '$6.2B',  mcap: '$2.12T' },
  'META':  { name: 'Meta Platforms',    vol: '$7.1B',  mcap: '$1.55T' },
  'BRK':   { name: 'Berkshire Hathaway',vol: '$0.9B',  mcap: '$1.07T' },
  'JPM':   { name: 'JPMorgan Chase',    vol: '$3.4B',  mcap: '$743B'  },
  'V':     { name: 'Visa Inc.',         vol: '$2.1B',  mcap: '$596B'  },
  'JNJ':   { name: 'Johnson & Johnson', vol: '$1.8B',  mcap: '$366B'  },
  'WMT':   { name: 'Walmart Inc.',      vol: '$1.5B',  mcap: '$769B'  },
  'XOM':   { name: 'ExxonMobil Corp.',  vol: '$2.8B',  mcap: '$494B'  },
  'GLD':   { name: 'SPDR Gold Shares',  vol: '$1.4B',  mcap: '—'      },
}

type Tab = 'all' | 'crypto' | 'stocks' | 'metals' | 'heatmap'

// Relative market-cap weights used to size heatmap blocks
const HEAT_WEIGHTS: Record<string, number> = {
  'BTC/USDT': 4.5, 'ETH/USDT': 3.0, 'NVDA': 2.6, 'MSFT': 2.5,
  'AAPL': 2.5, 'XAU/USD': 2.2, 'AMZN': 2.0, 'GOOGL': 2.0,
  'META': 1.8, 'SPY': 1.8, 'TSLA': 1.6, 'SOL/USDT': 1.4,
  'BNB/USDT': 1.2, 'XRP/USDT': 1.1, 'OIL/WTI': 1.1, 'XAG/USD': 1.0,
  'JPM': 0.9, 'WMT': 0.8, 'XOM': 0.8, 'BRK': 0.8,
  'DOGE/USDT': 0.7, 'V': 0.7, 'GLD': 0.7, 'AVAX/USDT': 0.6,
  'LINK/USDT': 0.5, 'MATIC/USDT': 0.5, 'JNJ': 0.5, 'DOT/USDT': 0.5,
  'ADA/USDT': 0.5, 'LTC/USDT': 0.4, 'XPT/USD': 0.4, 'NATGAS': 0.4,
  'COPPER': 0.4, 'UNI/USDT': 0.3, 'XLM/USDT': 0.3, 'XPD/USD': 0.3,
}

function CryptoHeatMap({ markets }: { markets: MarketItem[] }) {
  if (markets.length === 0) {
    return (
      <div className="flex items-center justify-center bg-[#161a1e] border border-[#2b3139] rounded-xl" style={{ minHeight: 400 }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#f0b90b] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#848e9c]">Loading market data…</p>
        </div>
      </div>
    )
  }

  const sorted = [...markets].sort((a, b) => (HEAT_WEIGHTS[b.symbol] || 0.3) - (HEAT_WEIGHTS[a.symbol] || 0.3))

  const getStyle = (change: number, weight: number) => {
    const abs   = Math.abs(change)
    const alpha = Math.min(0.15 + (abs / 6) * 0.65, 0.80)
    const bg    = change >= 0
      ? `rgba(14, 203, 129, ${alpha})`
      : `rgba(246, 70, 93, ${alpha})`
    const border = change >= 0
      ? `rgba(14, 203, 129, ${alpha * 0.5})`
      : `rgba(246, 70, 93, ${alpha * 0.5})`
    const minH = weight >= 2.0 ? 110 : weight >= 1.0 ? 80 : 64
    const basis = Math.max(weight * 90, 80)
    return { backgroundColor: bg, borderColor: border, minHeight: minH, flexGrow: weight, flexBasis: basis }
  }

  const fmtPrice = (p: number) => {
    if (p >= 1000) return '$' + (p / 1000).toFixed(1) + 'K'
    if (p >= 1)    return '$' + p.toFixed(2)
    return '$' + p.toFixed(4)
  }

  const fmtSym = (sym: string) => sym.split('/')[0]

  return (
    <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-[#848e9c] uppercase tracking-widest">Market Heat Map</h3>
        <div className="flex items-center gap-3 text-[10px] text-[#848e9c]">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#f6465d]/60" />Bearish</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#0ecb81]/60" />Bullish</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map(m => {
          const w     = HEAT_WEIGHTS[m.symbol] || 0.3
          const style = getStyle(m.change, w)
          const isLarge = w >= 1.5
          const isMid   = w >= 0.7
          return (
            <div
              key={m.symbol}
              style={style}
              className="rounded-xl border flex flex-col justify-between p-2 cursor-pointer hover:brightness-110 transition-all duration-150 overflow-hidden"
            >
              <div className={`font-bold text-white truncate ${isLarge ? 'text-sm' : 'text-[11px]'}`}>
                {fmtSym(m.symbol)}
              </div>
              {isMid && (
                <div className={`text-white/70 truncate ${isLarge ? 'text-[11px]' : 'text-[9px]'}`}>
                  {m.name.split(' ')[0]}
                </div>
              )}
              <div>
                {isLarge && (
                  <div className="text-white/80 font-mono text-[11px] mb-0.5">{fmtPrice(m.price)}</div>
                )}
                <div className={`font-bold ${isLarge ? 'text-sm' : isMid ? 'text-xs' : 'text-[10px]'} ${m.change >= 0 ? 'text-white' : 'text-white'}`}>
                  {m.change >= 0 ? '+' : ''}{m.change.toFixed(2)}%
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MarketsPage() {
  const navigate = useNavigate()
  const [tab, setTab]       = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [view, setView]     = useState<'table' | 'grid'>('table')
  const [markets, setMarkets] = useState<MarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch('/marts/api/public/prices')
      if (!res.ok) return
      const data = await res.json()
      const items: MarketItem[] = []

      const cryptoMap: Record<string, string> = {
        bitcoin: 'BTC/USDT', ethereum: 'ETH/USDT', binancecoin: 'BNB/USDT',
        solana: 'SOL/USDT', ripple: 'XRP/USDT', cardano: 'ADA/USDT',
        dogecoin: 'DOGE/USDT', polkadot: 'DOT/USDT', chainlink: 'LINK/USDT',
        'avalanche-2': 'AVAX/USDT', 'matic-network': 'MATIC/USDT',
        litecoin: 'LTC/USDT', uniswap: 'UNI/USDT', stellar: 'XLM/USDT',
      }
      for (const [id, sym] of Object.entries(cryptoMap)) {
        if (data[id]) {
          const meta = ASSET_META[sym] ?? { name: sym, vol: '—', mcap: '—' }
          items.push({ symbol: sym, name: meta.name, price: data[id].usd, change: data[id].usd_24h_change, vol: meta.vol, mcap: meta.mcap, cat: 'crypto', live: true })
        }
      }

      const m = data.metals ?? {}
      const metalMap: Record<string, string> = {
        gold: 'XAU/USD', silver: 'XAG/USD', platinum: 'XPT/USD',
        palladium: 'XPD/USD', copper: 'COPPER', oil_wti: 'OIL/WTI', nat_gas: 'NATGAS',
      }
      for (const [k, sym] of Object.entries(metalMap)) {
        if (m[k]) {
          const meta = ASSET_META[sym] ?? { name: sym, vol: '—', mcap: '—' }
          items.push({ symbol: sym, name: meta.name, price: m[k].usd, change: m[k].usd_24h_change, vol: meta.vol, mcap: meta.mcap, cat: 'metals', live: true })
        }
      }

      const s = data.stocks ?? {}
      for (const [sym, v] of Object.entries(s) as [string, { usd: number; usd_24h_change: number }][]) {
        const meta = ASSET_META[sym] ?? { name: sym, vol: '—', mcap: '—' }
        items.push({ symbol: sym, name: meta.name, price: v.usd, change: v.usd_24h_change, vol: meta.vol, mcap: meta.mcap, cat: 'stocks', live: true })
      }

      if (items.length > 0) {
        setMarkets(items)
        setLastUpdate(new Date())
      }
    } catch { /* keep */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchMarkets()
    const id = setInterval(fetchMarkets, 30000)
    return () => clearInterval(id)
  }, [fetchMarkets])

  const filtered = markets.filter(m => {
    if (tab !== 'all' && tab !== 'heatmap' && m.cat !== tab) return false
    return (
      m.symbol.toLowerCase().includes(search.toLowerCase()) ||
      m.name.toLowerCase().includes(search.toLowerCase())
    )
  })

  const fmtPrice = (p: number) => {
    if (p >= 10000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 })
    if (p >= 100)   return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    if (p >= 1)     return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
  }

  const catLabel = (cat: string) => {
    if (cat === 'metals') return 'M'
    if (cat === 'stocks') return 'S'
    return cat[0].toUpperCase()
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all',     label: 'All Markets' },
    { key: 'crypto',  label: 'Crypto'      },
    { key: 'metals',  label: 'Metals'      },
    { key: 'stocks',  label: 'Stocks'      },
    { key: 'heatmap', label: 'Heat Map'    },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#eaecef]">Markets</h1>
          {lastUpdate && (
            <p className="text-[10px] text-[#848e9c] mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] inline-block animate-pulse" />
              Live · Updated {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchMarkets} className="p-2 rounded-lg bg-[#161a1e] border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] transition">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setView('table')} className={`p-2 rounded-lg transition ${view === 'table' ? 'bg-[#f0b90b] text-black' : 'bg-[#161a1e] border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]'}`}>
            <LayoutList size={14} />
          </button>
          <button onClick={() => setView('grid')} className={`p-2 rounded-lg transition ${view === 'grid' ? 'bg-[#f0b90b] text-black' : 'bg-[#161a1e] border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]'}`}>
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {/* Tab bar + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-[#161a1e] border border-[#2b3139] rounded-xl p-1 overflow-x-auto flex-shrink-0">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`text-xs px-3.5 py-1.5 rounded-lg whitespace-nowrap font-medium transition ${tab === t.key ? 'bg-[#f0b90b] text-black font-bold' : 'text-[#848e9c] hover:text-[#eaecef]'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#848e9c]" />
          <input type="text" placeholder="Search markets…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#161a1e] border border-[#2b3139] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition" />
        </div>
      </div>

      {/* Heat Map tab */}
      {tab === 'heatmap' && <CryptoHeatMap markets={markets} />}

      {/* Grid view */}
      {tab !== 'heatmap' && view === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {loading && filtered.length === 0
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-4 animate-pulse h-32" />
              ))
            : filtered.map(m => (
              <div key={m.symbol} className="bg-[#161a1e] border border-[#2b3139] hover:border-[#f0b90b]/30 rounded-2xl p-4 transition-all cursor-pointer" onClick={() => navigate('/app/trade')}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-full bg-[#f0b90b]/10 flex items-center justify-center text-xs font-bold text-[#f0b90b]">
                    {catLabel(m.cat)}
                  </div>
                  <span className={`text-xs font-bold flex items-center gap-0.5 ${m.change >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                    {m.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {m.change >= 0 ? '+' : ''}{m.change.toFixed(2)}%
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#eaecef]">{m.symbol}</p>
                <p className="text-[10px] text-[#848e9c] mb-2">{m.name}</p>
                <p className="text-sm font-bold font-mono text-[#eaecef]">{fmtPrice(m.price)}</p>
                {m.live && <div className="mt-2 h-9">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparkline(m.change >= 0)}>
                      <Line type="monotone" dataKey="v" stroke={m.change >= 0 ? '#0ecb81' : '#f6465d'} strokeWidth={1.5} dot={false} />
                      <Tooltip contentStyle={{ display: 'none' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>}
              </div>
            ))}
        </div>
      )}

      {/* Table view */}
      {tab !== 'heatmap' && view === 'table' && (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
          {/* Mobile card list */}
          <div className="sm:hidden divide-y divide-[#2b3139]/60">
            {loading && filtered.length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-[#2b3139]" />
                    <div className="flex-1"><div className="h-3 bg-[#2b3139] rounded w-20 mb-1" /><div className="h-2.5 bg-[#2b3139] rounded w-14" /></div>
                    <div className="h-4 bg-[#2b3139] rounded w-16" />
                  </div>
                ))
              : filtered.map((m, i) => (
                <div key={m.symbol} className="flex items-center justify-between px-4 py-3.5 hover:bg-[#1e2329] transition cursor-pointer" onClick={() => navigate('/app/trade')}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#4a5568] w-4 text-center">{i + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-[#f0b90b]/10 flex items-center justify-center text-xs font-bold text-[#f0b90b] flex-shrink-0">
                      {catLabel(m.cat)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#eaecef]">{m.symbol}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] text-[#848e9c]">{m.name}</p>
                        {m.live && <span className="w-1 h-1 rounded-full bg-[#0ecb81] inline-block" />}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono text-[#eaecef]">{fmtPrice(m.price)}</p>
                    <span className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${m.change >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                      {m.change >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                      {m.change >= 0 ? '+' : ''}{m.change.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-[#848e9c] text-xs border-b border-[#2b3139] bg-[#0b0e11]/40">
                  <th className="text-left px-5 py-3 font-medium">#</th>
                  <th className="text-left px-5 py-3 font-medium">Asset</th>
                  <th className="text-right px-5 py-3 font-medium">Price</th>
                  <th className="text-right px-5 py-3 font-medium">24h Change</th>
                  <th className="text-right px-5 py-3 font-medium hidden md:table-cell">Volume</th>
                  <th className="text-right px-5 py-3 font-medium hidden lg:table-cell">Market Cap</th>
                  <th className="text-right px-5 py-3 font-medium hidden xl:table-cell">7D Chart</th>
                  <th className="text-right px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && filtered.length === 0
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-[#2b3139]/50 animate-pulse">
                        <td className="px-5 py-4"><div className="h-3 bg-[#2b3139] rounded w-4" /></td>
                        <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-[#2b3139]" /><div><div className="h-3 bg-[#2b3139] rounded w-20 mb-1" /><div className="h-2.5 bg-[#2b3139] rounded w-14" /></div></div></td>
                        <td className="px-5 py-4"><div className="h-3 bg-[#2b3139] rounded w-20 ml-auto" /></td>
                        <td className="px-5 py-4"><div className="h-5 bg-[#2b3139] rounded w-16 ml-auto" /></td>
                        <td className="px-5 py-4 hidden md:table-cell"><div className="h-3 bg-[#2b3139] rounded w-14 ml-auto" /></td>
                        <td className="px-5 py-4 hidden lg:table-cell"><div className="h-3 bg-[#2b3139] rounded w-12 ml-auto" /></td>
                        <td className="px-5 py-4 hidden xl:table-cell" />
                        <td className="px-5 py-4" />
                      </tr>
                    ))
                  : filtered.map((m, i) => (
                    <tr key={m.symbol} className="border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition cursor-pointer" onClick={() => navigate('/app/trade')}>
                      <td className="px-5 py-4 text-[#848e9c] text-xs">{i + 1}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#f0b90b]/10 flex items-center justify-center text-xs font-bold text-[#f0b90b] flex-shrink-0">
                            {catLabel(m.cat)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-[#eaecef] text-sm">{m.symbol}</p>
                              {m.live && <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] animate-pulse" />}
                            </div>
                            <p className="text-[10px] text-[#848e9c]">{m.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-sm text-[#eaecef] font-medium">{fmtPrice(m.price)}</td>
                      <td className="px-5 py-4 text-right">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${m.change >= 0 ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>
                          {m.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {m.change >= 0 ? '+' : ''}{m.change.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-[#848e9c] text-xs hidden md:table-cell">{m.vol}</td>
                      <td className="px-5 py-4 text-right text-[#848e9c] text-xs hidden lg:table-cell">{m.mcap}</td>
                      <td className="px-5 py-4 hidden xl:table-cell">
                        <div className="flex justify-end">
                          <ResponsiveContainer width={80} height={36}>
                            <LineChart data={sparkline(m.change >= 0)}>
                              <Line type="monotone" dataKey="v" stroke={m.change >= 0 ? '#0ecb81' : '#f6465d'} strokeWidth={1.5} dot={false} />
                              <Tooltip contentStyle={{ display: 'none' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={e => { e.stopPropagation(); navigate('/app/trade') }}
                          className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-[#f0b90b]/10 text-[#f0b90b] hover:bg-[#f0b90b]/20 transition border border-[#f0b90b]/20">
                          Trade
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {tab !== 'heatmap' && !loading && filtered.length === 0 && (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl py-14 text-center">
          <Search size={24} className="text-[#2b3139] mx-auto mb-3" />
          <p className="text-sm text-[#848e9c]">No markets match "{search}"</p>
        </div>
      )}
    </div>
  )
}
