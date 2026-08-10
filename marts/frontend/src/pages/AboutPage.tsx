import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Star, Shield, Bot, TrendingUp, Globe, ArrowRight,
  ChevronLeft, ChevronRight, Users, Award, BarChart2,
} from 'lucide-react'

interface Testimonial {
  id: number
  name: string
  role?: string
  content: string
  rating: number
  avatar_initials?: string
  avatar_color?: string
}

const STATIC_TESTIMONIALS: Testimonial[] = [
  { id: 1, name: 'Sarah M.', role: 'Day Trader · London', content: 'FinAi transformed how I trade. The AI signals are consistently accurate and the bot automation has freed up hours of my day. My portfolio grew 34% in 3 months.', rating: 5, avatar_initials: 'SM', avatar_color: '#0ecb81' },
  { id: 2, name: 'James K.', role: 'Crypto Investor · New York', content: 'The FinEventAI feature is incredible — it caught the Fed announcement price move before my usual news feed did. Worth every cent of the Pro plan.', rating: 5, avatar_initials: 'JK', avatar_color: '#f0b90b' },
  { id: 3, name: 'Priya S.', role: 'Portfolio Manager · Singapore', content: 'I manage 8 bots running simultaneously. The risk management tools — drawdown limits, trailing stops — are exactly what professionals need. Highly recommend.', rating: 5, avatar_initials: 'PS', avatar_color: '#627eea' },
  { id: 4, name: 'Mike R.', role: 'Retail Investor · Australia', content: 'Started with the free plan, upgraded to Pro within a week. The P2P transfer system is seamless and the 24/7 support team is brilliant.', rating: 5, avatar_initials: 'MR', avatar_color: '#f6465d' },
  { id: 5, name: 'Chen W.', role: 'Algorithmic Trader · Hong Kong', content: 'The leverage options and margin calculator are transparent and reliable. I have full control over every trade. FinAi is in a class of its own.', rating: 5, avatar_initials: 'CW', avatar_color: '#a78bfa' },
]

const team = [
  { name: 'Alex Rivera', role: 'CEO & Co-Founder', avatar: 'AR', color: '#f0b90b', bio: 'Ex-Goldman Sachs. 15 years in quantitative finance and machine learning.' },
  { name: 'Yuki Tanaka', role: 'CTO & Co-Founder', avatar: 'YT', color: '#627eea', bio: 'Former Google AI researcher. Built high-frequency trading systems for top-3 hedge funds.' },
  { name: 'Fatima Al-Hassan', role: 'Head of Risk', avatar: 'FA', color: '#0ecb81', bio: 'PhD in Financial Mathematics. Led risk teams at JPMorgan and Citadel.' },
  { name: 'Marco Bianchi', role: 'Lead Engineer', avatar: 'MB', color: '#f6465d', bio: 'Senior engineer from Coinbase. Built trading infrastructure handling $2B+ daily volume.' },
]

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={14} className={i <= rating ? 'text-[#f0b90b] fill-[#f0b90b]' : 'text-[#2b3139]'} />
      ))}
    </div>
  )
}

