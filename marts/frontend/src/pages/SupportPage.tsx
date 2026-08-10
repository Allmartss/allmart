import { useState, useEffect, useRef } from 'react'
import { createSupportTicket, getSupportTickets, getTicketMessages, replyToTicket } from '../lib/api'
import toast from 'react-hot-toast'
import { MessageSquare, Plus, Send, ChevronRight, Clock, CheckCircle, AlertCircle } from 'lucide-react'

interface Ticket {
  id: number; subject: string; status: string; priority: string
  created_at: string; updated_at: string; message_count: number
}
interface Message { id: number; message: string; is_admin: boolean; created_at: string }
interface TicketDetail { id: number; subject: string; status: string; priority: string; messages: Message[] }

function statusBadge(s: string) {
  if (s === 'resolved' || s === 'closed') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0ecb81]/10 text-[#0ecb81] inline-flex items-center gap-0.5"><CheckCircle size={9} />{s}</span>
  if (s === 'in_progress') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b] inline-flex items-center gap-0.5"><Clock size={9} />In Progress</span>
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2b3139] text-[#848e9c] inline-flex items-center gap-0.5"><Clock size={9} />Open</span>
}

function priorityBadge(p: string) {
  if (p === 'urgent') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f6465d]/10 text-[#f6465d]">Urgent</span>
  if (p === 'high') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b]">High</span>
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2b3139] text-[#848e9c] capitalize">{p}</span>
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selected, setSelected] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState('normal')
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchTickets = async () => {
    try {
      const res = await getSupportTickets()
      setTickets(Array.isArray(res.data) ? res.data : [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchTickets() }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selected?.messages])

  const openTicket = async (id: number) => {
    try {
      const res = await getTicketMessages(id)
      setSelected(res.data)
    } catch { toast.error('Failed to load ticket') }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    setSending(true)
    try {
      await createSupportTicket({ subject, message, priority })
      toast.success('Support ticket created')
      setSubject(''); setMessage(''); setPriority('normal'); setShowNew(false)
      await fetchTickets()
    } catch { toast.error('Failed to create ticket') }
    finally { setSending(false) }
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reply.trim() || !selected) return
    setSending(true)
    try {
      await replyToTicket(selected.id, reply)
      setReply('')
      const res = await getTicketMessages(selected.id)
      setSelected(res.data)
    } catch { toast.error('Failed to send reply') }
    finally { setSending(false) }
  }

  const inp = 'w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#eaecef]">Support Desk</h1>
        <button onClick={() => { setShowNew(true); setSelected(null) }}
          className="flex items-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black text-sm font-semibold px-4 py-2 rounded-xl transition">
          <Plus size={14} /> New Ticket
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ minHeight: 500 }}>
        {/* Ticket list */}
        <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#2b3139]">
            <p className="text-sm font-semibold text-[#eaecef]">My Tickets ({tickets.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-[#848e9c] text-sm">Loading...</div>
            ) : tickets.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2">
                <MessageSquare size={24} className="text-[#2b3139]" />
                <p className="text-sm text-[#848e9c]">No tickets yet</p>
                <button onClick={() => setShowNew(true)}
                  className="text-xs text-[#f0b90b] hover:underline">Create your first ticket</button>
              </div>
            ) : tickets.map(t => (
              <button key={t.id} onClick={() => { openTicket(t.id); setShowNew(false) }}
                className={`w-full text-left px-4 py-3 border-b border-[#2b3139]/50 hover:bg-[#1e2329] transition ${selected?.id === t.id ? 'bg-[#1e2329]' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-[#eaecef] leading-snug truncate flex-1">{t.subject}</p>
                  <ChevronRight size={12} className="text-[#848e9c] flex-shrink-0 mt-0.5" />
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {statusBadge(t.status)}
                  {priorityBadge(t.priority)}
                  <span className="text-[10px] text-[#4a5568] ml-auto">{new Date(t.updated_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Ticket chat / new form */}
        <div className="lg:col-span-2 bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden flex flex-col" style={{ minHeight: 400 }}>
          {showNew ? (
            <div className="flex-1 p-5">
              <h2 className="text-sm font-semibold text-[#eaecef] mb-4">New Support Ticket</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs text-[#848e9c] mb-1.5 block">Subject *</label>
                  <input value={subject} onChange={e => setSubject(e.target.value)} required
                    placeholder="Brief description of your issue" className={inp} />
                </div>
                <div>
                  <label className="text-xs text-[#848e9c] mb-1.5 block">Priority</label>
                  <div className="flex gap-2">
                    {['low', 'normal', 'high', 'urgent'].map(p => (
                      <button key={p} type="button" onClick={() => setPriority(p)}
                        className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition ${priority === p ? 'border-[#f0b90b] bg-[#f0b90b]/10 text-[#f0b90b]' : 'border-[#2b3139] text-[#848e9c]'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#848e9c] mb-1.5 block">Message *</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} required
                    rows={6} placeholder="Describe your issue in detail..."
                    className={`${inp} resize-none`} />
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={sending}
                    className="flex-1 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold py-3 rounded-xl text-sm transition">
                    {sending ? 'Submitting...' : 'Submit Ticket'}
                  </button>
                  <button type="button" onClick={() => setShowNew(false)}
                    className="px-4 py-3 border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] rounded-xl text-sm transition">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : selected ? (
            <>
              <div className="px-4 py-3 border-b border-[#2b3139]">
                <p className="text-sm font-semibold text-[#eaecef] truncate">{selected.subject}</p>
                <div className="flex gap-2 mt-1">{statusBadge(selected.status)}{priorityBadge(selected.priority)}</div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selected.messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.is_admin
                      ? 'bg-[#1e2329] border border-[#2b3139] text-[#eaecef]'
                      : 'bg-[#f0b90b]/10 border border-[#f0b90b]/20 text-[#eaecef]'}`}>
                      <p className="text-xs leading-relaxed">{msg.message}</p>
                      <p className="text-[10px] text-[#848e9c] mt-1.5">
                        {msg.is_admin ? 'Support Team' : 'You'} · {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              {selected.status !== 'closed' && selected.status !== 'resolved' && (
                <form onSubmit={handleReply} className="p-3 border-t border-[#2b3139] flex gap-2">
                  <input value={reply} onChange={e => setReply(e.target.value)} required
                    placeholder="Type your reply..."
                    className="flex-1 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition" />
                  <button type="submit" disabled={sending}
                    className="p-2.5 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black rounded-xl transition">
                    <Send size={15} />
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center">
                <MessageSquare size={24} className="text-[#f0b90b]" />
              </div>
              <p className="text-sm font-medium text-[#eaecef]">Select a ticket to view</p>
              <p className="text-xs text-[#848e9c]">Or create a new support ticket</p>
              <button onClick={() => setShowNew(true)}
                className="flex items-center gap-2 text-xs bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] px-4 py-2 rounded-xl transition">
                <Plus size={12} /> New Ticket
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 bg-[#161a1e] border border-[#2b3139] rounded-xl px-4 py-3">
        <AlertCircle size={14} className="text-[#f0b90b] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#848e9c]">Support tickets are typically answered within 24 hours. For urgent issues, mark as urgent priority.</p>
      </div>
    </div>
  )
}
