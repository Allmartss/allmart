import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { getAllActiveAds } from '../lib/api'
import { ExternalLink, Megaphone, X } from 'lucide-react'

interface Ad {
  id: number
  title: string
  description: string | null
  ad_type: string
  image_base64: string | null
  link_url: string | null
  created_at: string
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5)  return 'Good early morning'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 22) return 'Good evening'
  return 'Good night'
}

export default function AdsPage() {
  const { user } = useAuthStore()
  const [ads, setAds]         = useState<Ad[]>([])
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  const firstName = user?.first_name || user?.username || user?.email?.split('@')[0] || 'there'

  useEffect(() => {
    getAllActiveAds()
      .then(r => setAds(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAds([]))
      .finally(() => setLoading(false))
  }, [])

  const dismiss = (id: number) =>
    setDismissed(prev => new Set(prev).add(id))

  const visible = ads.filter(a => !dismissed.has(a.id))

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-10">

      {/* ── Page title ── */}
      <h1 className="text-xl font-bold text-[#eaecef]">Announcements &amp; Ads</h1>

      {/* ── Greeting ── */}
      <p className="text-sm text-[#848e9c] -mt-2">
        {getGreeting()}, Hello 👋{' '}
        <span className="text-[#f0b90b] font-semibold capitalize">{firstName}</span>
      </p>

      {/* ── Ad cards ── */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-[#161a1e] border border-[#2b3139] rounded-2xl overflow-hidden animate-pulse">
              <div className="h-10 bg-[#1e2329] mx-4 mt-4 rounded" />
              <div className="aspect-square bg-[#1e2329] mt-3" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-[#2b3139] rounded w-full" />
                <div className="h-3 bg-[#2b3139] rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-14 h-14 rounded-full bg-[#0b0e11] border border-[#2b3139] flex items-center justify-center">
            <Megaphone size={22} className="text-[#2b3139]" />
          </div>
          <p className="text-sm text-[#848e9c]">No announcements right now</p>
          <p className="text-[10px] text-[#4a5568]">Check back later for promotions &amp; updates</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(ad => (
            <div
              key={ad.id}
              className="bg-[#161a1e] border border-[#2b3139] rounded-2xl overflow-hidden"
            >
              {/* Title row */}
              <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b border-[#2b3139]">
                <p className="text-sm font-bold text-[#eaecef] leading-snug">{ad.title}</p>
                <button
                  onClick={() => dismiss(ad.id)}
                  className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0b0e11] hover:bg-[#2b3139] flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] transition"
                  aria-label="Dismiss"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Instagram-style square image */}
              {ad.image_base64 && (
                <div className="w-full aspect-square bg-[#0b0e11] overflow-hidden">
                  <img
                    src={`data:image/jpeg;base64,${ad.image_base64}`}
                    alt={ad.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Description + buttons */}
              <div className="p-4 space-y-3">
                {ad.description && (
                  <p className="text-sm text-[#848e9c] leading-relaxed whitespace-pre-line">
                    {ad.description}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  {ad.link_url && (
                    <a
                      href={ad.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold text-xs rounded-xl py-2.5 transition"
                    >
                      Learn More <ExternalLink size={11} />
                    </a>
                  )}
                  <button
                    onClick={() => dismiss(ad.id)}
                    className="flex-1 text-xs text-[#848e9c] hover:text-[#eaecef] rounded-xl border border-[#2b3139] hover:bg-[#2b3139] py-2.5 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