export default function AboutPage() {
  const navigate = useNavigate()
  const [testimonials, setTestimonials] = useState<Testimonial[]>(STATIC_TESTIMONIALS)
  const [activeIdx, setActiveIdx] = useState(0)
  useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/marts/api/testimonials')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setTestimonials(data) })
      .catch(() => { /* use static */ })
  }, [])

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % testimonials.length)
    }, 4500)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [testimonials.length])

  const prev = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setActiveIdx(i => (i - 1 + testimonials.length) % testimonials.length)
  }
  const next = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setActiveIdx(i => (i + 1) % testimonials.length)
  }

  const avgRating = (testimonials.reduce((s, t) => s + t.rating, 0) / testimonials.length).toFixed(1)

  return (
    <div className="min-h-screen bg-[#0b0e11] text-[#eaecef]">

      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-[#0b0e11]/95 backdrop-blur-md border-b border-[#2b3139]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 flex-shrink-0 group">
            <div className="w-7 h-7 rounded-lg bg-[#f0b90b] group-hover:bg-[#d4a30a] flex items-center justify-center shadow-lg shadow-[#f0b90b]/20 transition-colors">
              <Zap size={13} className="text-black" />
            </div>
            <span className="text-[#f0b90b] font-bold text-base tracking-tight group-hover:text-[#d4a30a] transition-colors">FinAi</span>
          </button>
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => navigate('/')} className="text-sm text-[#848e9c] hover:text-[#eaecef] transition font-medium">Home</button>
            <button onClick={() => navigate('/about')} className="text-sm text-[#f0b90b] font-semibold">About</button>
            <button onClick={() => navigate('/terms')} className="text-sm text-[#848e9c] hover:text-[#eaecef] transition font-medium">Terms</button>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/login')} className="text-sm text-[#848e9c] hover:text-[#eaecef] transition font-medium px-3 py-1.5 hidden sm:block">Sign In</button>
            <button onClick={() => navigate('/login')} className="bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold text-sm px-4 py-1.5 rounded-lg transition">
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-80 h-80 bg-[#f0b90b]/6 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[#627eea]/8 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-[#f0b90b]/10 border border-[#f0b90b]/20 rounded-full px-4 py-1.5 text-xs text-[#f0b90b] font-semibold mb-6">
            <Award size={12} /> About FinAi
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-[#eaecef] leading-tight mb-5">
            Democratizing{' '}
            <span className="text-[#f0b90b]">AI Trading</span>{' '}
            for Everyone
          </h1>
          <p className="text-base sm:text-lg text-[#848e9c] max-w-2xl mx-auto leading-relaxed mb-8">
            FinAi was built to give every trader — from beginners to professionals — access to the same AI-powered market intelligence that institutional investors have used for decades.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button onClick={() => navigate('/login')} className="flex items-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold px-6 py-3 rounded-xl transition shadow-lg shadow-[#f0b90b]/20">
              Start Trading <ArrowRight size={16} />
            </button>
            <button onClick={() => navigate('/#pricing')} className="flex items-center gap-2 border border-[#2b3139] hover:border-[#f0b90b]/40 text-[#848e9c] hover:text-[#eaecef] font-semibold px-6 py-3 rounded-xl transition">
              View Pricing
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4 border-y border-[#2b3139] bg-[#161a1e]/50">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { icon: BarChart2, value: '$2.4B+', label: 'Volume Analyzed', color: '#f0b90b' },
            { icon: Bot,       value: '50,000+', label: 'Active Bots',     color: '#627eea' },
            { icon: Users,     value: '12,000+', label: 'Traders Worldwide', color: '#0ecb81' },
            { icon: Globe,     value: '60+',     label: 'Countries Served', color: '#f6465d' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: `${s.color}15` }}>
                <s.icon size={18} style={{ color: s.color }} />
              </div>
              <p className="text-2xl font-extrabold text-[#eaecef] font-mono">{s.value}</p>
              <p className="text-xs text-[#848e9c] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-xs text-[#f0b90b] font-bold uppercase tracking-widest mb-3">Our Mission</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#eaecef] mb-4 leading-tight">
                Leveling the Playing Field in Financial Markets
              </h2>
              <p className="text-[#848e9c] leading-relaxed mb-4">
                For too long, advanced trading technology has been locked behind the walls of hedge funds and investment banks. FinAi was founded in 2022 with one goal: to make institutional-grade AI trading accessible to everyone.
              </p>
              <p className="text-[#848e9c] leading-relaxed">
                Our platform combines state-of-the-art Grok AI, real-time market intelligence, and rigorous risk management into one seamless experience — whether you're trading on your phone or managing a multi-million dollar portfolio.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Bot,       title: 'AI-First Design',     desc: 'Every feature is built around AI — signals, execution, risk.',     color: '#627eea' },
                { icon: Shield,    title: 'Risk-Controlled',     desc: 'Multi-layer protection: drawdown limits, stop-loss, trailing.',    color: '#0ecb81' },
                { icon: TrendingUp, title: 'Proven Results',     desc: 'Average 68% win rate across all active bots over 12 months.',     color: '#f0b90b' },
                { icon: Globe,     title: 'Global Coverage',     desc: 'Trade crypto and stocks across 60+ countries, 24/7.',              color: '#f6465d' },
              ].map(f => (
                <div key={f.title} className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${f.color}15` }}>
                    <f.icon size={15} style={{ color: f.color }} />
                  </div>
                  <p className="text-sm font-semibold text-[#eaecef] mb-1">{f.title}</p>
                  <p className="text-[10px] text-[#848e9c] leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16 px-4 bg-[#161a1e]/30 border-y border-[#2b3139]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs text-[#f0b90b] font-bold uppercase tracking-widest mb-2">The Team</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#eaecef]">Built by World-Class Experts</h2>
            <p className="text-[#848e9c] mt-2 text-sm">Former engineers and analysts from Google, Goldman Sachs, JPMorgan, Coinbase & Citadel.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {team.map(m => (
              <div key={m.name} className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-5 text-center hover:border-[#f0b90b]/30 transition group">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 text-black text-base font-extrabold group-hover:scale-105 transition-transform"
                  style={{ background: m.color }}>
                  {m.avatar}
                </div>
                <p className="font-semibold text-[#eaecef] text-sm">{m.name}</p>
                <p className="text-[10px] text-[#f0b90b] font-medium mt-0.5 mb-2">{m.role}</p>
                <p className="text-[11px] text-[#848e9c] leading-relaxed">{m.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials / Trustpilot-style */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-[#0ecb81]/10 border border-[#0ecb81]/20 rounded-full px-4 py-1.5 text-xs text-[#0ecb81] font-semibold mb-4">
              <Star size={12} className="fill-[#0ecb81]" /> Trustpilot Rating
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#eaecef] mb-2">Trusted by Real Traders</h2>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} size={22} className="text-[#f0b90b] fill-[#f0b90b]" />
                  ))}
                </div>
                <span className="text-3xl font-extrabold text-[#eaecef] font-mono">{avgRating}</span>
              </div>
              <p className="text-xs text-[#848e9c]">Based on {testimonials.length} verified reviews</p>
            </div>
          </div>

          {/* Carousel */}
          <div className="relative">
            <div className="overflow-hidden rounded-2xl">
              <div className="relative">
                {testimonials.map((t, i) => (
                  <div key={t.id}
                    className={`transition-all duration-500 ${i === activeIdx ? 'block' : 'hidden'}`}>
                    <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-6 sm:p-8 mx-auto max-w-2xl">
                      <div className="flex items-center gap-2 mb-4">
                        <StarRating rating={t.rating} />
                        <span className="text-xs text-[#848e9c] ml-auto">Verified Review</span>
                      </div>
                      <p className="text-[#eaecef] text-base leading-relaxed mb-6 italic">
                        "{t.content}"
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-black text-xs font-bold flex-shrink-0"
                          style={{ background: t.avatar_color || '#f0b90b' }}>
                          {t.avatar_initials || t.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#eaecef]">{t.name}</p>
                          {t.role && <p className="text-xs text-[#848e9c]">{t.role}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <button onClick={prev} className="w-9 h-9 rounded-full border border-[#2b3139] hover:border-[#f0b90b]/40 flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] transition">
                <ChevronLeft size={16} />
              </button>
              <div className="flex gap-2">
                {testimonials.map((_, i) => (
                  <button key={i} onClick={() => setActiveIdx(i)}
                    className={`w-2 h-2 rounded-full transition ${i === activeIdx ? 'bg-[#f0b90b] w-5' : 'bg-[#2b3139]'}`} />
                ))}
              </div>
              <button onClick={next} className="w-9 h-9 rounded-full border border-[#2b3139] hover:border-[#f0b90b]/40 flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] transition">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 border-t border-[#2b3139]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#eaecef] mb-3">
            Ready to Trade Smarter?
          </h2>
          <p className="text-[#848e9c] mb-6">Join 12,000+ traders using FinAi to automate and optimize their portfolios.</p>
          <button onClick={() => navigate('/login')} className="inline-flex items-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold px-8 py-3 rounded-xl transition shadow-lg shadow-[#f0b90b]/20">
            Get Started Free <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2b3139] py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#f0b90b] flex items-center justify-center">
              <Zap size={11} className="text-black" />
            </div>
            <span className="text-[#f0b90b] font-bold text-sm">FinAi</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/')} className="text-xs text-[#4a5568] hover:text-[#848e9c] transition">Home</button>
            <button onClick={() => navigate('/about')} className="text-xs text-[#f0b90b] hover:text-[#d4a30a] transition">About</button>
            <button onClick={() => navigate('/terms')} className="text-xs text-[#4a5568] hover:text-[#848e9c] transition">Terms</button>
            <button onClick={() => navigate('/login')} className="text-xs text-[#4a5568] hover:text-[#848e9c] transition">Login</button>
          </div>
          <p className="text-xs text-[#4a5568]">© {new Date().getFullYear()} FinAi · Not financial advice</p>
        </div>
      </footer>
    </div>
  )
}
