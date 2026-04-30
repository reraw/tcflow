import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useDeals, useReminderDismissals, useTasks, useAgents, useAllPayments } from '../hooks/useSupabase'
import { formatCurrency, formatShortDate, formatDate, generateReminders, REMINDER_COLORS, labelForReminderKey, colorForReminderKey } from '../lib/helpers'
import { thisMonthMetrics, businessOverviewMetrics } from '../lib/dashboardMetrics'
import { TrendingUp, Home, XCircle, CheckCircle, DollarSign, Clock, BarChart3, Calendar, Plus, Trash2, Search, X } from 'lucide-react'
import { format, addMonths, parseISO, startOfMonth, endOfMonth, startOfDay, isWithinInterval } from 'date-fns'
import DealDetailModal from '../components/deals/DealDetailModal'

// StackedBar — renders a percentage-based stacked progress bar with optional
// % label centered in each segment. Labels are suppressed when the rendered
// pixel width is below ~40px, regardless of underlying percentage. Uses
// ResizeObserver so the threshold reacts to viewport changes.
const MIN_LABEL_PX = 40
function StackedBar({ segments }) {
  const ref = useRef(null)
  const [pxWidth, setPxWidth] = useState(0)

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const update = () => setPxWidth(el.getBoundingClientRect().width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} className="w-full h-5 bg-gray-100 rounded-full overflow-hidden flex">
      {segments.map((s, i) => {
        if (!s || s.pct <= 0) return null
        const segPx = (pxWidth * s.pct) / 100
        const showLabel = !s.hideLabel && segPx >= MIN_LABEL_PX
        const isLightText = !s.textColor || s.textColor.includes('white')
        return (
          <div
            key={i}
            className={`${s.color} h-full flex items-center justify-center`}
            style={{ width: `${s.pct}%` }}
          >
            {showLabel && (
              <span
                className={`text-[10px] font-semibold ${s.textColor || 'text-white'}`}
                style={isLightText ? { textShadow: '0 1px 2px rgba(0,0,0,0.35)' } : undefined}
              >
                {Math.round(s.pct)}%
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [deals, setDeals] = useState([])
  const [customDates, setCustomDates] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const { dismissals, isDismissed, getCompletedAt, toggleDismissal } = useReminderDismissals()
  const { updateDeal } = useDeals()
  const { tasks, createTask, toggleTask } = useTasks()
  const { agents } = useAgents()
  const { payments: allPayments } = useAllPayments()

  // Inline date editing for overdue close of escrow
  const [editingDateId, setEditingDateId] = useState(null)
  const [newDateValue, setNewDateValue] = useState('')

  // New task form
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ deal_id: '', description: '', due_date: '' })

  // Reminders UI state
  const [reminderTab, setReminderTab] = useState('active')
  const [reminderSearch, setReminderSearch] = useState('')
  const [selectedDeal, setSelectedDeal] = useState(null)

  const agentMap = useMemo(() => {
    const m = {}
    agents.forEach(a => { m[a.id] = a.name })
    return m
  }, [agents])
  const getAgentName = (id) => agentMap[id] || null

  useEffect(() => {
    const fetch = async () => {
      const [{ data: d }, { data: cd }, { data: h }] = await Promise.all([
        supabase.from('deals').select('*').order('created_at', { ascending: false }),
        supabase.from('custom_dates').select('*'),
        supabase.from('deal_history').select('*, deals(address)').order('created_at', { ascending: false }).limit(10),
      ])
      setDeals(d || [])
      setCustomDates(cd || [])
      setHistory(h || [])
      setLoading(false)
    }
    fetch()
  }, [])

  // ALL dashboard metrics derive from the canonical helpers — no inlining.
  // See src/lib/dashboardMetrics.js for the spec these implement.
  const tm = useMemo(() => thisMonthMetrics(deals, allPayments), [deals, allPayments])
  const bo = useMemo(() => businessOverviewMetrics(deals, allPayments), [deals, allPayments])

  const dealLabel = (n) => `${n} ${n === 1 ? 'deal' : 'deals'}`

  // Click handlers — navigate to /deals with URL filters.
  const goToMonthFilter = (paid_status) => {
    const params = new URLSearchParams()
    params.set('month', tm.monthKey)
    if (paid_status) params.set('paid_status', paid_status)
    navigate(`/deals?${params.toString()}`)
  }
  const goToStillToClose = () => {
    // Still to close = month + not closed. We use a synthetic compound filter
    // value so the Deals page knows to filter to non-closed deals and label
    // the pill correctly.
    navigate(`/deals?month=${tm.monthKey}&paid_status=not_closed`)
  }

  // Active deals list for task dropdown (existing feature).
  const active = deals.filter(d => d.status === 'active')

  const projectedMonths = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const monthDate = addMonths(startOfMonth(now), i)
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)
    const inMonth = (d) => {
      if (!d.close_date) return false
      const cd = parseISO(d.close_date)
      return isWithinInterval(cd, { start: monthStart, end: monthEnd })
    }
    const isCurrent = i === 0
    // For the current month, include closed deals too so "X of Y closed" is meaningful.
    const monthDeals = isCurrent
      ? deals.filter(d => d.status !== 'cancelled' && inMonth(d))
      : active.filter(inMonth)
    const monthClosedCount = isCurrent ? monthDeals.filter(d => d.status === 'closed').length : 0
    projectedMonths.push({
      label: format(monthDate, 'MMM yyyy'),
      isCurrentMonth: isCurrent,
      dealCount: monthDeals.length,
      revenue: monthDeals.reduce((s, d) => s + (Number(d.tc_fee) || 0), 0),
      closedCount: monthClosedCount,
    })
  }

  // ── Reminders: derive Active / Completed / Search ──
  const isSearching = reminderSearch.trim().length > 0
  const searchQ = reminderSearch.trim().toLowerCase()
  const todayStart = startOfDay(new Date())

  const customDatesById = useMemo(() => {
    const m = {}
    customDates.forEach(cd => { m[cd.id] = cd })
    return m
  }, [customDates])

  // Derive reminders for the view. 14-day window unless searching; include
  // closed/cancelled deals only when searching so historical items surface.
  const derivedReminders = useMemo(() => {
    if (isSearching) return generateReminders(deals, customDates, { noDateLimit: true, includeClosed: true })
    return generateReminders(deals, customDates)
  }, [deals, customDates, isSearching])

  // Build a representation for historical completions (dismissal rows that
  // don't match a currently-derivable reminder). Used by Completed tab +
  // search to cover items whose deals have closed long ago.
  const dealsById = useMemo(() => {
    const m = {}
    deals.forEach(d => { m[d.id] = d })
    return m
  }, [deals])

  const dismissalRows = useMemo(() => {
    return dismissals
      .map(d => {
        const deal = dealsById[d.deal_id]
        const address = deal?.address || d.deals?.address
        if (!address) return null
        const color = colorForReminderKey(d.reminder_key)
        const label = labelForReminderKey(d.reminder_key, address, customDatesById)
        return {
          key: d.reminder_key,
          label,
          color,
          deal: deal || { id: d.deal_id, address },
          completedAt: d.completed_at,
          isDismissal: true,
          date: d.completed_at ? parseISO(d.completed_at) : null,
          daysOut: null,
          overdue: false,
        }
      })
      .filter(Boolean)
  }, [dismissals, dealsById, customDatesById])

  // Active view: derived reminders minus completed-before-today
  const activeReminders = useMemo(() => {
    return derivedReminders.filter(r => {
      const ts = getCompletedAt(r.deal.id, r.key)
      if (!ts) return true
      return parseISO(ts) >= todayStart // completed today → still visible
    })
  }, [derivedReminders, dismissals])

  // Completed view: show dismissals (historical), with Active's "completed today"
  // items surfacing here too (they exist in dismissals naturally).
  const completedReminders = useMemo(() => {
    return [...dismissalRows].sort((a, b) => {
      if (!a.completedAt) return 1
      if (!b.completedAt) return -1
      return b.completedAt.localeCompare(a.completedAt)
    })
  }, [dismissalRows])

  // Search: union of active-side derived (unbounded date window) + all dismissals.
  // Dedupe by key — derived representation wins because it has daysOut/date.
  const searchReminders = useMemo(() => {
    if (!isSearching) return []
    const byKey = new Map()
    derivedReminders.forEach(r => { byKey.set(r.key, r) })
    dismissalRows.forEach(r => { if (!byKey.has(r.key)) byKey.set(r.key, r) })
    return [...byKey.values()].filter(r => r.deal?.address?.toLowerCase().includes(searchQ))
  }, [isSearching, derivedReminders, dismissalRows, searchQ])

  const remindersToShow = isSearching
    ? searchReminders
    : reminderTab === 'active' ? activeReminders : completedReminders

  const handleMarkClosed = async (dealId) => {
    await updateDeal(dealId, { status: 'closed' })
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, status: 'closed' } : d))
  }

  const handleUpdateDate = async (dealId) => {
    if (!newDateValue) return
    await updateDeal(dealId, { close_date: newDateValue })
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, close_date: newDateValue } : d))
    setEditingDateId(null)
    setNewDateValue('')
  }

  const handleCreateTask = async () => {
    if (!newTask.deal_id || !newTask.description) return
    await createTask({
      deal_id: newTask.deal_id,
      description: newTask.description,
      due_date: newTask.due_date || null,
    })
    setNewTask({ deal_id: '', description: '', due_date: '' })
    setShowNewTask(false)
  }

  const kpiTiles = [
    { label: 'Listings', value: bo.listingsCount, icon: Home, color: 'text-blue-600 bg-blue-50', filter: 'listing' },
    { label: 'Under Contract', value: bo.activeCount, icon: TrendingUp, color: 'text-green-600 bg-green-50', filter: 'active' },
    { label: 'Cancelled', value: bo.cancelledCount, icon: XCircle, color: 'text-red-600 bg-red-50', filter: 'cancelled' },
    { label: 'Closed YTD', value: bo.closedYTDCount, icon: CheckCircle, color: 'text-gray-600 bg-gray-100', filter: 'closed' },
    { label: 'Collected', value: formatCurrency(bo.collected), icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
  ]

  const kpiRow2 = [
    { label: 'Outstanding Fees', subtitle: 'Outstanding balance on closed deals (all-time)', value: formatCurrency(bo.outstandingFees), icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Under Contract', subtitle: 'Projected TC fees from active deals', value: formatCurrency(bo.underContractProjected), icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { label: 'Potential', subtitle: 'Projected fees from listings', value: formatCurrency(bo.potentialFees), icon: BarChart3, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Total Pipeline', subtitle: 'Outstanding + active + listings combined', value: formatCurrency(bo.totalPipeline), icon: DollarSign, color: 'text-purple-600 bg-purple-50' },
  ]

  // Active deals for task dropdown
  const activeDeals = deals.filter(d => d.status !== 'closed' && d.status !== 'cancelled')

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Loading...</div></div>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

      {/* Current-Month Revenue Panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={18} className="text-indigo-500" />
          <h3 className="text-lg font-semibold text-gray-900">This Month — {tm.monthLabel}</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button onClick={() => goToMonthFilter(null)} className="text-left rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 p-3 transition-colors cursor-pointer">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 size={14} className="text-indigo-500" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Projected</span>
            </div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(tm.projected)}</div>
            <div className="text-xs text-gray-500 mt-0.5">{dealLabel(tm.projectedCount)}</div>
          </button>
          <button onClick={() => goToMonthFilter('paid')} className="text-left rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 p-3 transition-colors cursor-pointer">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle size={14} className="text-green-600" />
              <span className="text-xs font-medium text-green-700 uppercase tracking-wide">Closed & Paid</span>
            </div>
            <div className="text-xl font-bold text-green-900">{formatCurrency(tm.closedAndPaid)}</div>
            <div className="text-xs text-green-700/70 mt-0.5">{dealLabel(tm.closedAndPaidCount)} fully paid</div>
          </button>
          <button onClick={() => goToMonthFilter('outstanding')} className="text-left rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 p-3 transition-colors cursor-pointer">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={14} className="text-amber-600" />
              <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">Awaiting Payment</span>
            </div>
            <div className="text-xl font-bold text-amber-900">{formatCurrency(tm.awaitingPayment)}</div>
            <div className="text-xs text-amber-700/70 mt-0.5">{dealLabel(tm.awaitingCount)} outstanding</div>
          </button>
          <button onClick={goToStillToClose} className="text-left rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 p-3 transition-colors cursor-pointer">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={14} className="text-indigo-600" />
              <span className="text-xs font-medium text-indigo-700 uppercase tracking-wide">Still to Close</span>
            </div>
            <div className="text-xl font-bold text-indigo-900">{formatCurrency(tm.stillToClose)}</div>
            <div className="text-xs text-indigo-700/70 mt-0.5">{dealLabel(tm.stillToCloseCount)} pending</div>
          </button>
        </div>

        {/* Closures bar (top): how many deals have actually closed.
            Only the filled segment shows a label; trailing area is bare bg. */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="font-medium text-gray-600">Closures</span>
            <span>{tm.closedCount} of {tm.projectedCount} {tm.projectedCount === 1 ? 'deal' : 'deals'} closed</span>
          </div>
          <StackedBar segments={[
            { pct: tm.closuresPct, color: 'bg-gray-700', textColor: 'text-white' },
          ]} />
        </div>

        {/* Collections bar (below): money in, vs awaiting payment, vs still pending.
            Three segments sum exactly to projected (100%). */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="font-medium text-gray-600">Collections</span>
            <span className="text-gray-400 truncate">
              <span className="text-green-700">{formatCurrency(tm.segments.collected)}</span> collected
              <span className="text-gray-400"> · </span>
              <span className="text-amber-700">{formatCurrency(tm.segments.awaiting)}</span> awaiting
              <span className="text-gray-400"> · </span>
              <span className="text-gray-500">{formatCurrency(tm.segments.pending)}</span> pending
            </span>
          </div>
          <StackedBar segments={[
            { pct: tm.segmentsPct.closedFull + tm.segmentsPct.closedReceived + tm.segmentsPct.notClosedReceived, color: 'bg-green-500', textColor: 'text-white' },
            { pct: tm.segmentsPct.closedOutstanding, color: 'bg-amber-400', textColor: 'text-amber-900' },
            { pct: tm.segmentsPct.notClosedRemaining, color: 'bg-gray-200', textColor: 'text-gray-700' },
          ]} />
        </div>
      </div>

      {/* Business Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-indigo-500" />
          <h3 className="text-lg font-semibold text-gray-900">Business Overview</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpiTiles.map(tile => (
            <button key={tile.label} onClick={() => tile.filter && navigate(`/deals?status=${tile.filter}`)} className={`rounded-lg border border-gray-200 bg-gray-50 p-3 text-left hover:bg-gray-100 transition-colors ${tile.filter ? 'cursor-pointer' : 'cursor-default'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`p-1 rounded ${tile.color}`}><tile.icon size={14} /></div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tile.label}</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{tile.value}</div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          {kpiRow2.map(tile => (
            <div key={tile.label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`p-1 rounded ${tile.color}`}><tile.icon size={14} /></div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tile.label}</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{tile.value}</div>
              <p className="text-xs text-gray-400 mt-0.5">{tile.subtitle}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Projected Closings */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={18} className="text-indigo-500" />
          <h3 className="text-lg font-semibold text-gray-900">Projected Closings</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {projectedMonths.map(m => (
            <div key={m.label} className={`rounded-lg border p-3 text-center ${m.isCurrentMonth ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-gray-50'}`}>
              <p className={`text-xs font-medium ${m.isCurrentMonth ? 'text-indigo-600' : 'text-gray-500'}`}>{m.label}</p>
              {m.dealCount > 0 ? (
                <>
                  <p className="text-xl font-bold text-gray-900 mt-1">{m.dealCount}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(m.revenue)}</p>
                  {m.isCurrentMonth && (
                    <p className="text-xs text-indigo-500/80 mt-0.5">{m.closedCount} of {m.dealCount} closed</p>
                  )}
                </>
              ) : (
                <p className="text-lg text-gray-300 mt-1">—</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Reminders Panel - wider */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Reminders & Deadlines</h3>
            {!isSearching && reminderTab === 'active' && (
              <span className="text-xs text-gray-400 hidden sm:inline">Overdue + Next 14 days</span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 mb-3">
            {[
              { key: 'active', label: 'Active', count: activeReminders.length },
              { key: 'completed', label: 'Completed', count: completedReminders.length },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setReminderTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${reminderTab === t.key ? 'border-indigo-primary text-indigo-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{t.count}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={reminderSearch}
              onChange={e => setReminderSearch(e.target.value)}
              placeholder="Search by address..."
              className="w-full pl-9 pr-9 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            {reminderSearch && (
              <button
                onClick={() => setReminderSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap gap-3 mb-3 pb-3 border-b border-gray-100">
            {Object.entries(REMINDER_COLORS).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={`w-2.5 h-2.5 rounded-full ${val.dot}`} />
                {val.label}
              </div>
            ))}
          </div>

          {remindersToShow.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              {isSearching ? 'No reminders match that address' : reminderTab === 'completed' ? 'Nothing completed yet' : 'No upcoming reminders'}
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {remindersToShow.map((r) => {
                const c = REMINDER_COLORS[r.color]
                const done = isDismissed(r.deal.id, r.key)
                const completedAt = getCompletedAt(r.deal.id, r.key)
                const isOverdue = !!r.overdue && !done
                const showActions = reminderTab === 'active' && !isSearching && isOverdue && r.isCloseOfEscrow
                return (
                  <div key={r.key}>
                    <div
                      onClick={() => setSelectedDeal(r.deal)}
                      className={`flex items-center gap-3 pl-2 pr-3 py-2 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${isOverdue ? 'bg-red-100 border-red-400' : c.bg} ${done ? 'opacity-60' : ''}`}
                    >
                      <label
                        onClick={e => e.stopPropagation()}
                        className="flex items-center justify-center p-1.5 -m-1 cursor-pointer shrink-0"
                      >
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => toggleDismissal(r.deal.id, r.key)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                        />
                      </label>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isOverdue ? 'text-red-900' : c.text} ${done ? 'line-through' : ''}`}>{r.label}</p>
                        {done && completedAt && (
                          <p className="text-xs text-gray-500">Completed {formatShortDate(completedAt)}</p>
                        )}
                      </div>
                      {isOverdue && (
                        <span className="text-xs font-bold text-white bg-red-600 px-1.5 py-0.5 rounded">OVERDUE</span>
                      )}
                      {r.daysOut !== null && r.daysOut !== undefined && (
                        <span className={`text-xs font-medium whitespace-nowrap ${isOverdue ? 'text-red-700' : c.text}`}>
                          {r.daysOut === 0 ? 'Today' : r.daysOut > 0 ? (r.daysOut === 1 ? 'Tomorrow' : `${r.daysOut}d`) : `${Math.abs(r.daysOut)}d ago`}
                        </span>
                      )}
                      {r.date && <span className="text-xs text-gray-400">{formatShortDate(r.date)}</span>}
                    </div>
                    {/* Overdue close of escrow actions (Active tab only, not during search) */}
                    {showActions && (
                      <div
                        className="flex items-center gap-2 ml-10 mt-1 mb-1"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkClosed(r.deal.id) }}
                          className="text-xs font-medium text-white bg-green-600 hover:bg-green-700 px-2.5 py-1 rounded"
                        >
                          Mark Closed
                        </button>
                        {editingDateId === r.deal.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="date"
                              className="text-xs px-2 py-1 border border-gray-300 rounded"
                              value={newDateValue}
                              onChange={e => setNewDateValue(e.target.value)}
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUpdateDate(r.deal.id) }}
                              className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1 rounded"
                            >
                              Save
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingDateId(null); setNewDateValue('') }}
                              className="text-xs text-gray-500"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingDateId(r.deal.id); setNewDateValue('') }}
                            className="text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1 rounded"
                          >
                            Update Date
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Tasks Section */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-800">Tasks</h4>
              <button
                onClick={() => setShowNewTask(!showNewTask)}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                <Plus size={14} /> New Task
              </button>
            </div>

            {showNewTask && (
              <div className="border border-indigo-200 bg-indigo-50/50 rounded-lg p-3 mb-3 space-y-2">
                <select
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  value={newTask.deal_id}
                  onChange={e => setNewTask({ ...newTask, deal_id: e.target.value })}
                >
                  <option value="">Select Deal...</option>
                  {activeDeals.map(d => <option key={d.id} value={d.id}>{d.address}</option>)}
                </select>
                <input
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  placeholder="Task description"
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                    value={newTask.due_date}
                    onChange={e => setNewTask({ ...newTask, due_date: e.target.value })}
                  />
                  <button
                    onClick={handleCreateTask}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700"
                  >
                    Save
                  </button>
                  <button onClick={() => setShowNewTask(false)} className="text-xs text-gray-500">Cancel</button>
                </div>
              </div>
            )}

            {tasks.filter(t => !t.completed).length === 0 && tasks.filter(t => t.completed).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">No tasks</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {tasks.map(t => (
                  <div key={t.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${t.completed ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-orange-50 border-orange-200'}`}>
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={() => toggleTask(t.id, !t.completed)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${t.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                        <span className="font-medium">{t.deals?.address || 'Unknown'}</span> — {t.description}
                      </p>
                    </div>
                    {t.due_date && (
                      <span className="text-xs text-gray-500 whitespace-nowrap">{formatShortDate(t.due_date)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Deal detail modal — opened when a reminder row is clicked */}
        <DealDetailModal
          deal={selectedDeal}
          open={!!selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onUpdate={async (id, updates) => {
            const updated = await updateDeal(id, updates)
            if (updated) {
              setDeals(prev => prev.map(d => d.id === id ? updated : d))
              setSelectedDeal(updated)
            }
          }}
          agentName={selectedDeal ? getAgentName(selectedDeal.agent_id) : null}
          coAgentName={selectedDeal ? getAgentName(selectedDeal.co_agent_id) : null}
        />

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No recent activity</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.map(entry => (
                <div key={entry.id} className="flex gap-3 pb-3 border-b border-gray-50 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-800">{entry.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {entry.deals?.address && <span className="font-medium text-gray-500">{entry.deals.address} · </span>}
                      {formatShortDate(entry.entry_date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
