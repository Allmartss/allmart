import { useEffect, useRef, useState } from 'react'
import { X, ExternalLink, Megaphone, Bell } from 'lucide-react'
import { getAllActiveAds } from '../lib/api'

interface Ad {
  id: number
  title: string
  description?: string
  ad_type: string
  image_base64?: string
  link_url?: string
}

const FIRST_DELAY_MS = 300_000  // 5 minutes after login
const CYCLE_DELAY_MS = 180_000  // 3 minutes between ads
const DISPLAY_SECS   = 80       // auto-dismiss countdown

export default function AdPopup() {
  const [ads,      setAds]      = useState<Ad[]>([])
  const [adIndex,  setAdIndex]  = useState(0)
  const [visible,  setVisible]  = useState(false)
  const [secs,     setSecs]     = useState(DISPLAY_SECS)
  const cycleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getAllActiveAds()
      .then(res => {
        const data: Ad[] = Array.isArray(res.data) ? res.data : []
        const shuffled = [...data].sort(() => Math.random() - 0.5)
        setAds(shuffled)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (ads.length === 0) return
    const timer = setTimeout(() => setVisible(true), FIRST_DELAY_MS)
    return () => clearTimeout(timer)
  }, [ads])

  useEffect(() => {
    if (!visible) return
    setSecs(DISPLAY_SECS)
    const tick = setInterval(() => {
      setSecs(s => {
        if (s <= 1) { clearInterval(tick); scheduleNext(); return 0 }
        return s - 1
      })
    }, 1_000)
    return () => clearInterval(tick)
  }, [visible, adIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleNext = () => {
    setVisible(false)
    if (ads.length <= 1) return
    if (cycleTimer.current) clearTimeout(cycleTimer.current)
    cycleTimer.current = setTimeout(() => {
      setAdIndex(i => (i + 1) % ads.length)
      setVisible(true)
    }, CYCLE_DELAY_MS)
  }

  const dismiss = () => { setVisible(false); scheduleNext() }

  useEffect(() => () => { if (cycleTimer.current) clearTimeout(cycleTimer.current) }, [])

  const ad = ads[adIndex]
  if (!visible || !ad) return null

  const pct  = secs / DISPLAY_SECS
  const r    = 11
  const circ = 2 * Math.PI * r

  // ── Countdown ring (reusable) ──
  const CountdownRing = () => (
    <div className="w-8 h-8 flex items-center justify-center relative flex-shrink-0">
      <svg width="28" height="28" viewBox="0 0 28 28" className="absolute -rotate-90">
        <circle cx="14" cy="14" r={r} fill="none" stroke="#2b3139" strokeWidth="2.5" />
        <circle cx="14" cy="14" r={r} fill="none" stroke="#f0b90b" strokeWidth="2.5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <span className="text-[9px] font-bold text-[#f0b90b] relative z-10 leading-none">{secs}</span>
    </div>
  )

  const CloseBtn = ({ cls = '' }: { cls?: string }) => (
    <button onClick={dismiss}
      className={`w-7 h-7 rounded-full bg-[#0b0e11] hover:bg-[#2b3139] flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] transition flex-shrink-0 ${cls}`}>
      <X size={14} />
    </button>
  )

  const CTA = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex items-center gap-2 ${compact ? '' : 'pt-1'}`}>
      {ad.link_url && (
        <a href={ad.link_url} target="_blank" rel="noopener noreferrer" onClick={dismiss}
          className={`flex items-center justify-center gap-1.5 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold text-xs rounded-xl transition ${compact ? 'px-3 py-1.5' : 'flex-1 py-2.5'}`}>
          Learn More <ExternalLink size={11} />
        </a>
      )}
      <button onClick={dismiss}
        className={`text-xs text-[#848e9c] hover:text-[#eaecef] rounded-xl border border-[#2b3139] hover:bg-[#2b3139] transition ${compact ? 'px-3 py-1.5' : 'flex-1 py-2.5'}`}>
        Close
      </button>
    </div>
  )

  const AdImg = ({ cls = '' }: { cls?: string }) => ad.image_base64 ? (
    <img src={ad.image_base64} alt={ad.title} className={`object-cover ${cls}`} />
  ) : null

  const type = ad.ad_type || 'popup'

  // ─────────── POPUP (modal) ───────────
  if (type === 'popup') {
    return (
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div className="relative bg-[#161a1e] border border-[#2b3139] rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
          style={{ animation: 'adFadeIn .3s ease-out' }}>
          <style>{`@keyframes adFadeIn { from { opacity:0; transform:scale(.92) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }`}</style>
          <div className="absolute top-3 left-3 z-10"><CountdownRing /></div>
          {ads.length > 1 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
              <span className="text-[9px] text-[#848e9c] bg-[#0b0e11]/70 px-2 py-0.5 rounded-full">{adIndex + 1}/{ads.length}</span>
            </div>
          )}
          <div className="absolute top-3 right-3 z-10"><CloseBtn /></div>
          {ad.image_base64 ? (
            <AdImg cls="w-full max-h-56" />
          ) : (
            <div className="w-full h-28 bg-gradient-to-br from-[#f0b90b]/10 via-[#161a1e] to-[#0ecb81]/10 flex items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-[#f0b90b] flex items-center justify-center text-3xl font-black text-black">F</div>
            </div>
          )}
          <div className="p-5 space-y-2">
            <h3 className="text-base font-bold text-[#eaecef] pr-4 leading-snug">{ad.title}</h3>
            {ad.description && <p className="text-xs text-[#848e9c] leading-relaxed">{ad.description}</p>}
            <CTA />
          </div>
        </div>
      </div>
    )
  }

  // ─────────── BANNER (top bar) ───────────
  if (type === 'banner') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[999] shadow-lg"
        style={{ animation: 'adSlideDown .3s ease-out' }}>
        <style>{`@keyframes adSlideDown { from { transform:translateY(-100%) } to { transform:translateY(0) } }`}</style>
        <div className="bg-[#161a1e] border-b border-[#f0b90b]/30">
          <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 py-2.5">
            {ad.image_base64 && <AdImg cls="h-8 w-12 rounded-lg flex-shrink-0" />}
            <Megaphone size={15} className="text-[#f0b90b] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-[#eaecef]">{ad.title}</span>
              {ad.description && <span className="text-xs text-[#848e9c] ml-2 hidden sm:inline">{ad.description}</span>}
            </div>
            {ad.link_url && (
              <a href={ad.link_url} target="_blank" rel="noopener noreferrer" onClick={dismiss}
                className="flex items-center gap-1 px-3 py-1 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold text-[10px] rounded-lg transition flex-shrink-0">
                View <ExternalLink size={9} />
              </a>
            )}
            <CountdownRing />
            <CloseBtn />
          </div>
        </div>
      </div>
    )
  }

  // ─────────── SIDEBAR (right panel) ───────────
  if (type === 'sidebar') {
    return (
      <div className="fixed inset-0 z-[999] flex justify-end" onClick={dismiss}>
        <div className="w-72 bg-[#161a1e] border-l border-[#2b3139] shadow-2xl flex flex-col overflow-hidden"
          style={{ animation: 'adSlideLeft .3s ease-out' }}
          onClick={e => e.stopPropagation()}>
          <style>{`@keyframes adSlideLeft { from { transform:translateX(100%) } to { transform:translateX(0) } }`}</style>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b3139]">
            <div className="flex items-center gap-2">
              <CountdownRing />
              <span className="text-[10px] text-[#848e9c]">Sponsored</span>
            </div>
            <CloseBtn />
          </div>
          {ad.image_base64 && <AdImg cls="w-full max-h-40" />}
          {!ad.image_base64 && (
            <div className="w-full h-32 bg-gradient-to-br from-[#f0b90b]/10 to-[#0ecb81]/10 flex items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-[#f0b90b] flex items-center justify-center text-2xl font-black text-black">F</div>
            </div>
          )}
          <div className="p-4 flex-1 space-y-3">
            <h3 className="text-sm font-bold text-[#eaecef] leading-snug">{ad.title}</h3>
            {ad.description && <p className="text-xs text-[#848e9c] leading-relaxed">{ad.description}</p>}
          </div>
          <div className="p-4 border-t border-[#2b3139]">
            <CTA />
          </div>
        </div>
      </div>
    )
  }

  // ─────────── NOTIFICATION (toast corner) ───────────
  if (type === 'notification') {
    return (
      <div className="fixed top-4 right-4 z-[999] w-80 shadow-2xl"
        style={{ animation: 'adFadeIn .3s ease-out' }}>
        <style>{`@keyframes adFadeIn { from { opacity:0; transform:translateY(-12px) } to { opacity:1; transform:translateY(0) } }`}</style>
        <div className="bg-[#1e2329] border border-[#2b3139] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#f0b90b]/8 border-b border-[#2b3139]">
            <Bell size={12} className="text-[#f0b90b] flex-shrink-0" />
            <span className="text-[10px] text-[#f0b90b] font-semibold uppercase tracking-wider flex-1">Sponsored</span>
            <CountdownRing />
            <CloseBtn />
          </div>
          <div className="flex gap-3 p-3">
            {ad.image_base64 && <AdImg cls="w-14 h-14 rounded-lg flex-shrink-0 object-cover" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#eaecef] leading-snug">{ad.title}</p>
              {ad.description && <p className="text-[10px] text-[#848e9c] mt-0.5 line-clamp-2">{ad.description}</p>}
            </div>
          </div>
          {ad.link_url && (
            <div className="px-3 pb-3">
              <a href={ad.link_url} target="_blank" rel="noopener noreferrer" onClick={dismiss}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 border border-[#f0b90b]/30 text-[#f0b90b] text-xs font-semibold rounded-lg transition">
                Learn More <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─────────── TICKER (scrolling bar) ───────────
  if (type === 'ticker') {
    const allText = ads.map(a => `${a.title}${a.description ? ' — ' + a.description : ''}`).join('   ·   ')
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[999] bg-[#0b0e11] border-t border-[#f0b90b]/20"
        style={{ animation: 'adFadeIn .3s ease-out' }}>
        <style>{`
          @keyframes adFadeIn { from { opacity:0 } to { opacity:1 } }
          @keyframes tickerScroll { from { transform: translateX(100vw) } to { transform: translateX(-100%) } }
        `}</style>
        <div className="flex items-center">
          <div className="flex items-center gap-2 px-3 py-1.5 border-r border-[#2b3139] flex-shrink-0">
            <Megaphone size={11} className="text-[#f0b90b]" />
            <span className="text-[10px] font-bold text-[#f0b90b] uppercase tracking-wider whitespace-nowrap">Sponsored</span>
          </div>
          <div className="flex-1 overflow-hidden py-1.5">
            <div className="whitespace-nowrap text-xs text-[#848e9c]"
              style={{ animation: 'tickerScroll 25s linear infinite', display: 'inline-block' }}>
              {ad.link_url ? (
                <a href={ad.link_url} target="_blank" rel="noopener noreferrer" onClick={dismiss}
                  className="hover:text-[#f0b90b] transition">{allText}</a>
              ) : allText}
            </div>
          </div>
          <div className="flex items-center gap-1 px-2 flex-shrink-0">
            <CountdownRing />
            <CloseBtn />
          </div>
        </div>
      </div>
    )
  }

  // ─────────── FALLBACK = popup ───────────
  return null
}
