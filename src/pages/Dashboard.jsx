import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatShortDate, generateReminders, REMINDER_COLORS, daysUntil } from '../lib/helpers'
import { TrendingUp, Home, XCircle, CheckCircle, DollarSign, Clock, BarChart3, AlertTriangle } from 'lucide-react'

export default function Dashboard() {
  const navigate = useNavigate()
  const [deals, setDeals] = useState([])
  const [contingencies, setContingencies] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const [{ data: d }, { data: c }, { data: h }] = await Promise.all([
        supabase.from('deals').select('*').order('created_at', { ascending: false }),
        supabase.from('contingencies').select('*'),
        supabase.from('deal_history').select('*, deals(address)').order('created_at', { ascending: false }).limit(10),
      ])
      setDeals(d || [])
      setContingencies(c || [])
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
  const outstanding = active.reduce((sum, d) => sum + (!d.tc_paid ? (Number(d.tc_fee) || 0) : 0), 0)
    + listings.reduce((sum, d) => sum + (!d.tc_paid ? (Number(d.tc_fee) || 0) : 0), 0)
  const potentialPipeline = listings.reduce((sum, d) => sum + (Number(d.tc_fee) || 0), 0)
  const totalPipeline = active.reduce((sum, d) => sum + (Number(d.tc_fee) || 0), 0) + potentialPipeline

  const reminders = generateReminders(deals, contingencies)

  const kpiTiles = [
    { label: 'Listings', value: listings.length, icon: Home, color: 'text-blue-600 bg-blue-50', filter: 'listing' },
    { label: 'Under Contract', value: active.length, icon: TrendingUp, color: 'text-green-600 bg-green-50', filter: 'active' },
    { label: 'Cancelled', value: cancelled.length, icon: XCircle, color: 'text-red-600 bg-red-50', filter: 'cancelled' },
    { label: 'Closed YTD', value: closedYTD.length, icon: CheckCircle, color: 'text-gray-600 bg-gray-100', filter: 'closed' },
    { label: 'Collected', value: formatCurrency(collected), icon: DollarSign, color: 'text-emerald-600 bg-emerald-50', isAmount: true },
  ]

  const kpiRow2 = [
    { label: 'Outstanding Fees', value: formatCurrency(outstanding), icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Potential Pipeline', value: formatCurrency(potentialPipeline), icon: BarChart3, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Total Pipeline', value: formatCurrency(totalPipeline), icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
  ]

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Loading...</div></div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiTiles.map(tile => (
          <button
            key={tile.label}
            onClick={() => tile.filter && navigate(`/deals?status=${tile.filter}`)}
            className={`bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md transition-shadow ${tile.filter ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${tile.color}`}>
                <tile.icon size={16} />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tile.label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{tile.value}</div>
          </button>
        ))}
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpiRow2.map(tile => (
          <div key={tile.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${tile.color}`}>
                <tile.icon size={16} />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tile.label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{tile.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reminders Panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Reminders</h3>
            <span className="text-xs text-gray-400">Next 14 days</span>
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
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {reminders.map((r, i) => {
                const c = REMINDER_COLORS[r.color]
                return (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${c.bg}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${c.text}`}>{r.label}</p>
                    </div>
                    <span className={`text-xs font-medium whitespace-nowrap ${c.text}`}>
                      {r.daysOut === 0 ? 'Today' : r.daysOut === 1 ? 'Tomorrow' : `${r.daysOut}d`}
                    </span>
                    <span className="text-xs text-gray-400">{formatShortDate(r.date)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No recent activity</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
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
