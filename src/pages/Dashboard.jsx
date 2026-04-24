import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useDeals, useReminderDismissals, useTasks } from '../hooks/useSupabase'
import { formatCurrency, formatShortDate, formatDate, generateReminders, REMINDER_COLORS } from '../lib/helpers'
import { TrendingUp, Home, XCircle, CheckCircle, DollarSign, Clock, BarChart3, Calendar, Plus, Trash2 } from 'lucide-react'
import { format, addMonths, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'

export default function Dashboard() {
  const navigate = useNavigate()
  const [deals, setDeals] = useState([])
  const [customDates, setCustomDates] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const { isDismissed, toggleDismissal } = useReminderDismissals()
  const { updateDeal } = useDeals()
  const { tasks, createTask, toggleTask } = useTasks()

  // Inline date editing for overdue close of escrow
  const [editingDateId, setEditingDateId] = useState(null)
  const [newDateValue, setNewDateValue] = useState('')

  // New task form
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ deal_id: '', description: '', due_date: '' })

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

  const currentYear = new Date().getFullYear()
  const listings = deals.filter(d => d.status === 'listing')
  const active = deals.filter(d => d.status === 'active')
  const cancelled = deals.filter(d => d.status === 'cancelled')
  const closedYTD = deals.filter(d => d.status === 'closed' && d.close_date && new Date(d.close_date).getFullYear() === currentYear)
  const collected = closedYTD.reduce((sum, d) => sum + (d.tc_paid ? (Number(d.tc_fee) || 0) : 0), 0)

  // Current-Month revenue panel
  const thisMonthStart = startOfMonth(new Date())
  const thisMonthEnd = endOfMonth(new Date())
  const dealInThisMonth = (d) => {
    if (!d.close_date) return false
    const cd = parseISO(d.close_date)
    return isWithinInterval(cd, { start: thisMonthStart, end: thisMonthEnd })
  }
  const thisMonthDeals = deals.filter(d => d.status !== 'cancelled' && dealInThisMonth(d))
  const sumFee = (arr) => arr.reduce((s, d) => s + (Number(d.tc_fee) || 0), 0)
  const closedPaidDeals = thisMonthDeals.filter(d => d.status === 'closed' && d.tc_paid)
  const closedUnpaidDeals = thisMonthDeals.filter(d => d.status === 'closed' && !d.tc_paid)
  const stillToCloseDeals = thisMonthDeals.filter(d => d.status !== 'closed')
  const thisMonthProjected = sumFee(thisMonthDeals)
  const thisMonthClosedPaid = sumFee(closedPaidDeals)
  const thisMonthClosedUnpaid = sumFee(closedUnpaidDeals)
  const thisMonthStillToClose = sumFee(stillToCloseDeals)
  const thisMonthRealized = thisMonthClosedPaid + thisMonthClosedUnpaid
  const thisMonthProgress = thisMonthProjected > 0 ? Math.min(100, (thisMonthRealized / thisMonthProjected) * 100) : 0
  const thisMonthLabel = format(new Date(), 'MMMM yyyy')
  const projectedCount = thisMonthDeals.length
  const closedPaidCount = closedPaidDeals.length
  const closedUnpaidCount = closedUnpaidDeals.length
  const stillToCloseCount = stillToCloseDeals.length
  const realizedCount = closedPaidCount + closedUnpaidCount
  const dealLabel = (n) => `${n} ${n === 1 ? 'deal' : 'deals'}`

  const closedDeals = deals.filter(d => d.status === 'closed')
  const outstandingFees = closedDeals.filter(d => !d.tc_paid).reduce((sum, d) => sum + (Number(d.tc_fee) || 0), 0)
  const underContractProjected = active.reduce((sum, d) => sum + (Number(d.tc_fee) || 0), 0)
  const potentialFees = listings.reduce((sum, d) => sum + (Number(d.tc_fee) || 0), 0)
  const totalPipeline = outstandingFees + underContractProjected + potentialFees

  const projectedMonths = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const monthDate = addMonths(startOfMonth(now), i)
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)
    const monthDeals = active.filter(d => {
      if (!d.close_date) return false
      const cd = parseISO(d.close_date)
      return isWithinInterval(cd, { start: monthStart, end: monthEnd })
    })
    projectedMonths.push({
      label: format(monthDate, 'MMM yyyy'),
      isCurrentMonth: i === 0,
      dealCount: monthDeals.length,
      revenue: monthDeals.reduce((s, d) => s + (Number(d.tc_fee) || 0), 0),
    })
  }

  const reminders = generateReminders(deals, customDates)

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
    { label: 'Listings', value: listings.length, icon: Home, color: 'text-blue-600 bg-blue-50', filter: 'listing' },
    { label: 'Under Contract', value: active.length, icon: TrendingUp, color: 'text-green-600 bg-green-50', filter: 'active' },
    { label: 'Cancelled', value: cancelled.length, icon: XCircle, color: 'text-red-600 bg-red-50', filter: 'cancelled' },
    { label: 'Closed YTD', value: closedYTD.length, icon: CheckCircle, color: 'text-gray-600 bg-gray-100', filter: 'closed' },
    { label: 'Collected', value: formatCurrency(collected), icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
  ]

  const kpiRow2 = [
    { label: 'Outstanding Fees', subtitle: 'Closed deals, payment not received', value: formatCurrency(outstandingFees), icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Under Contract', subtitle: 'Projected TC fees from active deals', value: formatCurrency(underContractProjected), icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { label: 'Potential', subtitle: 'Projected fees from listings', value: formatCurrency(potentialFees), icon: BarChart3, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Total Pipeline', subtitle: 'Outstanding + active + listings combined', value: formatCurrency(totalPipeline), icon: DollarSign, color: 'text-purple-600 bg-purple-50' },
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
          <h3 className="text-lg font-semibold text-gray-900">This Month — {thisMonthLabel}</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 size={14} className="text-indigo-500" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Projected</span>
            </div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(thisMonthProjected)}</div>
            <div className="text-xs text-gray-500 mt-0.5">{dealLabel(projectedCount)}</div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle size={14} className="text-green-600" />
              <span className="text-xs font-medium text-green-700 uppercase tracking-wide">Closed & Paid</span>
            </div>
            <div className="text-xl font-bold text-green-900">{formatCurrency(thisMonthClosedPaid)}</div>
            <div className="text-xs text-green-700/70 mt-0.5">{dealLabel(closedPaidCount)}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={14} className="text-amber-600" />
              <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">Awaiting Payment</span>
            </div>
            <div className="text-xl font-bold text-amber-900">{formatCurrency(thisMonthClosedUnpaid)}</div>
            <div className="text-xs text-amber-700/70 mt-0.5">{dealLabel(closedUnpaidCount)}</div>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={14} className="text-indigo-600" />
              <span className="text-xs font-medium text-indigo-700 uppercase tracking-wide">Still to Close</span>
            </div>
            <div className="text-xl font-bold text-indigo-900">{formatCurrency(thisMonthStillToClose)}</div>
            <div className="text-xs text-indigo-700/70 mt-0.5">{dealLabel(stillToCloseCount)}</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-xs text-gray-500 mb-1.5">
            <span>{Math.round(thisMonthProgress)}% of projected has closed</span>
            <span>
              {formatCurrency(thisMonthRealized)} / {formatCurrency(thisMonthProjected)}
              <span className="text-gray-400"> · {realizedCount} of {projectedCount} {projectedCount === 1 ? 'deal' : 'deals'}</span>
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full flex">
              <div className="bg-green-500" style={{ width: `${thisMonthProjected > 0 ? (thisMonthClosedPaid / thisMonthProjected) * 100 : 0}%` }} />
              <div className="bg-amber-400" style={{ width: `${thisMonthProjected > 0 ? (thisMonthClosedUnpaid / thisMonthProjected) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiTiles.map(tile => (
          <button key={tile.label} onClick={() => tile.filter && navigate(`/deals?status=${tile.filter}`)} className={`bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md transition-shadow ${tile.filter ? 'cursor-pointer' : 'cursor-default'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${tile.color}`}><tile.icon size={16} /></div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tile.label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{tile.value}</div>
          </button>
        ))}
      </div>

      {/* KPI Row 2 - Financial */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiRow2.map(tile => (
          <div key={tile.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={`p-1.5 rounded-lg ${tile.color}`}><tile.icon size={16} /></div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tile.label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{tile.value}</div>
            <p className="text-xs text-gray-400 mt-1">{tile.subtitle}</p>
          </div>
        ))}
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
            <span className="text-xs text-gray-400">Overdue + Next 14 days</span>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap gap-3 mb-4 pb-3 border-b border-gray-100">
            {Object.entries(REMINDER_COLORS).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={`w-2.5 h-2.5 rounded-full ${val.dot}`} />
                {val.label}
              </div>
            ))}
          </div>

          {reminders.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No upcoming reminders</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {reminders.map((r) => {
                const c = REMINDER_COLORS[r.color]
                const done = isDismissed(r.deal.id, r.key)
                const isOverdue = r.overdue && !done
                return (
                  <div key={r.key}>
                    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${isOverdue ? 'bg-red-100 border-red-400' : c.bg} ${done ? 'opacity-60' : ''}`}>
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => toggleDismissal(r.deal.id, r.key)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 shrink-0"
                      />
                      <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isOverdue ? 'text-red-900' : c.text} ${done ? 'line-through' : ''}`}>{r.label}</p>
                      </div>
                      {isOverdue && (
                        <span className="text-xs font-bold text-white bg-red-600 px-1.5 py-0.5 rounded">OVERDUE</span>
                      )}
                      <span className={`text-xs font-medium whitespace-nowrap ${isOverdue ? 'text-red-700' : c.text}`}>
                        {r.daysOut === 0 ? 'Today' : r.daysOut > 0 ? (r.daysOut === 1 ? 'Tomorrow' : `${r.daysOut}d`) : `${Math.abs(r.daysOut)}d ago`}
                      </span>
                      <span className="text-xs text-gray-400">{formatShortDate(r.date)}</span>
                    </div>
                    {/* Overdue close of escrow actions */}
                    {isOverdue && r.isCloseOfEscrow && (
                      <div className="flex items-center gap-2 ml-10 mt-1 mb-1">
                        <button
                          onClick={() => handleMarkClosed(r.deal.id)}
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
                              onClick={() => handleUpdateDate(r.deal.id)}
                              className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1 rounded"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => { setEditingDateId(null); setNewDateValue('') }}
                              className="text-xs text-gray-500"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingDateId(r.deal.id); setNewDateValue('') }}
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
