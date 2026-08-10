import { useState, useEffect } from 'react'
import { Plus, Check, Trash2, Calendar, Clock, ChevronLeft, ChevronRight, Flag, Bell, BellOff } from 'lucide-react'

interface Task {
  id: number
  title: string
  date: string
  time?: string
  priority: 'low' | 'medium' | 'high'
  category: 'trading' | 'research' | 'personal' | 'reminder'
  done: boolean
  notes?: string
}

const PRIORITY_COLORS = {
  low:    { text: 'text-[#848e9c]', bg: 'bg-[#2b3139]',       border: 'border-[#3c4451]',     dot: 'bg-[#848e9c]' },
  medium: { text: 'text-[#f0b90b]', bg: 'bg-[#f0b90b]/10',    border: 'border-[#f0b90b]/20',  dot: 'bg-[#f0b90b]' },
  high:   { text: 'text-[#f6465d]', bg: 'bg-[#f6465d]/10',    border: 'border-[#f6465d]/20',  dot: 'bg-[#f6465d]' },
}

const CATEGORY_COLORS: Record<Task['category'], string> = {
  trading:  'text-[#0ecb81]',
  research: 'text-[#3b82f6]',
  personal: 'text-[#a78bfa]',
  reminder: 'text-[#f0b90b]',
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

const toDateStr = (d: Date) => d.toISOString().split('T')[0]

const today = new Date()
const todayStr = toDateStr(today)
const tomorrowStr = toDateStr(new Date(today.getTime() + 86400000))

const INITIAL_TASKS: Task[] = [
  { id: 1, title: 'Review BTC resistance levels',    date: todayStr,    time: '09:00', priority: 'high',   category: 'trading',  done: false, notes: 'Check $68k and $70k zones' },
  { id: 2, title: 'Read daily market news',          date: todayStr,    time: '08:30', priority: 'medium', category: 'research', done: true  },
  { id: 3, title: 'Set stop-loss orders for ETH',    date: todayStr,    time: '10:00', priority: 'high',   category: 'trading',  done: false },
  { id: 4, title: 'Deposit funds to wallet',         date: tomorrowStr, priority:      'medium', category: 'reminder', done: false },
  { id: 5, title: 'Review AI bot performance report',date: tomorrowStr, time: '14:00', priority: 'low',    category: 'research', done: false },
]

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS)
  const [showAdd, setShowAdd] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '', date: selectedDate, time: '', priority: 'medium' as Task['priority'],
    category: 'trading' as Task['category'], notes: '',
  })
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  )

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifPermission(perm)
  }

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission === 'default') {
      requestNotifPermission()
    }
  }, [])

  useEffect(() => {
    if (!('Notification' in window)) return
    const checkDueTasks = () => {
      if (Notification.permission !== 'granted') return
      const now = new Date()
      tasks.forEach(task => {
        if (task.done || task.priority !== 'high' || !task.time) return
        const taskDateTime = new Date(`${task.date}T${task.time}:00`)
        const diffMs = taskDateTime.getTime() - now.getTime()
        if (diffMs >= -60_000 && diffMs <= 300_000) {
          const key = `notif-${task.id}-${task.date}`
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1')
            const minLeft = Math.ceil(diffMs / 60_000)
            new Notification('High Priority Task', {
              body: diffMs > 0
                ? `${task.title} — due in ${minLeft} min`
                : `${task.title} — due NOW`,
              icon: '/vite.svg',
            })
          }
        }
      })
    }
    checkDueTasks()
    const id = setInterval(checkDueTasks, 30_000)
    return () => clearInterval(id)
  }, [tasks])

  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay    = new Date(year, month, 1).getDay()

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const tasksOnDate    = (dateStr: string) => tasks.filter(t => t.date === dateStr)
  const selectedTasks  = tasksOnDate(selectedDate)
  const pendingToday   = tasks.filter(t => t.date === todayStr && !t.done).length

  const toggleTask = (id: number) => setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t))
  const deleteTask = (id: number) => setTasks(ts => ts.filter(t => t.id !== id))

  const openAdd = () => {
    setNewTask({ title: '', date: selectedDate, time: '', priority: 'medium', category: 'trading', notes: '' })
    setShowAdd(true)
  }

  const addTask = () => {
    if (!newTask.title.trim()) return
    setTasks(ts => [...ts, {
      id: Date.now(),
      title:    newTask.title.trim(),
      date:     newTask.date || selectedDate,
      time:     newTask.time || undefined,
      priority: newTask.priority,
      category: newTask.category,
      done:     false,
      notes:    newTask.notes || undefined,
    }])
    setShowAdd(false)
  }

  const formatSelectedDate = () => {
    if (selectedDate === todayStr) return 'Today'
    if (selectedDate === tomorrowStr) return 'Tomorrow'
    const d = new Date(selectedDate + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const inp = 'w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition'

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#eaecef]">Calendar & Tasks</h1>
          {pendingToday > 0 && (
            <p className="text-xs text-[#848e9c] mt-0.5">
              <span className="text-[#f0b90b] font-semibold">{pendingToday}</span> pending task{pendingToday !== 1 ? 's' : ''} today
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {'Notification' in window && notifPermission !== 'granted' && (
            <button onClick={requestNotifPermission}
              title="Enable push notifications for high-priority tasks"
              className="flex items-center gap-1.5 border border-[#2b3139] hover:border-[#f0b90b]/40 text-[#848e9c] hover:text-[#f0b90b] text-xs font-medium px-3 py-2 rounded-xl transition">
              {notifPermission === 'denied' ? <BellOff size={13} /> : <Bell size={13} />}
              {notifPermission === 'denied' ? 'Blocked' : 'Enable Alerts'}
            </button>
          )}
          {'Notification' in window && notifPermission === 'granted' && (
            <span className="flex items-center gap-1 text-[10px] text-[#0ecb81] bg-[#0ecb81]/10 border border-[#0ecb81]/20 px-2.5 py-1.5 rounded-lg">
              <Bell size={10} /> Alerts on
            </span>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-1.5 bg-[#f0b90b] hover:bg-[#d4a30a] text-black text-xs font-bold px-3 py-2 rounded-xl transition">
            <Plus size={13} /> Add Task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ── Calendar grid ── */}
        <div className="lg:col-span-2 bg-[#161a1e] border border-[#2b3139] rounded-2xl p-4 self-start">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth}
              className="w-7 h-7 rounded-lg hover:bg-[#2b3139] flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] transition">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-bold text-[#eaecef]">{MONTHS[month]} {year}</span>
            <button onClick={nextMonth}
              className="w-7 h-7 rounded-lg hover:bg-[#2b3139] flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] transition">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-[#4a5568] py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day     = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isToday    = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const dayTasks   = tasksOnDate(dateStr)
              const hasTasks   = dayTasks.length > 0
              const hasHigh    = dayTasks.some(t => t.priority === 'high' && !t.done)
              return (
                <button key={day} onClick={() => setSelectedDate(dateStr)}
                  className={[
                    'relative aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all',
                    isSelected
                      ? 'bg-[#f0b90b] text-black font-bold'
                      : isToday
                        ? 'bg-[#f0b90b]/15 text-[#f0b90b] font-bold border border-[#f0b90b]/30'
                        : 'text-[#848e9c] hover:bg-[#2b3139] hover:text-[#eaecef]',
                  ].join(' ')}>
                  {day}
                  {hasTasks && !isSelected && (
                    <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${hasHigh ? 'bg-[#f6465d]' : 'bg-[#0ecb81]'}`} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#2b3139]">
            <div className="flex items-center gap-1.5 text-[10px] text-[#848e9c]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] flex-shrink-0" /> Has tasks
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[#848e9c]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f6465d] flex-shrink-0" /> High priority
            </div>
          </div>
        </div>

        {/* ── Task list ── */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#eaecef]">{formatSelectedDate()}</p>
              <p className="text-xs text-[#848e9c] mt-0.5">
                {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}
              </p>
            </div>
            {selectedTasks.length > 0 && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-[#0ecb81] font-bold">{selectedTasks.filter(t => t.done).length} done</span>
                <span className="text-[#2b3139]">/</span>
                <span className="text-[#848e9c]">{selectedTasks.filter(t => !t.done).length} pending</span>
              </div>
            )}
          </div>

          {/* Empty state */}
          {selectedTasks.length === 0 && !showAdd && (
            <div className="bg-[#161a1e] border border-dashed border-[#2b3139] rounded-2xl py-14 flex flex-col items-center gap-3">
              <Calendar size={28} className="text-[#2b3139]" />
              <p className="text-sm text-[#848e9c]">No tasks for this day</p>
              <button onClick={openAdd}
                className="flex items-center gap-1.5 text-xs text-[#f0b90b] hover:text-[#d4a30a] font-medium transition">
                <Plus size={12} /> Add a task
              </button>
            </div>
          )}

          {/* Task cards */}
          {selectedTasks.length > 0 && (
            <div className="space-y-2">
              {[...selectedTasks].sort((a, b) => {
                if (a.done !== b.done) return a.done ? 1 : -1
                const po = { high: 0, medium: 1, low: 2 }
                return po[a.priority] - po[b.priority]
              }).map(task => {
                const pc = PRIORITY_COLORS[task.priority]
                return (
                  <div key={task.id} className={[
                    'bg-[#161a1e] border rounded-xl p-4 transition-all group',
                    task.done ? 'opacity-55 border-[#2b3139]' : 'border-[#2b3139] hover:border-[#3c4451]',
                  ].join(' ')}>
                    <div className="flex items-start gap-3">
                      <button onClick={() => toggleTask(task.id)}
                        className={[
                          'mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                          task.done
                            ? 'bg-[#0ecb81] border-[#0ecb81]'
                            : 'border-[#3c4451] hover:border-[#0ecb81]',
                        ].join(' ')}>
                        {task.done && <Check size={10} className="text-black" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-snug ${task.done ? 'line-through text-[#4a5568]' : 'text-[#eaecef]'}`}>
                          {task.title}
                        </p>
                        {task.notes && (
                          <p className="text-[11px] text-[#4a5568] mt-0.5 truncate">{task.notes}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {task.time && (
                            <span className="flex items-center gap-0.5 text-[10px] text-[#848e9c]">
                              <Clock size={9} /> {task.time}
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${pc.bg} ${pc.text} border ${pc.border}`}>
                            <Flag size={8} /> {task.priority}
                          </span>
                          <span className={`text-[10px] font-medium capitalize ${CATEGORY_COLORS[task.category]}`}>
                            {task.category}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => deleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 text-[#4a5568] hover:text-[#f6465d] transition p-1 flex-shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add task form */}
          {showAdd && (
            <div className="bg-[#1e2329] border border-[#f0b90b]/30 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-[#f0b90b]">New Task</p>
              <input
                value={newTask.title}
                onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))}
                placeholder="Task title…"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && addTask()}
                className={inp}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={newTask.date}
                  onChange={e => setNewTask(t => ({ ...t, date: e.target.value }))}
                  className="bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition"
                />
                <input
                  type="time"
                  value={newTask.time}
                  onChange={e => setNewTask(t => ({ ...t, time: e.target.value }))}
                  className="bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newTask.priority}
                  onChange={e => setNewTask(t => ({ ...t, priority: e.target.value as Task['priority'] }))}
                  className="bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition">
                  <option value="low">Low priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="high">High priority</option>
                </select>
                <select
                  value={newTask.category}
                  onChange={e => setNewTask(t => ({ ...t, category: e.target.value as Task['category'] }))}
                  className="bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition">
                  <option value="trading">Trading</option>
                  <option value="research">Research</option>
                  <option value="reminder">Reminder</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
              <input
                value={newTask.notes}
                onChange={e => setNewTask(t => ({ ...t, notes: e.target.value }))}
                placeholder="Notes (optional)…"
                className={inp}
              />
              <div className="flex gap-2">
                <button onClick={addTask}
                  className="flex-1 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-bold py-2.5 rounded-xl text-sm transition">
                  Add Task
                </button>
                <button onClick={() => setShowAdd(false)}
                  className="px-4 border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] hover:border-[#3c4451] rounded-xl text-sm transition">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
