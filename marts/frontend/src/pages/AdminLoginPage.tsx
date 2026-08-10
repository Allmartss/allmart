import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { login } from '../lib/api'
import toast from 'react-hot-toast'
import axios from 'axios'
import { ShieldCheck, Eye, EyeOff, Lock, Zap } from 'lucide-react'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth, token, user } = useAuthStore()
  const navigate = useNavigate()

  if (token && user?.is_admin) {
    navigate('/admin', { replace: true })
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      const res = await login(email, password)
      const data = res.data
      if (data.requires_2fa) {
        toast.error('2FA is required — please use the main login page.')
        return
      }
      const { access_token } = data
      const meRes = await axios.get('/marts/api/users/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      const me = meRes.data
      if (!me.is_admin) {
        toast.error('Access denied. This account does not have admin privileges.')
        return
      }
      setAuth(access_token, me)
      toast.success(`Welcome, ${me.first_name || 'Admin'}!`)
      navigate('/admin')
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined
      toast.error(msg ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] flex flex-col items-center justify-center px-4 py-10">
      <button onClick={() => navigate('/')} className="flex flex-col items-center mb-8 group">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-[#f6465d] group-hover:bg-[#d63850] flex items-center justify-center mb-4 shadow-lg shadow-[#f6465d]/30 transition-colors">
            <Zap size={32} className="text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#f6465d] rounded-full border-2 border-[#0b0e11] flex items-center justify-center">
            <ShieldCheck size={12} className="text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-extrabold text-[#eaecef] tracking-tight mt-2 group-hover:text-[#f6465d] transition-colors">
          FinAi <span className="text-[#f6465d]">Admin</span>
        </h1>
        <p className="text-[#848e9c] text-xs mt-1">Restricted — Authorized Personnel Only</p>
      </button>

      <div className="w-full max-w-sm bg-[#161a1e] border border-[#f6465d]/20 rounded-2xl p-6 shadow-2xl shadow-[#f6465d]/5">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={16} className="text-[#f6465d]" />
          <h2 className="text-base font-bold text-[#eaecef]">Admin Sign In</h2>
        </div>
        <p className="text-xs text-[#848e9c] mb-6">Enter your admin credentials to access the control panel.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#848e9c] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              placeholder="admin@example.com"
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f6465d] transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#848e9c] mb-1.5">Password</label>
            <div className="relative">
              <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#848e9c]" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl pl-9 pr-11 py-3 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f6465d] transition"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-[#eaecef] transition p-1"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#f6465d] hover:bg-[#d63850] disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-[#f6465d]/20 mt-1"
          >
            {loading ? 'Authenticating…' : 'Access Admin Panel'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-xs text-[#848e9c] hover:text-[#f0b90b] transition"
          >
            ← Back to user login
          </button>
        </div>
      </div>

      <p className="text-[10px] text-[#4a5568] mt-8 text-center">
        © {new Date().getFullYear()} FinAi Technologies. Admin access is logged and monitored.
      </p>
    </div>
  )
}
