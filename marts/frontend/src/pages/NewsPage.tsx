import { useEffect, useState, useCallback } from 'react'
import { Newspaper, RefreshCw, ExternalLink, TrendingUp, Globe, BarChart2, Package, Calendar, Zap } from 'lucide-react'

interface NewsItem {
  id?: number
  title: string
  summary?: string
  url?: string
  source?: string
  published_at?: string
  category?: string
  ticker?: string
  sentiment?: string
  impact_score?: number
}

interface EconomicEvent {
  time: string
  currency: string
  event: string
  impact: 'High' | 'Medium' | 'Low'
  actual?: string
  forecast?: string
  previous?: string
}

const TABS = [
  { id: 'top',      label: 'Top Stories', icon: Newspaper },
  { id: 'crypto',   label: 'Crypto',      icon: Zap },
  { id: 'forex',    label: 'FOREX',       icon: Globe },
  { id: 'indices',  label: 'Indices',     icon: BarChart2 },
  { id: 'etf',      label: 'ETF',         icon: Package },
  { id: 'lastsite', label: 'Last Site',   icon: TrendingUp },
  { id: 'economic', label: 'Economic Events', icon: Calendar },
]

const MOCK_ECONOMIC: EconomicEvent[] = [
  { time: '08:30', currency: 'USD', event: 'Core CPI m/m', impact: 'High', actual: '0.3%', forecast: '0.3%', previous: '0.4%' },
  { time: '10:00', currency: 'USD', event: 'Fed Chair Powell Speaks', impact: 'High', forecast: 'Hawkish tone expected', previous: '' },
  { time: '08:30', currency: 'CAD', event: 'Employment Change', impact: 'Medium', forecast: '25.0K', previous: '32.3K' },
  { time: '09:45', currency: 'EUR', event: 'ECB President Lagarde Speaks', impact: 'High', forecast: '', previous: '' },
  { time: '10:30', currency: 'USD', event: 'Crude Oil Inventories', impact: 'Medium', forecast: '-1.1M', previous: '-2.0M' },
  { time: '14:00', currency: 'GBP', event: 'MPC Member Speaks', impact: 'Low', forecast: '', previous: '' },
]

function impactColor(impact: string) {
  if (impact === 'High') return 'text-[#f6465d] bg-[#f6465d]/10'
  if (impact === 'Medium') return 'text-[#f0b90b] bg-[#f0b90b]/10'
  return 'text-[#848e9c] bg-[#2b3139]'
}

