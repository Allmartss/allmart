import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { requestSubscription, getPricingPlans } from '../lib/api'
import toast from 'react-hot-toast'
import { Check, Zap, ArrowLeft, CreditCard, Wallet, Copy, RefreshCw } from 'lucide-react'

const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    basePrice: 500,
    highlight: false,
    features: ['10 AI bots', '5 API keys', 'Live market data', 'Telegram & WhatsApp alerts', 'Priority support'],
  },
  {
    id: 'elite',
    name: 'Elite',
    basePrice: 1000,
    highlight: true,
    features: ['20 AI bots', '20 API keys', 'VPS hosting included', 'Custom strategies', 'Dedicated support'],
  },
  {
    id: 'elite+',
    name: 'Elite+',
    basePrice: 2000,
    highlight: false,
    features: ['40 AI bots', '40 API keys', 'All Elite features', 'White-label option', 'SLA guarantee'],
  },
  {
    id: 'custom',
    name: 'Custom',
    basePrice: -1,
    highlight: false,
    features: ['Unlimited bots & keys', 'Custom infrastructure', 'On-premise option', 'Enterprise SLA', 'Dedicated team'],
  },
]

const BILLING_PERIODS = [
  { key: 'monthly', label: 'Monthly',   sublabel: null,   discount: 0,    months: 1   },
  { key: '6month',  label: '6 Months',  sublabel: '-10%', discount: 0.10, months: 6   },
  { key: 'yearly',  label: 'Yearly',    sublabel: '-30%', discount: 0.30, months: 12  },
]

const DEPOSIT_ADDRESS = 'TRX7xK9mPqNvBxAYT3jLQZwKpZ8uEfDmRe'

