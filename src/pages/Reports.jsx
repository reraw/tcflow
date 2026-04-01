import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/helpers'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format, parseISO } from 'date-fns'

const TABS = ['Overview', 'By Agent', 'Pipeline', 'Year over Year']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Reports() {
  const [deals, setDeals] = useState([])
  const [agents, setAgents] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [yearFilter, setYearFilter] = useState('all')

  useEffect(() => {
    const fetch = async () => {
      const [{ data: d }, { data: a }, { data: c }] = await Promise.all([
        supabase.from('deals').select('*'),
        supabase.from('agents').select('*'),
        supabase.from('contacts').select('*'),
      ])
      setDeals(d || [])
      setAgents(a || [])
      setContacts(c || [])
      setLoading(false)
    }
    fetch()
  }, [])

  const filteredDeals = useMemo(() => {
    if (yearFilter === 'all') return deals
    const year = parseInt(yearFilter)
    return deals.filter(d => {
      const closeYear = d.close_date ? new Date(d.close_date).getFullYear() : null
      const createYear = new Date(d.created_at).getFullYear()
      return closeYear === year || createYear === year
    })
  }, [deals, yearFilter])

  const years = useMemo(() => {
    const set = new Set()
    deals.forEach(d => {
      if (d.close_date) set.add(new Date(d.close_date).getFullYear())
      set.add(new Date(d.created_at).getFullYear())
    })
    return Array.from(set).sort((a, b) => b - a)
  }, [deals])

  if (loading) return <div className="text-center text-gray-400 py-12">Loading reports...</div>

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
        <select
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
        >
          <option value="all">All Time</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t ? 'border-indigo-primary text-indigo-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab deals={filteredDeals} agents={agents} contacts={contacts} />}
      {tab === 'By Agent' && <ByAgentTab deals={filteredDeals} agents={agents} contacts={contacts} />}
      {tab === 'Pipeline' && <PipelineTab deals={filteredDeals} />}
      {tab === 'Year over Year' && <YearOverYearTab deals={deals} agents={agents} contacts={contacts} />}
    </div>
  )
}

function getAgentForDeal(deal, contacts, agents) {
  const dealContacts = contacts.filter(c => c.deal_id === deal.id)
  const agentContact = dealContacts.find(c => c.role === 'listing_agent') || dealContacts.find(c => c.role === 'buyer_agent')
  if (!agentContact) return null
  return agents.find(a => a.name === agentContact.name) || { name: agentContact.name, id: agentContact.name }
}

