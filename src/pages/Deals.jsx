import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDeals, useAgents, useAllPayments, markPaidInFull, clearPayments, findOrCreateVendor } from '../hooks/useSupabase'
import { supabase } from '../lib/supabase'
import {
  formatCurrency, formatDate, getStatusColor, getStatusLabel, getRepLabel,
  paymentStateFor, paymentSummary, PAYMENT_STATE_LABELS,
} from '../lib/helpers'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import DealForm from '../components/deals/DealForm'
import DealDetailModal from '../components/deals/DealDetailModal'
import PaidStatusCell from '../components/deals/PaidStatusCell'
import { Plus, Search, Pencil, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react'
import { parseISO, startOfMonth, endOfMonth, isWithinInterval, format } from 'date-fns'

const TABS = [
  { key: 'all', label: 'All' }, { key: 'listing', label: 'Listings' },
  { key: 'active', label: 'Under Contract' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'closed', label: 'Closed' },
]

const PAID_STATUS_OPTIONS = [
  { key: 'all',      label: 'All' },
  { key: 'paid',     label: 'Paid' },
  { key: 'partial',  label: 'Partial' },
  { key: 'awaiting', label: 'Awaiting' },
  { key: 'not_due',  label: 'Not yet due' },
]

// Compound filter values used only by Dashboard card navigation —
// not surfaced in the manual filter dropdown.
//   outstanding  = awaiting OR partial (any unpaid balance after close)
//   has_payments = paid OR partial (any payment received)
const COMPOUND_PAID_FILTERS = {
  outstanding:  { states: ['awaiting', 'partial'], label: 'Has outstanding balance' },
  has_payments: { states: ['paid', 'partial'],     label: 'Has received payment' },
}

const SORTABLE_COLUMNS = {
  address: { key: 'address', label: 'Property' },
  status: { key: 'status', label: 'Status' },
  price: { key: 'price', label: 'Price', numeric: true },
  close_date: { key: 'close_date', label: 'Close Date' },
  tc_fee: { key: 'tc_fee', label: 'TC Fee', numeric: true },
  paid_status: { key: 'paid_status', label: 'Paid' },
}

const PAID_STATE_ORDER = { paid: 0, partial: 1, awaiting: 2, not_due: 3 }

export default function Deals() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('status') || 'all'
  const initialPaid = searchParams.get('paid_status') || 'all'
  const monthParam = searchParams.get('month') // e.g. "2026-04"

  const [activeTab, setActiveTab] = useState(initialTab)
  const [paidFilter, setPaidFilter] = useState(initialPaid)
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [editingDeal, setEditingDeal] = useState(null)
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [sortColumn, setSortColumn] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')
  const { deals, loading, createDeal, updateDeal, deleteDeal } = useDeals()
  const { agents } = useAgents()
  const { payments: allPayments, fetchAll: refetchPayments } = useAllPayments()

  // Search index for vendor / client names — built from contacts table.
  const [allContacts, setAllContacts] = useState([])
  useEffect(() => {
    supabase.from('contacts').select('deal_id, role, name, company, officer').then(({ data }) => setAllContacts(data || []))
  }, [])

  // Keep paid-status column responsive to external changes.
  const paymentsByDeal = useMemo(() => {
    const m = {}
    allPayments.forEach(p => {
      if (!m[p.deal_id]) m[p.deal_id] = []
      m[p.deal_id].push(p)
    })
    return m
  }, [allPayments])

  // Client-name + vendor-name index per deal — used by search.
  const searchIndexByDeal = useMemo(() => {
    const m = {}
    allContacts.forEach(c => {
      const tokens = [c.name, c.company, c.officer].filter(Boolean).map(s => s.toLowerCase())
      if (!m[c.deal_id]) m[c.deal_id] = []
      m[c.deal_id].push(...tokens)
    })
    return m
  }, [allContacts])

  const agentMap = useMemo(() => {
    const map = {}
    agents.forEach(a => { map[a.id] = a.name })
    return map
  }, [agents])
  const getAgentName = (id) => agentMap[id] || null

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(col)
      setSortDirection('asc')
    }
  }

  // Month filter from URL (?month=YYYY-MM)
  const monthFilter = useMemo(() => {
    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) return null
    const [y, mo] = monthParam.split('-').map(Number)
    const start = startOfMonth(new Date(y, mo - 1, 1))
    const end = endOfMonth(start)
    return { start, end, label: format(start, 'MMMM yyyy') }
  }, [monthParam])

  const filteredDeals = useMemo(() => {
    let filtered = deals
    if (activeTab !== 'all') filtered = filtered.filter(d => d.status === activeTab)
    if (monthFilter) {
      filtered = filtered.filter(d => d.status !== 'cancelled' && d.close_date && isWithinInterval(parseISO(d.close_date), monthFilter))
    }
    if (paidFilter !== 'all') {
      const compound = COMPOUND_PAID_FILTERS[paidFilter]
      filtered = filtered.filter(d => {
        const state = paymentStateFor(d, paymentsByDeal[d.id] || [])
        return compound ? compound.states.includes(state) : state === paidFilter
      })
    }
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(d =>
        d.address?.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q) ||
        getAgentName(d.agent_id)?.toLowerCase().includes(q) ||
        getAgentName(d.co_agent_id)?.toLowerCase().includes(q) ||
        d.other_agent_name?.toLowerCase().includes(q) ||
        d.other_tc_name?.toLowerCase().includes(q) ||
        (searchIndexByDeal[d.id] || []).some(t => t.includes(q))
      )
    }

    const sorted = [...filtered].sort((a, b) => {
      const col = sortColumn
      let aVal, bVal
      if (col === 'paid_status') {
        aVal = PAID_STATE_ORDER[paymentStateFor(a, paymentsByDeal[a.id] || [])]
        bVal = PAID_STATE_ORDER[paymentStateFor(b, paymentsByDeal[b.id] || [])]
      } else {
        aVal = a[col]; bVal = b[col]
        if (aVal == null) aVal = ''
        if (bVal == null) bVal = ''
        const colDef = SORTABLE_COLUMNS[col]
        if (colDef?.numeric) {
          aVal = Number(aVal) || 0
          bVal = Number(bVal) || 0
        } else {
          aVal = String(aVal).toLowerCase()
          bVal = String(bVal).toLowerCase()
        }
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [deals, activeTab, paidFilter, monthFilter, search, agentMap, sortColumn, sortDirection, paymentsByDeal, searchIndexByDeal])

  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '' || v === 'all') next.delete(k)
      else next.set(k, v)
    })
    setSearchParams(next)
  }

  const handleTabChange = (key) => { setActiveTab(key); updateParams({ status: key }) }
  const handlePaidChange = (key) => { setPaidFilter(key); updateParams({ paid_status: key }) }
  const clearMonthFilter = () => updateParams({ month: null })

  const hasActiveFilterPill = !!monthFilter || paidFilter !== 'all'
  const paidFilterLabel = COMPOUND_PAID_FILTERS[paidFilter]?.label || PAYMENT_STATE_LABELS[paidFilter]
  const filterPillDesc = [
    monthFilter && `Closing ${monthFilter.label}`,
    paidFilter !== 'all' && paidFilterLabel,
  ].filter(Boolean).join(' · ')

  const clearAllFilters = () => {
    setPaidFilter('all')
    updateParams({ month: null, paid_status: null })
  }

  const saveContacts = async (dealId, contacts) => {
    if (!contacts) return
    const roles = ['escrow', 'lender', 'client_1', 'client_2']
    await Promise.all(roles.map(r => supabase.from('contacts').delete().eq('deal_id', dealId).eq('role', r)))
    if (contacts.length) {
      // Auto-create/link vendor rows for escrow + lender (silent — no toast).
      const resolved = await Promise.all(contacts.map(async (c) => {
        if ((c.role === 'escrow' || c.role === 'lender') && (c.company || c.name)) {
          const type = c.role === 'escrow' ? 'Escrow' : 'Lender'
          const vendor = await findOrCreateVendor({
            name: c.company || c.name,
            vendor_type: type,
            phone: c.phone,
            email: c.email,
          })
          if (vendor) return { ...c, vendor_id: vendor.id }
        }
        return c
      }))
      await Promise.all(resolved.map(c => supabase.from('contacts').insert({ ...c, deal_id: dealId })))
    }
  }

  const handleCreateDeal = async (formData, customDates, contacts) => {
    const deal = await createDeal(formData)
    if (deal) {
      if (customDates?.length) await Promise.all(customDates.map(cd => supabase.from('custom_dates').insert({ deal_id: deal.id, label: cd.label, date: cd.date })))
      await saveContacts(deal.id, contacts)
    }
    setShowNewDeal(false)
  }

  const handleEditDeal = async (formData, customDates, contacts) => {
    const deal = await updateDeal(editingDeal.id, formData)
    if (deal) {
      if (customDates) {
        await supabase.from('custom_dates').delete().eq('deal_id', deal.id)
        if (customDates.length) await Promise.all(customDates.map(cd => supabase.from('custom_dates').insert({ deal_id: deal.id, label: cd.label, date: cd.date })))
      }
      await saveContacts(deal.id, contacts)
    }
    setEditingDeal(null)
  }

  const handleConfirmDelete = async () => { if (deleteTarget) { await deleteDeal(deleteTarget.id); setDeleteTarget(null) } }

  const openEdit = async (e, deal) => {
    e.stopPropagation()
    const [{ data: cd }, { data: ct }] = await Promise.all([
      supabase.from('custom_dates').select('*').eq('deal_id', deal.id),
      supabase.from('contacts').select('*').eq('deal_id', deal.id),
    ])
    setEditingDeal({ ...deal, _customDates: cd || [], _contacts: ct || [] })
  }

  const SortHeader = ({ col, children, className = '' }) => {
    const isActive = sortColumn === col
    return (
      <th
        className={`px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none ${className}`}
        onClick={() => handleSort(col)}
      >
        <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : className.includes('text-center') ? 'justify-center' : ''}`}>
          {children}
          {isActive ? (
            sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-600" /> : <ChevronDown size={14} className="text-indigo-600" />
          ) : (
            <ChevronDown size={14} className="text-gray-300" />
          )}
        </div>
      </th>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Deals</h2>
        <button onClick={() => setShowNewDeal(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700"><Plus size={16} /> New Deal</button>
      </div>

      {hasActiveFilterPill && (
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
          <span className="text-indigo-700 font-medium">Filtered:</span>
          <span className="text-indigo-900">{filterPillDesc}</span>
          <button onClick={clearAllFilters} className="ml-auto inline-flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-900 font-medium">
            <X size={12} /> Clear
          </button>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => handleTabChange(tab.key)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.key ? 'border-indigo-primary text-indigo-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.label}<span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{tab.key === 'all' ? deals.length : deals.filter(d => d.status === tab.key).length}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full sm:w-80 pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Search address, agent, vendor, client…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {PAID_STATUS_OPTIONS.map((opt, i) => (
            <button
              key={opt.key}
              onClick={() => handlePaidChange(opt.key)}
              className={`px-3 py-1.5 ${i > 0 ? 'border-l border-gray-300' : ''} ${paidFilter === opt.key ? 'bg-indigo-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="text-center text-gray-400 py-12">Loading deals...</div> : filteredDeals.length === 0 ? <div className="text-center text-gray-400 py-12">No deals found</div> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <SortHeader col="address" className="text-left">Property</SortHeader>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Rep</th>
                <SortHeader col="status" className="text-left">Status</SortHeader>
                <SortHeader col="price" className="text-right hidden md:table-cell">Price</SortHeader>
                <SortHeader col="close_date" className="text-left hidden lg:table-cell">Close Date</SortHeader>
                <SortHeader col="tc_fee" className="text-right">TC Fee</SortHeader>
                <SortHeader col="paid_status" className="text-center w-20">Paid</SortHeader>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-20">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDeals.map(deal => {
                  const payments = paymentsByDeal[deal.id] || []
                  const summary = paymentSummary(deal, payments)
                  return (
                    <tr key={deal.id} onClick={() => setSelectedDeal(deal)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{deal.address}</div>
                        <div className="text-xs text-gray-500">{[deal.city, getAgentName(deal.agent_id)].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell"><span className="text-xs text-gray-600">{getRepLabel(deal.representation)}</span></td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(deal.status)}`}>{getStatusLabel(deal.status)}</span></td>
                      <td className="px-4 py-3 text-right text-gray-700 hidden md:table-cell">{formatCurrency(deal.price)}</td>
                      <td className="px-4 py-3 text-gray-700 hidden lg:table-cell">{formatDate(deal.close_date)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-gray-900">{formatCurrency(deal.tc_fee)}</span>
                        {summary.state === 'partial' && (
                          <div className="text-[11px] text-blue-600">{formatCurrency(summary.received)} of {formatCurrency(summary.fee)}</div>
                        )}
                        {summary.state === 'paid' && summary.latestDate && (
                          <div className="text-[11px] text-green-600">Paid · {formatDate(summary.latestDate)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <PaidStatusCell
                          deal={deal}
                          payments={payments}
                          onMarkPaidInFull={async () => { await markPaidInFull(deal.id, deal.tc_fee); await refetchPayments() }}
                          onAddPayment={async (payment) => {
                            await supabase.from('deal_payments').insert({
                              deal_id: deal.id,
                              amount: Number(payment.amount),
                              paid_by: payment.paid_by,
                              paid_by_other: payment.paid_by_other || null,
                              payment_date: new Date().toISOString().slice(0, 10),
                            })
                            await refetchPayments()
                          }}
                          onClearPayments={async () => { await clearPayments(deal.id); await refetchPayments() }}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={(e) => openEdit(e, deal)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Edit"><Pencil size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(deal) }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showNewDeal} onClose={() => setShowNewDeal(false)} title="New Deal" wide>
        <DealForm onSubmit={handleCreateDeal} onCancel={() => setShowNewDeal(false)} />
      </Modal>

      <Modal open={!!editingDeal} onClose={() => setEditingDeal(null)} title="Edit Deal" wide>
        {editingDeal && <DealForm onSubmit={handleEditDeal} onCancel={() => setEditingDeal(null)} initialData={editingDeal} initialCustomDates={editingDeal._customDates} initialContacts={editingDeal._contacts} />}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onConfirm={handleConfirmDelete} onCancel={() => setDeleteTarget(null)} title="Delete Deal" message={`Delete "${deleteTarget?.address}"? All related data will be removed.`} />

      <DealDetailModal
        deal={selectedDeal}
        open={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
        onUpdate={async (id, updates) => {
          const updated = await updateDeal(id, updates)
          if (updated) setSelectedDeal(updated)
          await refetchPayments()
        }}
        onPaymentsChanged={refetchPayments}
        agentName={selectedDeal ? getAgentName(selectedDeal.agent_id) : null}
        coAgentName={selectedDeal ? getAgentName(selectedDeal.co_agent_id) : null}
      />
    </div>
  )
}
