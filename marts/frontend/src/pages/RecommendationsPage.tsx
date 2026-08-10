import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Zap, RefreshCw, ArrowRight,
  Target, ShieldAlert, Clock, BarChart2, Activity, Search,
  Minus, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { getEvents } from '../lib/api';

interface Rec {
  symbol: string;
  name: string;
  cat: 'crypto' | 'stocks' | 'metals';
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entry: number;
  target: number;
  stopLoss: number;
  timeframe: string;
  risk: 'Low' | 'Medium' | 'High';
  reason: string;
  technicals: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  change24h: number;
}

interface LivePrice {
  usd: number;
  usd_24h_change: number;
}

interface PricesData {
  metals?: Record<string, LivePrice>;
  stocks?: Record<string, LivePrice>;
  [key: string]: LivePrice | Record<string, LivePrice> | undefined;
}

const BASE_RECS: Rec[] = [
  // ── Crypto ──
  {
    symbol: 'BTC/USDT', name: 'Bitcoin', cat: 'crypto', signal: 'BUY', confidence: 82,
    entry: 97200, target: 112000, stopLoss: 90000, timeframe: '1–2 weeks',
    risk: 'Medium', sentiment: 'Bullish',
    reason: 'Bitcoin broke above the $95K resistance zone with strong volume. Institutional ETF inflows hit a 3-month high. On-chain data shows long-term holders accumulating.',
    technicals: 'RSI 58 · MACD bullish crossover · Above 20/50 EMA · Volume +42%', change24h: 2.4,
  },
  {
    symbol: 'ETH/USDT', name: 'Ethereum', cat: 'crypto', signal: 'BUY', confidence: 74,
    entry: 3200, target: 3900, stopLoss: 2900, timeframe: '1–3 weeks',
    risk: 'Medium', sentiment: 'Bullish',
    reason: 'Ethereum network activity is rising sharply. Layer-2 ecosystem growth driving fee burn. Staking yield remains attractive vs. risk-free rate.',
    technicals: 'RSI 54 · Ascending triangle breakout · ETH/BTC ratio recovering · OI rising', change24h: 1.8,
  },
  {
    symbol: 'SOL/USDT', name: 'Solana', cat: 'crypto', signal: 'BUY', confidence: 71,
    entry: 170, target: 220, stopLoss: 148, timeframe: '2–4 weeks',
    risk: 'Medium', sentiment: 'Bullish',
    reason: 'Solana DEX volume is outpacing Ethereum. Strong developer activity and growing memecoin ecosystem driving demand. DeFi TVL up 28% in 30 days.',
    technicals: 'RSI 61 · Cup & handle pattern · Volume surge · Funding rate neutral', change24h: 3.2,
  },
  {
    symbol: 'XRP/USDT', name: 'XRP', cat: 'crypto', signal: 'HOLD', confidence: 58,
    entry: 0.52, target: 0.70, stopLoss: 0.44, timeframe: '2–6 weeks',
    risk: 'High', sentiment: 'Neutral',
    reason: 'XRP is range-bound awaiting resolution of regulatory clarity. Ripple ecosystem growing but market is in a wait-and-see mode. Hold if already in position.',
    technicals: 'RSI 49 · Sideways consolidation · Below 50 EMA · Low volume', change24h: 1.1,
  },
  {
    symbol: 'BNB/USDT', name: 'BNB', cat: 'crypto', signal: 'HOLD', confidence: 55,
    entry: 628, target: 720, stopLoss: 580, timeframe: '1–3 weeks',
    risk: 'Medium', sentiment: 'Neutral',
    reason: 'BNB is consolidating in a healthy range. BSC ecosystem remains active but competition from other L1s is increasing. No strong catalyst expected short-term.',
    technicals: 'RSI 52 · Range consolidation · Flat 50 EMA · Volume declining', change24h: 0.9,
  },
  {
    symbol: 'DOGE/USDT', name: 'Dogecoin', cat: 'crypto', signal: 'SELL', confidence: 65,
    entry: 0.165, target: 0.12, stopLoss: 0.185, timeframe: '1–2 weeks',
    risk: 'High', sentiment: 'Bearish',
    reason: 'DOGE showing bearish divergence after a failed breakout attempt. No fundamental catalyst. Meme cycle exhaustion. Risk/reward unfavorable at current levels.',
    technicals: 'RSI 68 overbought · Bearish divergence · Rejected at resistance · Funding rate high', change24h: -0.5,
  },
  {
    symbol: 'AVAX/USDT', name: 'Avalanche', cat: 'crypto', signal: 'BUY', confidence: 67,
    entry: 38.5, target: 52, stopLoss: 33, timeframe: '2–3 weeks',
    risk: 'Medium', sentiment: 'Bullish',
    reason: 'AVAX subnet ecosystem gaining traction. Gaming and enterprise blockchain adoption accelerating. Oversold vs. BTC ratio with bullish divergence forming.',
    technicals: 'RSI 47 · Bullish divergence · Bouncing off 200 EMA · TVL growing', change24h: 2.8,
  },
  {
    symbol: 'LINK/USDT', name: 'Chainlink', cat: 'crypto', signal: 'BUY', confidence: 70,
    entry: 14.8, target: 20, stopLoss: 12.5, timeframe: '2–4 weeks',
    risk: 'Medium', sentiment: 'Bullish',
    reason: 'Chainlink CCIP adoption by major banks and DeFi protocols driving real utility. Staking v0.2 increasing token lock-up. RWA tokenization tailwind.',
    technicals: 'RSI 55 · Breakout from wedge · Above key support · Accumulation visible', change24h: 2.1,
  },
  // ── Stocks ──
  {
    symbol: 'NVDA', name: 'NVIDIA Corp.', cat: 'stocks', signal: 'BUY', confidence: 85,
    entry: 131.4, target: 165, stopLoss: 118, timeframe: '3–6 weeks',
    risk: 'Medium', sentiment: 'Bullish',
    reason: 'NVIDIA data center revenue guidance raised again. Blackwell GPU demand exceeding supply. AI infrastructure buildout is a multi-year secular trend. Forward P/E justified by growth.',
    technicals: 'RSI 60 · Bullish flag · Above all key MAs · Institutional buying visible', change24h: 2.1,
  },
  {
    symbol: 'AAPL', name: 'Apple Inc.', cat: 'stocks', signal: 'HOLD', confidence: 60,
    entry: 211.5, target: 235, stopLoss: 195, timeframe: '4–8 weeks',
    risk: 'Low', sentiment: 'Neutral',
    reason: 'Apple is fairly valued with steady buybacks. iPhone upgrade cycle slower than expected. AI integration (Apple Intelligence) is a potential catalyst but not priced in yet. Hold and monitor.',
    technicals: 'RSI 53 · Sideways trend · Near 50 EMA · Earnings approaching', change24h: 0.9,
  },
  {
    symbol: 'TSLA', name: 'Tesla Inc.', cat: 'stocks', signal: 'SELL', confidence: 62,
    entry: 248.7, target: 195, stopLoss: 270, timeframe: '2–4 weeks',
    risk: 'High', sentiment: 'Bearish',
    reason: 'Tesla delivery numbers missed estimates. Margin compression from price cuts. Musk distraction risk elevated. EV market share declining in key markets. Valuation remains stretched for a car company.',
    technicals: 'RSI 64 · Bearish engulfing candle · Below 50-day MA · Distribution pattern', change24h: -1.2,
  },
  {
    symbol: 'MSFT', name: 'Microsoft Corp.', cat: 'stocks', signal: 'BUY', confidence: 78,
    entry: 432.9, target: 490, stopLoss: 405, timeframe: '4–6 weeks',
    risk: 'Low', sentiment: 'Bullish',
    reason: 'Azure cloud growth reaccelerating driven by AI workloads. Copilot monetization showing early traction. Strong free cash flow generation. Enterprise AI leader.',
    technicals: 'RSI 57 · Ascending channel · Above 20/50 EMA · Steady accumulation', change24h: 1.0,
  },
  {
    symbol: 'GOOGL', name: 'Alphabet Inc.', cat: 'stocks', signal: 'BUY', confidence: 73,
    entry: 174.5, target: 205, stopLoss: 158, timeframe: '3–5 weeks',
    risk: 'Low', sentiment: 'Bullish',
    reason: 'Google AI (Gemini) integration into Search and Cloud is driving engagement. YouTube Premium growth strong. Valuation attractive relative to peers at 20x forward earnings.',
    technicals: 'RSI 55 · Cup formation · Strong support at $170 · Insider buying', change24h: 1.3,
  },
  {
    symbol: 'META', name: 'Meta Platforms', cat: 'stocks', signal: 'BUY', confidence: 76,
    entry: 608.3, target: 700, stopLoss: 560, timeframe: '3–5 weeks',
    risk: 'Medium', sentiment: 'Bullish',
    reason: 'Meta AI integration driving daily active user growth. Ad revenue recovery accelerating. Reality Labs losses shrinking. Llama models gaining enterprise adoption.',
    technicals: 'RSI 59 · Breakout continuation · All-time high zone · Volume confirming', change24h: 1.8,
  },
  // ── Metals ──
  {
    symbol: 'XAU/USD', name: 'Gold', cat: 'metals', signal: 'BUY', confidence: 80,
    entry: 3290, target: 3600, stopLoss: 3150, timeframe: '4–8 weeks',
    risk: 'Low', sentiment: 'Bullish',
    reason: 'Gold is in a structural bull market. Central bank buying hit a 50-year record. Geopolitical tensions and inflation hedging demand is rising. Dollar weakness provides a tailwind.',
    technicals: 'RSI 62 · All-time high breakout · Strong trend · Support at $3,200', change24h: 0.3,
  },
  {
    symbol: 'XAG/USD', name: 'Silver', cat: 'metals', signal: 'BUY', confidence: 71,
    entry: 32.8, target: 42, stopLoss: 29.5, timeframe: '4–8 weeks',
    risk: 'Medium', sentiment: 'Bullish',
    reason: 'Silver benefits from both monetary and industrial demand (solar panels, EVs). Gold/Silver ratio historically elevated suggesting silver is undervalued. Industrial demand growing 18% YoY.',
    technicals: 'RSI 58 · Coiling pattern near resistance · Gold/Silver ratio at extreme · Breakout pending', change24h: 0.5,
  },
  {
    symbol: 'OIL/WTI', name: 'Crude Oil WTI', cat: 'metals', signal: 'HOLD', confidence: 52,
    entry: 78.4, target: 88, stopLoss: 72, timeframe: '2–4 weeks',
    risk: 'High', sentiment: 'Neutral',
    reason: 'Oil is caught between OPEC+ production cuts (bullish) and slowing global growth concerns (bearish). Mixed signals warrant a neutral stance. Wait for a breakout above $82 or below $75.',
    technicals: 'RSI 51 · Range-bound · 50 EMA flat · No clear direction', change24h: -0.2,
  },
  {
    symbol: 'XPT/USD', name: 'Platinum', cat: 'metals', signal: 'BUY', confidence: 64,
    entry: 1020, target: 1200, stopLoss: 940, timeframe: '6–10 weeks',
    risk: 'Medium', sentiment: 'Bullish',
    reason: 'Platinum is deeply undervalued versus gold and palladium. Hydrogen fuel cell adoption is a long-term demand driver. South African supply constraints persist. Technically oversold.',
    technicals: 'RSI 44 oversold · Long-term support · Divergence vs palladium · Accumulation zone', change24h: 0.6,
  },
];

