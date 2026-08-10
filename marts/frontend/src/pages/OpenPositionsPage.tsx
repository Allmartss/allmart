import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  BarChart2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Wifi,
  X,
  RefreshCw,
  Bot,
  Brain,
  Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getOpenPositions, closeManualTrade, getBotStatus, finEventListBots } from '../lib/api';

const formatCompact = (num: number) => {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 10_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const fmt = (n: number, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

interface OpenPosition {
  id: number;
  ticker: string;
  price: number;
  qty: number;
  exchange: string;
  created_at: string;
  current_price: number;
  unrealized_pnl: number;
  leverage?: number;
  pnl_pct?: number;
}

function useWsBalance(token: string | null) {
  const [balance, setBalance] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const connect = () => {
      if (!alive) return;
      try {
        const proto = window.location.protocol === 'https:'? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${window.location.host}/marts/ws/live?token=${encodeURIComponent(token)}`);
        wsRef.current = ws;
        ws.onopen = () => alive && setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          if (alive) setTimeout(connect, 4000);
        };
        ws.onerror = () => ws.close();
        ws.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data);
            if (d.type === 'balance' && typeof d.balance_usdt === 'number') {
              setBalance(d.balance_usdt);
            }
          } catch {}
        };
      } catch {}
    };
    connect();
    return () => {
      alive = false;
      wsRef.current?.close();
    };
  }, [token]);
  return { balance, connected };
}

export default function OpenPositionsPage() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const { balance: wsBalance, connected: wsConnected } = useWsBalance(token);

  // Size controller for both cards - change here to adjust all text sizes
  const titleSize = "text-[9px]"; // labels
  const valueSize = "text-xs"; // values

  const [openPositions, setOpenPos] = useState<OpenPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);

  // Collapsible card state
  const [botCollapsed, setBotCollapsed] = useState(false);
  const [eventCollapsed, setEventCollapsed] = useState(false);

  // Bot status - both types
  const [botStatus, setBotStatus] = useState<any>(null); // Fin Bot
  const [feStatus, setFeStatus] = useState<any>(null); // FinEvent Bot

  const userBalance = user?.balance_usdt?? 0;
  const liveBalance = wsBalance?? userBalance;

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOpenPositions();
      setOpenPos(res.data?.positions?? []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load positions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPositions();
    const fetchStatus = async () => {
      try {
        const [botRes, feRes] = await Promise.all([
          getBotStatus(),
          finEventListBots()
        ]);
        setBotStatus(botRes.data);
        setFeStatus(feRes.data);
      } catch {}
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, [fetchPositions]);

  const totalPositionValue = openPositions.reduce(
    (s, p) => s + p.qty * (p.current_price || p.price),
    0
  );

  const marginUsed = totalPositionValue;
  const availableMargin = Math.max(0, liveBalance - marginUsed);

  const manualUnrealizedPnl = openPositions.reduce(
    (s, p) => s + (p.unrealized_pnl?? 0),
    0
  );

  const botUnrealizedPnl: number = botStatus?.bots
    ? Object.values(botStatus.bots as Record<string, any>).reduce(
        (s: number, b: any) => s + (b.position > 0 ? (b.unrealized_pnl ?? 0) : 0), 0
      )
    : 0;

  const feUnrealizedPnl: number = feStatus?.bots
    ? Object.values(feStatus.bots as Record<string, any>).reduce(
        (s: number, b: any) => s + ((b.position > 0 || b.status === 'open') ? (b.unrealized_pnl ?? 0) : 0), 0
      )
    : 0;

  const unrealizedPnl = manualUnrealizedPnl + botUnrealizedPnl + feUnrealizedPnl;

  const handleClose = async (id: number) => {
    setClosingId(id);
    try {
      const res = await closeManualTrade(id);
      const d = res.data;
      const pnl = d.pnl?? 0;
      toast.success(
        `Closed @ $${d.close_price?.toLocaleString('en-US', { maximumFractionDigits: 2 })} — P&L: ${pnl >= 0? '+' : ''}$${pnl.toFixed(2)}`,
        { duration: 5000 }
      );
      if (d.new_balance!== undefined) {
        useAuthStore.getState().setUser({
         ...useAuthStore.getState().user!,
          balance_usdt: d.new_balance,
        });
      }
      fetchPositions();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to close position');
    } finally {
      setClosingId(null);
    }
  };

  return (
    <div className="space-y-3">

      {/* ── Sticky Balance / Stats Card ── */}
      <div className="sticky top-0 z-20 bg-[#161a1e] border-[#2b3139] rounded-xl overflow-hidden shadow-lg shadow-black/30">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b3139]">
          <div className="flex items-center gap-2">
            <BarChart2 size={14} className="text-[#f0b90b]" />
            <span className="text-sm font-bold text-[#eaecef]">Open Positions</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
              wsConnected? 'bg-[#0ecb81]/10 text-[#0ecb81] border-[#0ecb81]/20' : 'bg-[#2b3139] text-[#848e9c]'
            }`}>
              {wsConnected? <><Wifi size={7} className="inline mr-0.5" />Live</> : 'Offline'}
            </span>
            {openPositions.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#f0b90b]/10 border-[#f0b90b]/20 text-[#f0b90b] font-semibold">
                {openPositions.length} open
              </span>
            )}
          </div>
          <button onClick={fetchPositions} className="p-1.5 rounded-lg hover:bg-[#2b3139] text-[#848e9c] hover:text-[#eaecef] transition">
            <RefreshCw size={12} className={loading? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="bg-[#161a1e] border-[#2b3139] rounded-xl p-1 space-y-1">
          {[
            { label: 'Balance', value: `$${formatCompact(liveBalance)}`, color: 'text-[#f0b90b]' },
            { label: 'Free Margin', value: `$${formatCompact(availableMargin)}`, color: 'text-[#0ecb81]' },
            { label: 'Margin Used', value: `$${formatCompact(marginUsed)}`, color: 'text-[#f6465d]' },
            { label: 'Unrealized P&L', value: `${unrealizedPnl >= 0? '+' : ''}$${Math.abs(unrealizedPnl).toFixed(2)}`, color: unrealizedPnl >= 0? 'text-[#0ecb81]' : 'text-[#f6465d]' },
          ].map(s => (
            <div key={s.label} className="flex justify-between items-center bg-[#0b0e11] rounded-xl px-4 py-1.5">
              <p className={`${titleSize} text-[#848e9c]`}>{s.label}</p>
              <p className={`${valueSize} font-bold font-mono text-right ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FinBot Positions Card — BotsPage style ── */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <button onClick={() => setBotCollapsed(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1e2329] transition">
          <div className="flex items-center gap-2">
            <Bot size={13} className="text-[#f0b90b]" />
            <span className="text-sm font-semibold text-[#eaecef]">FinBot Positions</span>
            {botStatus?.bots && (
              <span className="text-[9px] bg-[#f0b90b]/10 text-[#f0b90b] border border-[#f0b90b]/20 px-1.5 py-0.5 rounded-full font-semibold">
                {Object.values(botStatus.bots as Record<string, any>).filter((b: any) => b.position > 0).length} open
              </span>
            )}
          </div>
          {botCollapsed ? <ChevronDown size={13} className="text-[#848e9c]" /> : <ChevronUp size={13} className="text-[#848e9c]" />}
        </button>

        {!botCollapsed && (
          <div className="border-t border-[#2b3139]">
            {botStatus?.bots && Object.values(botStatus.bots as Record<string, any>).length > 0 ? (
              <div className="p-3 space-y-2">
                {Object.entries(botStatus.bots as Record<string, any>).map(([botName, bot]: [string, any]) => (
                  <div key={botName}>
                    {/* Bot label row */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${bot.position > 0 ? 'bg-[#0ecb81] animate-pulse' : 'bg-[#2b3139]'}`} />
                      <span className="text-xs font-semibold text-[#eaecef] capitalize">{botName}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        bot.position > 0 ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#2b3139] text-[#848e9c]'
                      }`}>{bot.position > 0 ? 'OPEN' : 'IDLE'}</span>
                    </div>

                    {bot.position > 0 ? (
                      /* ── Full BotsPage-style position card ── */
                      <div className="bg-[#0b0e11] border border-[#0ecb81]/20 rounded-xl px-3 py-2.5 space-y-1.5 ml-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-[#0ecb81] font-semibold uppercase tracking-wide flex items-center gap-1">
                            <Target size={9} /> Open Position
                          </p>
                          <span className="text-[10px] font-mono font-bold text-[#f0b90b] bg-[#f0b90b]/10 px-1.5 py-0.5 rounded">{bot.ticker}</span>
                        </div>
                        {/* Stats grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-[#848e9c]">Entry</span>
                            <span className="font-mono text-[#eaecef]">${fmt(bot.entry_price ?? 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#848e9c]">Size</span>
                            <span className="font-mono text-[#f0b90b]">{(bot.position ?? 0).toFixed(6)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#848e9c]">Margin</span>
                            <span className="font-mono text-[#eaecef]">${fmt(bot.open_margin ?? 0)}</span>
                          </div>
                          {bot.leverage && (
                            <div className="flex justify-between">
                              <span className="text-[#848e9c]">Leverage</span>
                              <span className="font-mono text-[#eaecef]">{bot.leverage}x</span>
                            </div>
                          )}
                        </div>
                        {/* Unrealized P&L bar */}
                        <div className="pt-1 border-t border-[#0ecb81]/10">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-[#848e9c]">Unrealized P&L</span>
                            <span className={`text-sm font-bold font-mono ${(bot.unrealized_pnl ?? 0) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                              {(bot.unrealized_pnl ?? 0) >= 0 ? '+' : ''}${Math.abs(bot.unrealized_pnl ?? 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="w-full bg-[#2b3139] rounded-full h-1">
                            <div className={`h-1 rounded-full transition-all ${(bot.unrealized_pnl ?? 0) >= 0 ? 'bg-[#0ecb81]' : 'bg-[#f6465d]'}`}
                              style={{ width: `${Math.min(100, Math.abs(((bot.unrealized_pnl ?? 0) / Math.max(bot.open_margin ?? 1, 1)) * 100))}%` }} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="ml-3 px-3 py-2 rounded-lg bg-[#0b0e11] border border-[#2b3139]/50">
                        <span className="text-[10px] text-[#4a5568]">Waiting for signal — {bot.ticker}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <Bot size={24} className="text-[#2b3139] mx-auto mb-2" />
                <p className="text-xs text-[#848e9c]">No bots configured</p>
              </div>
            )}
            <div className="border-t border-[#2b3139] px-4 py-2.5 flex justify-center">
              <button onClick={() => navigate('/app/bots')}
                className="text-xs text-[#f0b90b] hover:underline flex items-center gap-1">
                Manage FinBots →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── FinEventAI Positions Card — BotsPage style ── */}
      <div className="bg-[#161a1e] border border-[#f0b90b]/20 rounded-xl overflow-hidden">
        <button onClick={() => setEventCollapsed(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1e2329] transition">
          <div className="flex items-center gap-2">
            <Brain size={13} className="text-[#f0b90b]" />
            <span className="text-sm font-semibold text-[#eaecef]">FinEventAI Positions</span>
            {feStatus?.bots && (
              <span className="text-[9px] bg-[#f0b90b]/10 text-[#f0b90b] border border-[#f0b90b]/20 px-1.5 py-0.5 rounded-full font-semibold">
                {feStatus.bots.filter((b: any) => b.position > 0 || Object.keys(b.open_positions ?? {}).length > 0).length} open
              </span>
            )}
          </div>
          {eventCollapsed ? <ChevronDown size={13} className="text-[#848e9c]" /> : <ChevronUp size={13} className="text-[#848e9c]" />}
        </button>

        {!eventCollapsed && (
          <div className="border-t border-[#f0b90b]/20">
            {feStatus?.bots && feStatus.bots.length > 0 ? (
              <div className="p-3 space-y-2">
                {feStatus.bots.map((bot: any, i: number) => {
                  const openPositions: Record<string, any> = bot.open_positions ?? {}
                  const hasOpenPos = Object.keys(openPositions).length > 0 || bot.position > 0
                  return (
                    <div key={i}>
                      {/* Bot label row */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasOpenPos ? 'bg-[#f0b90b] animate-pulse' : bot.running ? 'bg-[#0ecb81] animate-pulse' : 'bg-[#2b3139]'}`} />
                        <span className="text-xs font-semibold text-[#eaecef] capitalize">{bot.bot_name ?? bot.ticker}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          hasOpenPos ? 'bg-[#f0b90b]/10 text-[#f0b90b]' : bot.running ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#2b3139] text-[#848e9c]'
                        }`}>{hasOpenPos ? 'OPEN' : bot.running ? 'RUNNING' : 'IDLE'}</span>
                      </div>

                      {/* BotsPage-style open position cards */}
                      {Object.keys(openPositions).length > 0 ? (
                        <div className="ml-3 space-y-1.5">
                          {Object.entries(openPositions).map(([ticker, pos]: [string, any]) => {
                            const upnl = pos.unrealized_pnl ?? 0
                            const margin = pos.margin ?? bot.capital_per_trade ?? 0
                            const lev = pos.leverage ?? bot.leverage ?? 10
                            const tp = pos.take_profit_pct ?? bot.take_profit_pct ?? 50
                            const sl = pos.stop_loss_pct ?? bot.stop_loss_pct ?? 30
                            return (
                              <div key={ticker} className="bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl px-3 py-2.5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] text-[#f0b90b] font-semibold uppercase tracking-wide flex items-center gap-1">
                                    <Target size={9} /> Open Position
                                  </p>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono font-bold text-[#f0b90b] bg-[#f0b90b]/10 px-1.5 py-0.5 rounded">{ticker}</span>
                                    <span className="text-[9px] font-bold text-[#848e9c] bg-[#2b3139] px-1.5 py-0.5 rounded">{lev}x</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                                  <div className="flex justify-between"><span className="text-[#848e9c]">Entry</span><span className="font-mono text-[#eaecef]">${fmt(pos.entry_price ?? 0)}</span></div>
                                  <div className="flex justify-between"><span className="text-[#848e9c]">Qty</span><span className="font-mono text-[#f0b90b]">{(pos.qty ?? 0).toFixed(6)}</span></div>
                                  <div className="flex justify-between"><span className="text-[#848e9c]">Margin</span><span className="font-mono text-[#eaecef]">${margin.toFixed(2)}</span></div>
                                  <div className="flex justify-between"><span className="text-[#848e9c]">Leverage</span><span className="font-mono text-[#eaecef]">{lev}x</span></div>
                                  <div className="flex justify-between"><span className="text-[#0ecb81]">TP</span><span className="font-mono text-[#0ecb81]">+{tp}%</span></div>
                                  <div className="flex justify-between"><span className="text-[#f6465d]">SL</span><span className="font-mono text-[#f6465d]">-{sl}%</span></div>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-[#f0b90b]/10">
                                  <span className="text-[10px] text-[#848e9c]">Unrealized P&L</span>
                                  <span className={`text-sm font-bold font-mono ${upnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                                    {upnl >= 0 ? '+' : ''}${Math.abs(upnl).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : bot.position > 0 ? (
                        /* Fallback: simple position card when open_positions not available */
                        <div className="ml-3 bg-[#f0b90b]/5 border border-[#f0b90b]/20 rounded-xl px-3 py-2.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-[#f0b90b] font-semibold uppercase tracking-wide flex items-center gap-1"><Target size={9} /> Open Position</p>
                            <span className="text-[10px] font-mono font-bold text-[#f0b90b] bg-[#f0b90b]/10 px-1.5 py-0.5 rounded">{bot.ticker}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                            <div className="flex justify-between"><span className="text-[#848e9c]">Entry</span><span className="font-mono text-[#eaecef]">${fmt(bot.entry_price ?? 0)}</span></div>
                            <div className="flex justify-between"><span className="text-[#848e9c]">Size</span><span className="font-mono text-[#f0b90b]">{(bot.position ?? 0).toFixed(6)}</span></div>
                            <div className="flex justify-between"><span className="text-[#848e9c]">Capital</span><span className="font-mono text-[#eaecef]">${fmt(bot.capital_per_trade ?? 0)}</span></div>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-[#f0b90b]/10">
                            <span className="text-[10px] text-[#848e9c]">Unrealized P&L</span>
                            <span className={`text-sm font-bold font-mono ${(bot.unrealized_pnl ?? 0) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                              {(bot.unrealized_pnl ?? 0) >= 0 ? '+' : ''}${Math.abs(bot.unrealized_pnl ?? 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="ml-3 px-3 py-2 rounded-lg bg-[#0b0e11] border border-[#2b3139]/50">
                          <span className="text-[10px] text-[#4a5568]">{bot.running ? 'Monitoring events…' : 'Bot stopped'}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <Brain size={24} className="text-[#2b3139] mx-auto mb-2" />
                <p className="text-xs text-[#848e9c]">No EventBots configured</p>
              </div>
            )}
            <div className="border-t border-[#f0b90b]/10 px-4 py-2.5 flex justify-center">
              <button onClick={() => navigate('/app/bots')}
                className="text-xs text-[#f0b90b] hover:underline flex items-center gap-1">
                Manage EventBots →
              </button>
            </div>
          </div>
        )}
      </div>


{/* ── Positions List ── */}
      <div className="bg-[#161a1e] border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b3139]">
          <div className="flex items-center gap-2">
            <BarChart2 size={13} className="text-[#f0b90b]" />
            <span className="text-xs font-semibold text-[#eaecef]">{openPositions.length} Open Position{openPositions.length!== 1? 's' : ''}</span>
          </div>
          <button onClick={() => navigate('/app/trade')} className="text-[10px] text-[#f0b90b] hover:underline transition">+ New Trade</button>
        </div>

        {openPositions.length === 0? (
          <div className="py-14 text-center">
            <BarChart2 size={28} className="text-[#2b3139] mx-auto mb-3" />
            <p className="text-sm text-[#848e9c]">No open positions</p>
            <button onClick={() => navigate('/app/trade')} className="mt-3 px-4 py-2 rounded-xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 text-xs text-[#f0b90b] hover:bg-[#f0b90b]/20 transition">Go to Trade</button>
          </div>
        ) : (
          <div className="divide-y divide-[#2b3139]/50">
            {openPositions.map((pos) => {
              const pnl = pos.unrealized_pnl?? 0;
              const pnlPct = pos.pnl_pct?? (pos.price > 0? ((pos.current_price - pos.price) / pos.price) * 100 : 0);
              return (
                <div key={pos.id} className={`px-4 py-3 hover:bg-[#1e2329] transition ${pnl >= 0? 'border-l-2 border-l-[#0ecb81]/30' : 'border-l-2 border-l-[#f6465d]/30'}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold text-[#eaecef]">{pos.ticker}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] border-[#f0b90b]/20 font-semibold uppercase">BUY</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0ecb81]/10 text-[#0ecb81] border-[#0ecb81]/20">Live</span>
                      {(pos.leverage?? 1) > 1 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#627eea]/10 text-[#627eea] border-[#627eea]/20">{pos.leverage}x</span>}
                      <span className="text-[9px] text-[#848e9c] hidden sm:inline">{pos.exchange || 'Platform'}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className={`text-sm font-bold font-mono ${pnl >= 0? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{pnl >= 0? '+' : ''}${pnl.toFixed(2)}</p>
                        <p className={`text-[10px] ${pnlPct >= 0? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{pnlPct >= 0? <TrendingUp size={8} className="inline mr-0.5" /> : <TrendingDown size={8} className="inline mr-0.5" />}{pnlPct >= 0? '+' : ''}{pnlPct.toFixed(2)}%</p>
                      </div>
                      <button onClick={() => handleClose(pos.id)} disabled={closingId === pos.id} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[#f6465d]/10 border-[#f6465d]/30 text-[#f6465d] hover:bg-[#f6465d] hover:text-white disabled:opacity-50 transition"><X size={9} /> {closingId === pos.id? '…' : 'Close'}</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px]">
                    <div><span className="text-[#848e9c]">Entry </span><span className="text-[#eaecef] font-mono font-semibold">${pos.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span></div>
                    <div><span className="text-[#848e9c]">Current </span><span className={`font-mono font-semibold ${pnl >= 0? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>${pos.current_price.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span></div>
                    <div><span className="text-[#848e9c]">Qty </span><span className="text-[#f0b90b] font-mono font-semibold">{Number(pos.qty).toFixed(6)}</span></div>
                    <div className="ml-auto text-[9px] text-[#4a5568]">{pos.created_at? new Date(pos.created_at).toLocaleDateString() : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}