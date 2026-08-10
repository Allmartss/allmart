import { useNavigate } from 'react-router-dom'
import { Zap, ArrowLeft } from 'lucide-react'

const sections = [
  {
    title: '1. Acceptance of Terms',
    content: `By accessing or using FinAi ("the Platform"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the Platform. These terms apply to all users, including visitors, registered members, traders, and administrators.`,
  },
  {
    title: '2. Description of Services',
    content: `FinAi provides AI-powered trading tools, market intelligence, automated trading bots, wallet services, and related financial technology services. The Platform is provided "as is" for informational and automation purposes only. FinAi does not provide personalised investment advice.`,
  },
  {
    title: '3. Not Financial Advice',
    content: `Nothing on this Platform constitutes financial, investment, tax, or legal advice. All trading signals, bot outputs, market analysis, and AI-generated content are for informational purposes only. Trading financial instruments involves significant risk. Past performance is not indicative of future results. You may lose all of your invested capital.`,
  },
  {
    title: '4. User Eligibility',
    content: `You must be at least 18 years old and legally permitted to trade financial instruments in your jurisdiction to use the Platform. By registering, you confirm that you meet these requirements. FinAi reserves the right to terminate accounts that violate these eligibility requirements.`,
  },
  {
    title: '5. Account Registration and Security',
    content: `You are responsible for maintaining the confidentiality of your account credentials. You agree to notify FinAi immediately of any unauthorised use of your account. FinAi is not liable for losses arising from unauthorised account access due to your failure to secure your credentials. Two-factor authentication is strongly recommended.`,
  },
  {
    title: '6. KYC and Identity Verification',
    content: `To access certain features (withdrawals, higher limits, API keys), users must complete Know Your Customer (KYC) verification. FinAi may request government-issued identification and proof of address. KYC documents are processed by our compliance team and handled in accordance with applicable data protection laws.`,
  },
  {
    title: '7. Deposits, Withdrawals, and Transactions',
    content: `All deposits are subject to admin approval before credit. Withdrawal requests are processed within 1–5 business days, subject to KYC completion and applicable daily limits. FinAi reserves the right to hold or reverse transactions suspected of fraud, money laundering, or terms violations. Users are responsible for all applicable taxes on their trading profits.`,
  },
  {
    title: '8. Trading Bots and AI Tools',
    content: `Automated trading bots operate based on user-configured parameters. FinAi does not guarantee any profit or specific outcome from bot trading. Users acknowledge that market conditions can cause bots to incur losses, including total loss of allocated capital. All leveraged trading carries extreme risk. Max drawdown and stop-loss settings are strongly recommended.`,
  },
  {
    title: '9. Risk Warning for Leveraged Products',
    content: `Trading on margin and using leverage significantly increases the risk of loss. Positions may be liquidated if your account balance falls below the required margin. You should only trade with capital you can afford to lose. FinAi offers leverage options up to 1:1200 for qualified users; such leverage is extremely high-risk and suitable only for experienced professional traders.`,
  },
  {
    title: '10. Prohibited Activities',
    content: `You agree not to: (a) use the Platform for money laundering or illegal activities; (b) attempt to reverse-engineer, hack, or exploit the Platform; (c) create fake accounts or impersonate others; (d) manipulate markets or engage in wash trading; (e) share your API keys or account access with third parties; (f) use bots or automated scripts to scrape or abuse the Platform.`,
  },
  {
    title: '11. API Keys and Third-Party Exchanges',
    content: `FinAi allows users to connect third-party exchange accounts via API keys. FinAi is not responsible for any losses arising from exchange outages, API failures, or third-party platform issues. API keys should be granted only with trading permissions, never withdrawal permissions, unless explicitly required.`,
  },
  {
    title: '12. Privacy and Data Protection',
    content: `FinAi collects and processes personal data in accordance with our Privacy Policy. We implement industry-standard security measures including encryption, secure storage, and access controls. We do not sell your personal data to third parties. You may request deletion of your personal data by contacting support.`,
  },
  {
    title: '13. Intellectual Property',
    content: `All content on the Platform, including software, AI models, UI designs, algorithms, logos, and documentation, is the exclusive property of FinAi or its licensors. You may not copy, reproduce, distribute, or create derivative works without explicit written permission from FinAi.`,
  },
  {
    title: '14. Limitation of Liability',
    content: `To the maximum extent permitted by law, FinAi, its directors, employees, and partners shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of the Platform, including trading losses, data loss, system downtime, or security breaches. FinAi's total liability to any user shall not exceed the fees paid by that user in the preceding 30 days.`,
  },
  {
    title: '15. Service Availability',
    content: `FinAi aims to maintain 99.9% uptime but cannot guarantee uninterrupted service. Scheduled maintenance will be announced in advance where possible. Emergency maintenance may occur without notice. FinAi is not liable for losses caused by planned or unplanned service interruptions.`,
  },
  {
    title: '16. Account Termination',
    content: `FinAi reserves the right to suspend or terminate any account, at any time and for any reason, including but not limited to violations of these Terms. Upon termination, you will lose access to the Platform but retain the right to withdraw any remaining verified balance subject to compliance checks.`,
  },
  {
    title: '17. Changes to Terms',
    content: `FinAi reserves the right to update these Terms at any time. Material changes will be communicated via email or in-app notification at least 14 days before taking effect. Continued use of the Platform after changes constitute acceptance of the updated Terms.`,
  },
  {
    title: '18. Governing Law',
    content: `These Terms are governed by and construed in accordance with applicable international financial regulations. Any disputes arising from these Terms shall be resolved through binding arbitration, unless prohibited by local law. You irrevocably waive the right to class action proceedings.`,
  },
  {
    title: '19. Contact Us',
    content: `For questions about these Terms, please contact our support team via the in-app support system or email support@finai.com. Our compliance team typically responds within 2 business days.`,
  },
]