export default function SubscribePayPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [selectedPlan, setSelectedPlan] = useState<string>('elite')
  const [billingPeriod, setBillingPeriod] = useState<string>('monthly')
  const [payMethod, setPayMethod] = useState<'wallet' | 'crypto'>('wallet')
  const [autoRenew, setAutoRenew] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [apiPrices, setApiPrices] = useState<Record<string, number>>({})

  useEffect(() => {
    getPricingPlans()
      .then(r => {
        if (Array.isArray(r.data)) {
          const m: Record<string, number> = {}
          r.data.forEach((p: { name: string; price: number }) => { m[p.name] = p.price })
          setApiPrices(m)
        }
      })
      .catch(() => {})
  }, [])

  const plan = PLANS.find(p => p.id === selectedPlan)
  const period = BILLING_PERIODS.find(p => p.key === billingPeriod)!
  const balance = user?.balance_usdt ?? 0

  const apiMonthly = plan && plan.basePrice > 0 ? (apiPrices[plan.name] ?? plan.basePrice) : 0
  const monthlyPrice = apiMonthly
  const totalBeforeDiscount = monthlyPrice * period.months
  const discount = totalBeforeDiscount * period.discount
  const finalPrice = totalBeforeDiscount - discount
  const canAffordWallet = plan && plan.basePrice > 0 && balance >= finalPrice

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plan || plan.basePrice === -1) {
      toast('Contact our sales team at sales@finai.com', { icon: '📧' })
      return
    }
    setConfirming(true)
    try {
      await requestSubscription({
        plan: plan.id,
        period: billingPeriod,
        amount_usdt: finalPrice,
        payment_method: payMethod,
        auto_renew: autoRenew,
      })
      setSubmitted(true)
      toast.success('Subscription request submitted! Admin will activate your plan within 24h.')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
      toast.error(detail || 'Submission failed, please try again.')
    } finally {
      setConfirming(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-[#0ecb81]/10 flex items-center justify-center">
          <Check size={28} className="text-[#0ecb81]" />
        </div>
        <h2 className="text-xl font-bold text-[#eaecef]">Request Submitted!</h2>
        <p className="text-sm text-[#848e9c] max-w-xs">
          Your <span className="text-[#f0b90b] font-semibold">{plan?.name} ({period.label})</span> subscription request has been submitted.
          Admin will activate your plan within 24 hours.
        </p>
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 text-left w-full max-w-xs space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-[#848e9c]">Plan</span>
            <span className="text-[#eaecef] font-semibold">{plan?.name}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#848e9c]">Billing</span>
            <span className="text-[#eaecef]">{period.label}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#848e9c]">Total Paid</span>
            <span className="text-[#f0b90b] font-mono font-bold">${finalPrice.toLocaleString()} USDT</span>
          </div>
        </div>
        <div className="flex gap-3 mt-2">
          <button onClick={() => navigate('/app/dashboard')}
            className="bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold px-5 py-2.5 rounded-xl text-sm transition">
            Go to Dashboard
          </button>
          <button onClick={() => navigate('/app/support')}
            className="border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] font-medium px-5 py-2.5 rounded-xl text-sm transition">
            Contact Support
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-[#848e9c] hover:text-[#eaecef] rounded-lg hover:bg-[#161a1e] transition">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[#eaecef]">Subscribe</h1>
          <p className="text-xs text-[#848e9c]">Choose your plan and billing period</p>
        </div>
      </div>

      {/* Current sub + balance */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-[#848e9c]">Current Plan</p>
          <p className="text-sm font-bold text-[#eaecef] capitalize">{user?.subscription || 'Free'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#848e9c]">Wallet Balance</p>
          <p className="text-sm font-bold font-mono text-[#0ecb81]">${balance.toFixed(2)} USDT</p>
        </div>
      </div>

      {/* Billing period selector */}
      <div>
        <p className="text-xs font-bold text-[#eaecef] mb-3">Billing Period</p>
        <div className="grid grid-cols-3 gap-2">
          {BILLING_PERIODS.map(p => (
            <button key={p.key} onClick={() => setBillingPeriod(p.key)}
              className={`relative flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all ${billingPeriod === p.key ? 'border-[#f0b90b] bg-[#f0b90b]/5' : 'border-[#2b3139] hover:border-[#3c4451]'}`}>
              {p.sublabel && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-extrabold bg-[#0ecb81] text-black px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  {p.sublabel}
                </span>
              )}
              <span className={`text-xs font-semibold ${billingPeriod === p.key ? 'text-[#f0b90b]' : 'text-[#eaecef]'}`}>{p.label}</span>
              {p.discount > 0 && (
                <span className="text-[9px] text-[#0ecb81]">Save {Math.round(p.discount * 100)}%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan selector */}
      <div>
        <p className="text-xs font-bold text-[#eaecef] mb-3">Select Plan</p>
        <div className="grid grid-cols-2 gap-3">
          {PLANS.map(p => {
            const monthly = p.basePrice > 0 ? p.basePrice : 0
            const total = monthly * period.months
            const discounted = total - total * period.discount
            return (
              <button key={p.id} onClick={() => setSelectedPlan(p.id)}
                className={[
                  'relative text-left rounded-xl border p-4 transition-all flex flex-col gap-2',
                  selectedPlan === p.id ? 'border-[#f0b90b] bg-[#f0b90b]/5' : 'border-[#2b3139] bg-[#161a1e] hover:border-[#3c4451]',
                ].join(' ')}>
                {p.highlight && (
                  <span className="absolute -top-2 right-3 text-[9px] font-extrabold bg-[#f0b90b] text-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Popular
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${selectedPlan === p.id ? 'text-[#f0b90b]' : 'text-[#eaecef]'}`}>{p.name}</span>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${selectedPlan === p.id ? 'border-[#f0b90b] bg-[#f0b90b]' : 'border-[#2b3139]'}`}>
                    {selectedPlan === p.id && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                  </div>
                </div>
                {p.basePrice === -1 ? (
                  <p className="text-[#f0b90b] font-mono font-bold text-sm">Custom</p>
                ) : p.basePrice === 0 ? (
                  <p className="text-[#f0b90b] font-mono font-bold text-sm">Free</p>
                ) : (
                  <div>
                    {period.discount > 0 && (
                      <p className="text-xs text-[#4a5568] line-through font-mono">${total.toLocaleString()}</p>
                    )}
                    <p className="text-[#f0b90b] font-mono font-bold text-sm">
                      ${discounted.toLocaleString()}
                      <span className="text-[#848e9c] font-normal text-xs">/{period.label.toLowerCase()}</span>
                    </p>
                    <p className="text-[10px] text-[#848e9c]">${monthly}/mo</p>
                  </div>
                )}
                <ul className="space-y-1">
                  {p.features.slice(0, 3).map(f => (
                    <li key={f} className="text-[10px] text-[#848e9c] flex items-center gap-1">
                      <Check size={8} className="text-[#0ecb81] flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
      </div>

      {/* Price summary + payment method */}
      {plan && plan.basePrice > 0 && (
        <div className="space-y-4">
          {/* Price breakdown */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-[#eaecef]">Order Summary</p>
            <div className="flex justify-between text-xs">
              <span className="text-[#848e9c]">{plan.name} × {period.months} month{period.months > 1 ? 's' : ''}</span>
              <span className="text-[#eaecef] font-mono">${totalBeforeDiscount.toLocaleString()}</span>
            </div>
            {period.discount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-[#0ecb81]">Discount ({Math.round(period.discount * 100)}%)</span>
                <span className="text-[#0ecb81] font-mono">-${discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t border-[#2b3139] pt-2 mt-1">
              <span className="text-[#eaecef]">Total Due</span>
              <span className="text-[#f0b90b] font-mono">${finalPrice.toLocaleString()} USDT</span>
            </div>
          </div>

          {/* Auto-renew */}
          <label className="flex items-center gap-3 bg-[#161a1e] border border-[#2b3139] rounded-xl px-4 py-3 cursor-pointer">
            <div
              onClick={() => setAutoRenew(v => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors ${autoRenew ? 'bg-[#f0b90b]' : 'bg-[#2b3139]'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${autoRenew ? 'left-4' : 'left-0.5'}`} />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#eaecef]">Auto-renew</p>
              <p className="text-[10px] text-[#848e9c]">Automatically renew when your subscription expires</p>
            </div>
          </label>

          {/* Payment method */}
          <div>
            <p className="text-xs font-bold text-[#eaecef] mb-2">Payment Method</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPayMethod('wallet')}
                className={`flex items-center gap-2 rounded-xl border p-3.5 transition ${payMethod === 'wallet' ? 'border-[#f0b90b] bg-[#f0b90b]/5' : 'border-[#2b3139] bg-[#161a1e] hover:border-[#3c4451]'}`}>
                <Wallet size={16} className={payMethod === 'wallet' ? 'text-[#f0b90b]' : 'text-[#848e9c]'} />
                <div className="text-left">
                  <p className={`text-xs font-semibold ${payMethod === 'wallet' ? 'text-[#f0b90b]' : 'text-[#eaecef]'}`}>Platform Wallet</p>
                  <p className="text-[10px] text-[#848e9c]">Balance: ${balance.toFixed(0)}</p>
                </div>
              </button>
              <button onClick={() => setPayMethod('crypto')}
                className={`flex items-center gap-2 rounded-xl border p-3.5 transition ${payMethod === 'crypto' ? 'border-[#f0b90b] bg-[#f0b90b]/5' : 'border-[#2b3139] bg-[#161a1e] hover:border-[#3c4451]'}`}>
                <CreditCard size={16} className={payMethod === 'crypto' ? 'text-[#f0b90b]' : 'text-[#848e9c]'} />
                <div className="text-left">
                  <p className={`text-xs font-semibold ${payMethod === 'crypto' ? 'text-[#f0b90b]' : 'text-[#eaecef]'}`}>Crypto Transfer</p>
                  <p className="text-[10px] text-[#848e9c]">USDT / BTC / ETH</p>
                </div>
              </button>
            </div>
          </div>

          {payMethod === 'wallet' && (
            <div className={`rounded-xl border p-4 ${canAffordWallet ? 'border-[#0ecb81]/20 bg-[#0ecb81]/5' : 'border-[#f6465d]/20 bg-[#f6465d]/5'}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#848e9c]">Subscription cost</p>
                <p className="text-sm font-bold font-mono text-[#eaecef]">${finalPrice.toLocaleString()} USDT</p>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-[#848e9c]">Your balance</p>
                <p className={`text-sm font-bold font-mono ${canAffordWallet ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>${balance.toFixed(2)} USDT</p>
              </div>
              {!canAffordWallet && (
                <p className="text-[10px] text-[#f6465d] mt-2">
                  Insufficient balance. <button onClick={() => navigate('/app/wallet')} className="underline">Deposit now →</button>
                </p>
              )}
            </div>
          )}

          {payMethod === 'crypto' && (
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-[#eaecef]">Send exactly <span className="text-[#f0b90b]">${finalPrice.toLocaleString()} USDT (TRC20)</span> to:</p>
              <div className="flex items-center gap-2 bg-[#0b0e11] rounded-lg px-3 py-2 border border-[#2b3139]">
                <code className="text-xs font-mono text-[#eaecef] flex-1 break-all">{DEPOSIT_ADDRESS}</code>
                <button onClick={() => { navigator.clipboard.writeText(DEPOSIT_ADDRESS); toast.success('Address copied!') }}
                  className="flex-shrink-0 text-[#848e9c] hover:text-[#f0b90b] transition">
                  <Copy size={12} />
                </button>
              </div>
              <p className="text-[10px] text-[#848e9c]">After sending, click below. Admin will verify and activate within 24 hours.</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <button type="submit"
              disabled={confirming || (payMethod === 'wallet' && !canAffordWallet)}
              className="w-full bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
              {confirming ? <><RefreshCw size={14} className="animate-spin" /> Submitting…</> : <><Zap size={14} /> Subscribe to {plan.name} — ${finalPrice.toLocaleString()} USDT</>}
            </button>
          </form>
        </div>
      )}

      {/* Custom plan */}
      {plan && plan.basePrice === -1 && (
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5 text-center space-y-3">
          <Zap size={24} className="text-[#f0b90b] mx-auto" />
          <p className="text-sm font-semibold text-[#eaecef]">Custom Enterprise Plan</p>
          <p className="text-xs text-[#848e9c]">Contact our sales team for a tailored plan with unlimited bots, custom infrastructure, and enterprise SLA.</p>
          <a href="mailto:sales@finai.com"
            className="inline-flex items-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold px-6 py-2.5 rounded-xl text-sm transition">
            Contact Sales
          </a>
        </div>
      )}
    </div>
  )
}