function OverviewTab({ deals, agents, contacts }) {
  const closed = deals.filter(d => d.status === 'closed')
  const active = deals.filter(d => d.status === 'active')
  const listings = deals.filter(d => d.status === 'listing')
  const cancelled = deals.filter(d => d.status === 'cancelled')
  const totalVolume = closed.reduce((s, d) => s + (Number(d.price) || 0), 0)
  const totalRevenue = closed.reduce((s, d) => s + (Number(d.tc_fee) || 0), 0)
  const avgFee = closed.length ? totalRevenue / closed.length : 0

  // Monthly closed chart
  const monthlyData = MONTHS.map((month, i) => {
    const monthDeals = closed.filter(d => d.close_date && new Date(d.close_date).getMonth() === i)
    return { month, count: monthDeals.length, revenue: monthDeals.reduce((s, d) => s + (Number(d.tc_fee) || 0), 0) }
  })

  // Revenue by agent
  const agentRevenue = {}
  closed.forEach(deal => {
    const agent = getAgentForDeal(deal, contacts, agents)
    const name = agent?.name || 'Unassigned'
    agentRevenue[name] = (agentRevenue[name] || 0) + (Number(deal.tc_fee) || 0)
  })
  const agentRevenueData = Object.entries(agentRevenue)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  const kpis = [
    { label: 'Total Closed', value: closed.length },
    { label: 'Active Deals', value: active.length },
    { label: 'Listings', value: listings.length },
    { label: 'Cancelled', value: cancelled.length },
    { label: 'Total Volume', value: formatCurrency(totalVolume) },
    { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
    { label: 'Avg Fee', value: formatCurrency(avgFee) },
    { label: 'Total Deals', value: deals.length },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{k.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Closed Deals</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v, name) => name === 'revenue' ? formatCurrency(v) : v} />
            <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Deals" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {agentRevenueData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue by Agent</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={agentRevenueData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => formatCurrency(v)} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={120} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Bar dataKey="revenue" fill="#4f46e5" radius={[0, 4, 4, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function ByAgentTab({ deals, agents, contacts }) {
  const agentStats = useMemo(() => {
    const stats = {}
    deals.forEach(deal => {
      const agent = getAgentForDeal(deal, contacts, agents)
      const name = agent?.name || 'Unassigned'
      if (!stats[name]) stats[name] = { name, closed: 0, active: 0, cancelled: 0, volume: 0, revenue: 0, total: 0 }
      stats[name].total++
      if (deal.status === 'closed') { stats[name].closed++; stats[name].volume += Number(deal.price) || 0; stats[name].revenue += Number(deal.tc_fee) || 0 }
      if (deal.status === 'active') stats[name].active++
      if (deal.status === 'cancelled') stats[name].cancelled++
    })
    return Object.values(stats).sort((a, b) => b.revenue - a.revenue)
  }, [deals, agents, contacts])

  const chartData = agentStats.slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Agent</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Closed</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Active</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Cancelled</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Volume</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Revenue</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Close Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agentStats.map(a => (
                <tr key={a.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{a.closed}</td>
                  <td className="px-4 py-3 text-right text-gray-700 hidden sm:table-cell">{a.active}</td>
                  <td className="px-4 py-3 text-right text-gray-700 hidden sm:table-cell">{a.cancelled}</td>
                  <td className="px-4 py-3 text-right text-gray-700 hidden md:table-cell">{formatCurrency(a.volume)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(a.revenue)}</td>
                  <td className="px-4 py-3 text-right text-gray-700 hidden lg:table-cell">
                    {a.total > 0 ? `${Math.round((a.closed / a.total) * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue by Agent</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => formatCurrency(v)} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function PipelineTab({ deals }) {
  const active = deals.filter(d => d.status === 'active')
  const listings = deals.filter(d => d.status === 'listing')
  const activeValue = active.reduce((s, d) => s + (Number(d.price) || 0), 0)
  const listingValue = listings.reduce((s, d) => s + (Number(d.price) || 0), 0)
  const pendingFees = [...active, ...listings].reduce((s, d) => s + (!d.tc_paid ? (Number(d.tc_fee) || 0) : 0), 0)

  const kpis = [
    { label: 'Active Deal Value', value: formatCurrency(activeValue) },
    { label: 'Listing Value', value: formatCurrency(listingValue) },
    { label: 'Pending Fees', value: formatCurrency(pendingFees) },
    { label: 'Pipeline Deals', value: active.length + listings.length },
  ]

  const renderTable = (title, data) => (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <h3 className="text-sm font-semibold text-gray-700 px-4 py-3 border-b border-gray-200">{title} ({data.length})</h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 p-4">No deals</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2 font-medium text-gray-600">Property</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Price</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">TC Fee</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 hidden sm:table-cell">Close Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map(d => (
                <tr key={d.id}>
                  <td className="px-4 py-2 text-gray-900">{d.address}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(d.price)}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(d.tc_fee)}</td>
                  <td className="px-4 py-2 text-gray-700 hidden sm:table-cell">{d.close_date ? format(parseISO(d.close_date), 'MM/dd/yy') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{k.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{k.value}</p>
          </div>
        ))}
      </div>
      {renderTable('Under Contract', active)}
      {renderTable('Listings', listings)}
    </div>
  )
}

function YearOverYearTab({ deals, agents, contacts }) {
  const currentYear = new Date().getFullYear()
  const prevYear = currentYear - 1

  const getYearDeals = (year) => deals.filter(d => {
    const closeYear = d.close_date ? new Date(d.close_date).getFullYear() : null
    const createYear = new Date(d.created_at).getFullYear()
    return closeYear === year || createYear === year
  })

  const calcStats = (yearDeals) => {
    const closed = yearDeals.filter(d => d.status === 'closed')
    return {
      totalDeals: yearDeals.length,
      closed: closed.length,
      active: yearDeals.filter(d => d.status === 'active').length,
      volume: closed.reduce((s, d) => s + (Number(d.price) || 0), 0),
      revenue: closed.reduce((s, d) => s + (Number(d.tc_fee) || 0), 0),
      avgFee: closed.length ? closed.reduce((s, d) => s + (Number(d.tc_fee) || 0), 0) / closed.length : 0,
    }
  }

  const current = calcStats(getYearDeals(currentYear))
  const prev = calcStats(getYearDeals(prevYear))

  const changeIndicator = (curr, prv) => {
    if (prv === 0) return curr > 0 ? '+100%' : '—'
    const pct = Math.round(((curr - prv) / prv) * 100)
    return pct > 0 ? `+${pct}%` : `${pct}%`
  }

  const changeColor = (curr, prv) => curr >= prv ? 'text-green-600' : 'text-red-600'

  const metrics = [
    { label: 'Total Deals', current: current.totalDeals, prev: prev.totalDeals },
    { label: 'Closed Deals', current: current.closed, prev: prev.closed },
    { label: 'Total Volume', current: current.volume, prev: prev.volume, format: true },
    { label: 'Total Revenue', current: current.revenue, prev: prev.revenue, format: true },
    { label: 'Avg Fee', current: current.avgFee, prev: prev.avgFee, format: true },
  ]

  // Monthly comparison chart
  const currentYearDeals = getYearDeals(currentYear).filter(d => d.status === 'closed')
  const prevYearDeals = getYearDeals(prevYear).filter(d => d.status === 'closed')
  const monthlyComparison = MONTHS.map((month, i) => ({
    month,
    [currentYear]: currentYearDeals.filter(d => d.close_date && new Date(d.close_date).getMonth() === i).length,
    [prevYear]: prevYearDeals.filter(d => d.close_date && new Date(d.close_date).getMonth() === i).length,
  }))

  // Agent YOY
  const agentYOY = useMemo(() => {
    const stats = {}
    const processDeals = (yearDeals, yearKey) => {
      yearDeals.filter(d => d.status === 'closed').forEach(deal => {
        const agent = getAgentForDeal(deal, contacts, agents)
        const name = agent?.name || 'Unassigned'
        if (!stats[name]) stats[name] = { name }
        stats[name][`${yearKey}_deals`] = (stats[name][`${yearKey}_deals`] || 0) + 1
        stats[name][`${yearKey}_revenue`] = (stats[name][`${yearKey}_revenue`] || 0) + (Number(deal.tc_fee) || 0)
      })
    }
    processDeals(getYearDeals(currentYear), 'current')
    processDeals(getYearDeals(prevYear), 'prev')
    return Object.values(stats).sort((a, b) => (b.current_revenue || 0) - (a.current_revenue || 0))
  }, [deals, agents, contacts])

  return (
    <div className="space-y-6">
      {/* Metric comparison */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Metric</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">{prevYear}</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">{currentYear}</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {metrics.map(m => (
                <tr key={m.label}>
                  <td className="px-4 py-3 font-medium text-gray-800">{m.label}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{m.format ? formatCurrency(m.prev) : m.prev}</td>
                  <td className="px-4 py-3 text-right text-gray-900 font-medium">{m.format ? formatCurrency(m.current) : m.current}</td>
                  <td className={`px-4 py-3 text-right font-medium ${changeColor(m.current, m.prev)}`}>
                    {changeIndicator(m.current, m.prev)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent YOY */}
      {agentYOY.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <h3 className="text-sm font-semibold text-gray-700 px-4 py-3 border-b border-gray-200">Agent Year over Year</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Agent</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">{prevYear} Deals</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">{currentYear} Deals</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">{prevYear} Rev</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">{currentYear} Rev</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {agentYOY.map(a => (
                  <tr key={a.name}>
                    <td className="px-4 py-2 font-medium text-gray-900">{a.name}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{a.prev_deals || 0}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{a.current_deals || 0}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(a.prev_revenue || 0)}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(a.current_revenue || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly comparison chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Closed Deals — {prevYear} vs {currentYear}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyComparison}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey={prevYear} fill="#a5b4fc" radius={[4, 4, 0, 0]} name={String(prevYear)} />
            <Bar dataKey={currentYear} fill="#4f46e5" radius={[4, 4, 0, 0]} name={String(currentYear)} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