type SigFilter = 'ALL' | 'BUY' | 'SELL' | 'HOLD';
type CatFilter = 'all' | 'crypto' | 'stocks' | 'metals';

const SENTIMENT_SCORE = 62;

export default function RecommendationsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sigFilter, setSigFilter] = useState<SigFilter>('ALL');
  const [catFilter, setCatFilter] = useState<CatFilter>('all');
  const [recs, setRecs] = useState<Rec[]>(BASE_RECS);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [events, setEvents] = useState<{ description: string; event_type: string; tickers_affected: string[]; created_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch live prices and backend LLM-enhanced recommendations in parallel
      const [pricesRes, recsRes] = await Promise.allSettled([
        fetch('/marts/api/public/prices'),
        fetch('/marts/api/public/recommendations'),
      ]);

      const prices: Record<string, number> = {};

      if (pricesRes.status === 'fulfilled' && pricesRes.value.ok) {
        const data: PricesData = await pricesRes.value.json();

        const cryptoMap: Record<string, string> = {
          bitcoin: 'BTC/USDT', ethereum: 'ETH/USDT', binancecoin: 'BNB/USDT',
          solana: 'SOL/USDT', ripple: 'XRP/USDT', dogecoin: 'DOGE/USDT',
          'avalanche-2': 'AVAX/USDT', chainlink: 'LINK/USDT',
        };
        Object.entries(cryptoMap).forEach(([id, sym]) => {
          const priceData = (data as any)[id] as LivePrice | undefined;
          if (priceData?.usd) prices[sym] = priceData.usd;
        });

        const m = data.metals ?? {};
        if (m.gold?.usd) prices['XAU/USD'] = m.gold.usd;
        if (m.silver?.usd) prices['XAG/USD'] = m.silver.usd;
        if (m.oil_wti?.usd) prices['OIL/WTI'] = m.oil_wti.usd;
        if (m.platinum?.usd) prices['XPT/USD'] = m.platinum.usd;

        const s = data.stocks ?? {};
        Object.entries(s).forEach(([sym, priceData]) => {
          if ((priceData as LivePrice)?.usd) prices[sym] = (priceData as LivePrice).usd;
        });
        setLivePrices(prices);
      }

      // Merge backend LLM-enhanced crypto recs
      let backendBySymbol: Record<string, { signal: string; confidence: number; reason: string; change: number }> = {};
      if (recsRes.status === 'fulfilled' && recsRes.value.ok) {
        const backendRecs: { symbol: string; recommendation: string; confidence: number; reason: string; change: number }[] = await recsRes.value.json();
        backendRecs.forEach(r => {
          backendBySymbol[r.symbol] = {
            signal: r.recommendation as string,
            confidence: r.confidence,
            reason: r.reason,
            change: r.change,
          };
        });
      }

      // Update recommendations: crypto get backend data, all get live prices
      setRecs(BASE_RECS.map(r => {
        const lp = prices[r.symbol];
        const be = r.cat === 'crypto' ? backendBySymbol[r.symbol] : undefined;
        return {
          ...r,
          ...(lp !== undefined ? { entry: lp } : {}),
          ...(be ? {
            signal: (be.signal === 'BUY' || be.signal === 'SELL' || be.signal === 'HOLD') ? be.signal : r.signal,
            confidence: be.confidence ?? r.confidence,
            reason: be.reason || r.reason,
            change24h: be.change ?? r.change24h,
            sentiment: be.signal === 'BUY' ? 'Bullish' : be.signal === 'SELL' ? 'Bearish' : 'Neutral',
          } : {}),
        };
      }));

      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch prices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();

    getEvents(10)
      .then(r => {
        const data = r.data;
        setEvents(Array.isArray(data) ? data.slice(0, 6) : (data?.events ?? []).slice(0, 6));
      })
      .catch(() => {});

    const id = setInterval(fetchPrices, 30000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  const filtered = recs.filter(r => {
    if (catFilter !== 'all' && r.cat !== catFilter) return false;
    if (sigFilter !== 'ALL' && r.signal !== sigFilter) return false;

    return (
      r.symbol.toLowerCase().includes(search.toLowerCase()) ||
      r.name.toLowerCase().includes(search.toLowerCase())
    );
  });

  const buys = filtered.filter(r => r.signal === 'BUY').length;
  const sells = filtered.filter(r => r.signal === 'SELL').length;
  const holds = filtered.filter(r => r.signal === 'HOLD').length;

  const fmtPrice = (p: number) => {
    if (p >= 10000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (p >= 100) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 1) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  };

  const rr = (rec: Rec) => {
    const reward = Math.abs(rec.target - rec.entry);
    const risk = Math.abs(rec.entry - rec.stopLoss);
    return risk > 0 ? (reward / risk).toFixed(1) : '—';
  };

  const sigColor = (s: string) => {
    if (s === 'BUY') return 'bg-[#0ecb81]/10 text-[#0ecb81] border-[#0ecb81]/25';
    if (s === 'SELL') return 'bg-[#f6465d]/10 text-[#f6465d] border-[#f6465d]/25';
    return 'bg-[#f0b90b]/10 text-[#f0b90b] border-[#f0b90b]/25';
  };

  const riskColor = (r: string) => {
    if (r === 'Low') return 'text-[#0ecb81]';
    if (r === 'High') return 'text-[#f6465d]';
    return 'text-[#f0b90b]';
  };

  const sentimentIcon = (s: string) => {
    if (s === 'Bullish') return <TrendingUp size={11} className="text-[#0ecb81]" />;
    if (s === 'Bearish') return <TrendingDown size={11} className="text-[#f6465d]" />;
    return <Minus size={11} className="text-[#848e9c]" />;
  };

  const sentimentGrade = SENTIMENT_SCORE >= 75 ? 'Extreme Greed'
    : SENTIMENT_SCORE >= 55 ? 'Greed'
    : SENTIMENT_SCORE >= 45 ? 'Neutral'
    : SENTIMENT_SCORE >= 25 ? 'Fear'
    : 'Extreme Fear';

  const sentimentGradeColor = SENTIMENT_SCORE >= 55 ? 'text-[#0ecb81]'
    : SENTIMENT_SCORE >= 45 ? 'text-[#f0b90b]'
    : 'text-[#f6465d]';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#eaecef]">Trade Recommendations</h1>
          <p className="text-xs text-[#848e9c] mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] inline-block animate-pulse" />
            AI-generated signals · Updated {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchPrices}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-[#848e9c] hover:text-[#eaecef] border border-[#2b3139] px-3 py-1.5 rounded-lg transition"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Market Sentiment Bar */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#848e9c] mb-1">Market Sentiment</p>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-extrabold font-mono ${sentimentGradeColor}`}>{SENTIMENT_SCORE}</span>
              <span className={`text-sm font-bold ${sentimentGradeColor}`}>{sentimentGrade}</span>
            </div>
          </div>

          <div className="flex-1 min-w-[140px] max-w-xs">
            <div className="h-2.5 rounded-full overflow-hidden relative"
              style={{ background: 'linear-gradient(90deg, #f6465d 0%, #f0b90b 40%, #f0b90b 60%, #0ecb81 100%)' }}>
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#161a1e] shadow-md transition-all"
                style={{ left: `calc(${SENTIMENT_SCORE}% - 6px)` }} />
            </div>
            <div className="flex justify-between text-[9px] text-[#4a5568] mt-1 font-medium">
              <span>Fear</span><span>Neutral</span><span>Greed</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-base font-bold text-[#0ecb81]">{buys}</p>
              <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Buy</p>
            </div>
            <div className="h-8 w-px bg-[#2b3139]" />
            <div className="text-center">
              <p className="text-base font-bold text-[#f0b90b]">{holds}</p>
              <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Hold</p>
            </div>
            <div className="h-8 w-px bg-[#2b3139]" />
            <div className="text-center">
              <p className="text-base font-bold text-[#f6465d]">{sells}</p>
              <p className="text-[9px] text-[#848e9c] uppercase tracking-wider">Sell</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left: Recommendations list */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-0">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#848e9c]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search symbol or name…"
                className="w-full bg-[#161a1e] border border-[#2b3139] rounded-xl pl-9 pr-4 py-2 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition"
              />
            </div>

            {/* Category Filter */}
            <div className="flex gap-1 bg-[#161a1e] border border-[#2b3139] rounded-xl p-1 flex-shrink-0">
              {(['all', 'crypto', 'stocks', 'metals'] as CatFilter[]).map(c => (
                <button
                  key={c}
                  onClick={() => setCatFilter(c)}
                  className={`text-xs px-3 py-1.5 rounded-lg capitalize font-medium transition ${
                    catFilter === c ? 'bg-[#f0b90b] text-black' : 'text-[#848e9c] hover:text-[#eaecef]'
                  }`}
                >
                  {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>

            {/* Signal Filter */}
            <div className="flex gap-1 bg-[#161a1e] border border-[#2b3139] rounded-xl p-1 flex-shrink-0">
              {(['ALL', 'BUY', 'SELL', 'HOLD'] as SigFilter[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSigFilter(s)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${
                    sigFilter === s
                      ? s === 'BUY'
                        ? 'bg-[#0ecb81] text-black'
                        : s === 'SELL'
                        ? 'bg-[#f6465d] text-white'
                        : 'bg-[#f0b90b] text-black'
                      : 'text-[#848e9c] hover:text-[#eaecef]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Recommendation Cards */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl py-14 text-center">
                <BarChart2 size={24} className="text-[#2b3139] mx-auto mb-2" />
                <p className="text-sm text-[#848e9c]">No recommendations match your filters</p>
              </div>
            ) : (
              filtered.map(r => {
                const livePrice = livePrices[r.symbol];
                const priceDiff = livePrice ? ((livePrice - r.entry) / r.entry) * 100 : 0;
                const isAboveEntry = priceDiff > 0;

                return (
                  <div key={r.symbol} className="bg-[#161a1e] border border-[#2b3139] hover:border-[#f0b90b]/20 rounded-2xl p-4 sm:p-5 transition-all">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#f0b90b]/10 flex items-center justify-center text-sm font-extrabold text-[#f0b90b] flex-shrink-0">
                          {r.symbol[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#eaecef] text-sm font-mono">{r.symbol}</span>
                            <span className="text-[10px] text-[#848e9c]">{r.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize border ${
                              r.cat === 'crypto' ? 'text-[#f0b90b] border-[#f0b90b]/20 bg-[#f0b90b]/5'
                              : r.cat === 'stocks' ? 'text-[#848e9c] border-[#2b3139]'
                              : 'text-purple-400 border-purple-400/20 bg-purple-400/5'
                            }`}>
                              {r.cat}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {sentimentIcon(r.sentiment)}
                            <span className={`text-[10px] font-medium ${
                              r.sentiment === 'Bullish' ? 'text-[#0ecb81]'
                              : r.sentiment === 'Bearish' ? 'text-[#f6465d]' : 'text-[#848e9c]'
                            }`}>{r.sentiment}</span>
                            <span className="text-[#2b3139]">·</span>
                            <Clock size={9} className="text-[#4a5568]" />
                            <span className="text-[10px] text-[#4a5568]">{r.timeframe}</span>
                          </div>
                        </div>
                      </div>

                      {/* Signal badge */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`text-sm font-extrabold px-3 py-1 rounded-lg border ${sigColor(r.signal)}`}>
                          {r.signal === 'BUY' ? '▲ BUY' : r.signal === 'SELL' ? '▼ SELL' : '— HOLD'}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-[#2b3139] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${
                              r.signal === 'BUY' ? 'bg-[#0ecb81]' : r.signal === 'SELL' ? 'bg-[#f6465d]' : 'bg-[#f0b90b]'
                            }`} style={{ width: `${r.confidence}%` }} />
                          </div>
                          <span className="text-[10px] text-[#848e9c] font-mono">{r.confidence}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Price levels */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      <div className="bg-[#0b0e11] rounded-xl px-3 py-2.5">
                        <p className="text-[9px] text-[#4a5568] uppercase tracking-wider mb-0.5">Entry</p>
                        <p className="text-xs font-bold font-mono text-[#eaecef]">{fmtPrice(r.entry)}</p>
                        {livePrice && (
                          <p className={`text-[9px] mt-0.5 font-medium ${isAboveEntry ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                            Live: {fmtPrice(livePrice)} ({isAboveEntry ? '+' : ''}{priceDiff.toFixed(2)}%)
                          </p>
                        )}
                      </div>

                      <div className="bg-[#0b0e11] rounded-xl px-3 py-2.5">
                        <p className="text-[9px] text-[#4a5568] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                          <Target size={8} /> Target
                        </p>
                        <p className="text-xs font-bold font-mono text-[#0ecb81]">{fmtPrice(r.target)}</p>
                        <p className="text-[9px] text-[#0ecb81] mt-0.5">
                          +{(Math.abs(r.target - r.entry) / r.entry * 100).toFixed(1)}%
                        </p>
                      </div>

                      <div className="bg-[#0b0e11] rounded-xl px-3 py-2.5">
                        <p className="text-[9px] text-[#4a5568] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                          <ShieldAlert size={8} /> Stop Loss
                        </p>
                        <p className="text-xs font-bold font-mono text-[#f6465d]">{fmtPrice(r.stopLoss)}</p>
                        <p className="text-[9px] text-[#f6465d] mt-0.5">
                          -{(Math.abs(r.entry - r.stopLoss) / r.entry * 100).toFixed(1)}%
                        </p>
                      </div>

                      <div className="bg-[#0b0e11] rounded-xl px-3 py-2.5">
                        <p className="text-[9px] text-[#4a5568] uppercase tracking-wider mb-0.5">Risk/Reward</p>
                        <p className="text-xs font-bold font-mono text-[#f0b90b]">1 : {rr(r)}</p>
                        <p className={`text-[9px] mt-0.5 font-medium ${riskColor(r.risk)}`}>{r.risk} Risk</p>
                      </div>
                    </div>

                    {/* Reason */}
                    <p className="text-[11px] text-[#848e9c] leading-relaxed mb-2.5">{r.reason}</p>

                    {/* Technicals */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      {r.technicals.split(' · ').map((t, i) => (
                        <span key={i} className="text-[9px] bg-[#0b0e11] border border-[#2b3139] text-[#848e9c] px-2 py-0.5 rounded-full font-mono">
                          {t}
                        </span>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Zap size={10} className="text-[#f0b90b]" />
                        <span className="text-[10px] text-[#4a5568]">AI Confidence: </span>
                        <span className={`text-[10px] font-bold ${
                          r.confidence >= 75 ? 'text-[#0ecb81]' : r.confidence >= 60 ? 'text-[#f0b90b]' : 'text-[#f6465d]'
                        }`}>
                          {r.confidence >= 75 ? 'High' : r.confidence >= 60 ? 'Moderate' : 'Low'}
                        </span>
                      </div>
                      <button
                        onClick={() => navigate('/app/trade')}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-[#f0b90b] hover:bg-[#d9a60b] text-black px-3 py-1.5 rounded-lg transition"
                      >
                        Trade Now <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="lg:w-72 flex-shrink-0 space-y-4">
          {/* Disclaimer */}
          <div className="flex items-start gap-2.5 bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl px-3 py-3">
            <AlertTriangle size={13} className="text-[#f0b90b] flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-[#848e9c] leading-relaxed">
              <span className="text-[#f0b90b] font-semibold">AI Signals only.</span> These are algorithmic recommendations, not financial advice. Always apply your own risk management. Past signals do not guarantee future results.
            </p>
          </div>

          {/* Live AI Events */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2b3139] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={13} className="text-[#f0b90b]" />
                <span className="text-xs font-semibold text-[#eaecef]">Live Market Events</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] animate-pulse" />
            </div>
            <div className="divide-y divide-[#2b3139]">
              {events.length === 0 ? (
                <div className="py-8 text-center">
                  <Activity size={18} className="text-[#2b3139] mx-auto mb-2" />
                  <p className="text-xs text-[#848e9c]">No events yet</p>
                </div>
              ) : (
                events.map((ev, i) => (
                  <div key={i} className="px-4 py-3 hover:bg-[#1e2329] transition">
                    <p className="text-[11px] text-[#eaecef] leading-relaxed line-clamp-3">
                      {ev.description ?? ev.event_type}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[9px] bg-[#f0b90b]/10 text-[#f0b90b] px-1.5 py-0.5 rounded font-medium">
                        {ev.tickers_affected?.[0] ?? 'Market'}
                      </span>
                      <span className="text-[9px] text-[#4a5568]">
                        {ev.created_at ? new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-[#0ecb81]" /> Signal Summary
            </p>
            {[
              { label: 'Total signals', value: `${filtered.length}` },
              { label: 'Avg confidence', value: filtered.length > 0 ? `${Math.round(filtered.reduce((a, r) => a + r.confidence, 0) / filtered.length)}%` : '—' },
              { label: 'Bullish bias', value: filtered.length > 0 ? `${Math.round((filtered.filter(r => r.signal === 'BUY').length / filtered.length) * 100)}%` : '—' },
              { label: 'High confidence (≥75%)', value: `${filtered.filter(r => r.confidence >= 75).length}` },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-[10px] text-[#848e9c]">{s.label}</span>
                <span className="text-[10px] font-bold text-[#eaecef] font-mono">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}