function sentimentColor(s?: string) {
  if (s === 'bullish' || s === 'positive') return 'text-[#0ecb81]'
  if (s === 'bearish' || s === 'negative') return 'text-[#f6465d]'
  return 'text-[#848e9c]'
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NewsPage() {
  const [tab, setTab] = useState('top')
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchNews = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/marts/api/public/news')
      const data = await res.json()
      if (Array.isArray(data)) setNews(data)
      else if (Array.isArray(data.news)) setNews(data.news)
      else setNews([])
    } catch {
      setError('Could not load news')
      setNews([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNews()
    const id = setInterval(fetchNews, 120_000)
    return () => clearInterval(id)
  }, [fetchNews])

  const filtered = (() => {
    if (tab === 'top') return news.slice(0, 20)
    if (tab === 'crypto') return news.filter(n =>
      !n.category || n.category?.toLowerCase().includes('crypto') ||
      ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE'].some(t => (n.ticker || '').includes(t) || (n.title || '').includes(t))
    )
    if (tab === 'forex') return news.filter(n =>
      n.category?.toLowerCase().includes('forex') ||
      ['EUR','GBP','JPY','USD','AUD','CAD','CHF'].some(t => (n.title || '').includes(t))
    )
    if (tab === 'indices') return news.filter(n =>
      n.category?.toLowerCase().includes('index') || n.category?.toLowerCase().includes('indices') ||
      ['S&P','Nasdaq','Dow','FTSE','DAX','Nikkei'].some(t => (n.title || '').includes(t))
    )
    if (tab === 'etf') return news.filter(n =>
      n.category?.toLowerCase().includes('etf') ||
      ['ETF','SPY','QQQ','IWM','GLD'].some(t => (n.title || '').toUpperCase().includes(t))
    )
    if (tab === 'lastsite') return news.slice(-20).reverse()
    return news
  })()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#eaecef]">Market News</h1>
        <button onClick={fetchNews} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-[#848e9c] hover:text-[#eaecef] transition">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition flex-shrink-0 ${tab === t.id ? 'bg-[#f0b90b] text-black' : 'bg-[#161a1e] text-[#848e9c] hover:text-[#eaecef] border border-[#2b3139]'}`}>
              <Icon size={11} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Economic Events tab */}
      {tab === 'economic' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-[#848e9c]">
            <Calendar size={12} className="text-[#f0b90b]" />
            <span>Today's Economic Events — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-[#2b3139] text-xs text-[#848e9c]">
                    <th className="px-4 py-3 text-left font-medium">Time</th>
                    <th className="px-4 py-3 text-left font-medium">Currency</th>
                    <th className="px-4 py-3 text-left font-medium">Event</th>
                    <th className="px-4 py-3 text-left font-medium">Impact</th>
                    <th className="px-4 py-3 text-right font-medium">Actual</th>
                    <th className="px-4 py-3 text-right font-medium">Forecast</th>
                    <th className="px-4 py-3 text-right font-medium">Previous</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b3139]/50">
                  {MOCK_ECONOMIC.map((ev, i) => (
                    <tr key={i} className="hover:bg-[#1e2329] transition">
                      <td className="px-4 py-3 text-xs font-mono text-[#848e9c]">{ev.time}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-[#f0b90b] bg-[#f0b90b]/10 px-2 py-0.5 rounded">{ev.currency}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#eaecef]">{ev.event}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${impactColor(ev.impact)}`}>{ev.impact}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-[#0ecb81]">{ev.actual || '—'}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-[#848e9c]">{ev.forecast || '—'}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-[#848e9c]">{ev.previous || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[10px] text-[#4a5568] text-center">Economic calendar data is indicative. Always verify with official sources.</p>
        </div>
      )}

      {/* News grid */}
      {tab !== 'economic' && (
        <>
          {loading && news.length === 0 && (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#f0b90b] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <div className="text-center py-8 text-[#848e9c] text-sm">{error}</div>
          )}
          {!loading && filtered.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Newspaper size={32} className="text-[#2b3139]" />
              <p className="text-sm text-[#848e9c]">No news in this category yet</p>
              <p className="text-xs text-[#4a5568]">News is ingested every 2 minutes</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((item, i) => (
              <div key={item.id ?? i}
                className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 hover:border-[#f0b90b]/30 transition group">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.ticker && (
                      <span className="text-[10px] font-bold text-[#f0b90b] bg-[#f0b90b]/10 px-2 py-0.5 rounded">{item.ticker}</span>
                    )}
                    {item.category && (
                      <span className="text-[10px] text-[#848e9c] bg-[#2b3139] px-2 py-0.5 rounded capitalize">{item.category}</span>
                    )}
                    {item.sentiment && (
                      <span className={`text-[10px] font-semibold capitalize ${sentimentColor(item.sentiment)}`}>{item.sentiment}</span>
                    )}
                    {item.impact_score !== undefined && item.impact_score > 6 && (
                      <span className="text-[10px] font-bold text-[#f6465d] bg-[#f6465d]/10 px-2 py-0.5 rounded">High Impact</span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#4a5568] whitespace-nowrap flex-shrink-0">{timeAgo(item.published_at)}</span>
                </div>
                <h3 className="text-sm font-semibold text-[#eaecef] leading-snug mb-1.5 line-clamp-2 group-hover:text-[#f0b90b] transition">{item.title}</h3>
                {item.summary && (
                  <p className="text-xs text-[#848e9c] leading-relaxed line-clamp-2 mb-2">{item.summary}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  {item.source && (
                    <span className="text-[10px] text-[#4a5568]">{item.source}</span>
                  )}
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-[#f0b90b] hover:underline ml-auto">
                      Read more <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