export default function TermsPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0b0e11] text-[#eaecef]">

      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-[#0b0e11]/95 backdrop-blur-md border-b border-[#2b3139]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 flex-shrink-0 group">
            <div className="w-7 h-7 rounded-lg bg-[#f0b90b] group-hover:bg-[#d4a30a] flex items-center justify-center shadow-lg shadow-[#f0b90b]/20 transition-colors">
              <Zap size={13} className="text-black" />
            </div>
            <span className="text-[#f0b90b] font-bold text-base tracking-tight">FinAi</span>
          </button>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/about')} className="text-sm text-[#848e9c] hover:text-[#eaecef] transition font-medium hidden sm:block">About</button>
            <button onClick={() => navigate('/login')} className="bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold text-sm px-4 py-1.5 rounded-lg transition">
              Get Started
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">

        {/* Back button */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-[#848e9c] hover:text-[#eaecef] transition mb-8">
          <ArrowLeft size={15} /> Back
        </button>

        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-[#f0b90b]/10 border border-[#f0b90b]/20 rounded-full px-4 py-1.5 text-xs text-[#f0b90b] font-semibold mb-4">
            Legal Document
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#eaecef] mb-3">Terms & Conditions</h1>
          <p className="text-[#848e9c] text-sm">
            Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <div className="mt-4 p-4 bg-[#f6465d]/10 border border-[#f6465d]/20 rounded-xl text-sm text-[#f6465d] leading-relaxed">
            <strong>Risk Warning:</strong> Trading financial instruments involves substantial risk of loss. AI trading tools do not guarantee profits. Only trade with capital you can afford to lose.
          </div>
        </div>

        {/* Table of Contents */}
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl p-5 mb-10">
          <p className="text-xs font-bold text-[#848e9c] uppercase tracking-widest mb-3">Contents</p>
          <div className="grid sm:grid-cols-2 gap-1">
            {sections.map((s, i) => (
              <a key={i} href={`#section-${i}`}
                className="text-xs text-[#848e9c] hover:text-[#f0b90b] transition py-0.5">
                {s.title}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((s, i) => (
            <div key={i} id={`section-${i}`} className="pb-8 border-b border-[#2b3139] last:border-0">
              <h2 className="text-base font-bold text-[#eaecef] mb-3">{s.title}</h2>
              <p className="text-sm text-[#848e9c] leading-relaxed">{s.content}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 p-6 bg-[#161a1e] border border-[#2b3139] rounded-2xl text-center">
          <p className="text-sm font-semibold text-[#eaecef] mb-2">Questions about these Terms?</p>
          <p className="text-xs text-[#848e9c] mb-4">Our team is happy to clarify anything — just reach out via the support portal.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button onClick={() => navigate('/login')} className="text-sm bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold px-5 py-2 rounded-xl transition">
              Create Account
            </button>
            <button onClick={() => navigate('/')} className="text-sm border border-[#2b3139] hover:border-[#f0b90b]/40 text-[#848e9c] hover:text-[#eaecef] font-semibold px-5 py-2 rounded-xl transition">
              Back to Home
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#2b3139] py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#f0b90b] flex items-center justify-center">
              <Zap size={11} className="text-black" />
            </div>
            <span className="text-[#f0b90b] font-bold text-sm">FinAi</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/')} className="text-xs text-[#4a5568] hover:text-[#848e9c] transition">Home</button>
            <button onClick={() => navigate('/about')} className="text-xs text-[#4a5568] hover:text-[#848e9c] transition">About</button>
            <button onClick={() => navigate('/terms')} className="text-xs text-[#f0b90b] hover:text-[#d4a30a] transition">Terms</button>
          </div>
          <p className="text-xs text-[#4a5568]">© {new Date().getFullYear()} FinAi · Not financial advice</p>
        </div>
      </footer>
    </div>
  )
}
