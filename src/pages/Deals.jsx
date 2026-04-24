import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDeals, useAgents } from '../hooks/useSupabase'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, getRepLabel } from '../lib/helpers'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import DealForm from '../components/deals/DealForm'
import DealDetailModal from '../components/deals/DealDetailModal'
import { Plus, Search, Pencil, Trash2, Check, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react'

const TABS = [
  { key: 'all', label: 'All' }, { key: 'listing', label: 'Listings' },
  { key: 'active', label: 'Under Contract' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'closed', label: 'Closed' },
]

const SORTABLE_COLUMNS = {
  address: { key: 'address', label: 'Property' },
  status: { key: 'status', label: 'Status' },
  price: { key: 'price', label: 'Price', numeric: true },
  close_date: { key: 'close_date', label: 'Close Date' },
  tc_fee: { key: 'tc_fee', label: 'TC Fee', numeric: true },
}

export default function Deals() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('status') || 'all'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [editingDeal, setEditingDeal] = useState(null)
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [sortColumn, setSortColumn] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')
  const { deals, loading, createDeal, updateDeal, deleteDeal } = useDeals()
  const { agents } = useAgents()

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

  const filteredDeals = useMemo(() => {
    let filtered = deals
    if (activeTab !== 'all') filtered = filtered.filter(d => d.status === activeTab)
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(d => d.address?.toLowerCase().includes(q) || d.city?.toLowerCase().includes(q) || getAgentName(d.agent_id)?.toLowerCase().includes(q))
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const col = sortColumn
      let aVal = a[col]
      let bVal = b[col]

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

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [deals, activeTab, search, agentMap, sortColumn, sortDirection])

  const handleTabChange = (key) => { setActiveTab(key); if (key === 'all') setSearchParams({}); else setSearchParams({ status: key }) }

  const saveContacts = async (dealId, contacts) => {
    if (!contacts) return
    const roles = ['escrow', 'lender', 'client_1', 'client_2']
    await Promise.all(roles.map(r => supabase.from('contacts').delete().eq('deal_id', dealId).eq('role', r)))
    if (contacts.length) await Promise.all(contacts.map(c => supabase.from('contacts').insert({ ...c, deal_id: dealId })))
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

  const togglePaid = async (e, deal) => {
    e.stopPropagation()
    await updateDeal(deal.id, { tc_paid: !deal.tc_paid })
  }

  const SortHeader = ({ col, children, className = '' }) => {
    const isActive = sortColumn === col
    return (
      <th
        className={`px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none ${className}`}
        onClick={() => handleSort(col)}
      >
        <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
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

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => handleTabChange(tab.key)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.key ? 'border-indigo-primary text-indigo-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.label}<span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{tab.key === 'all' ? deals.length : deals.filter(d => d.status === tab.key).length}</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="w-full sm:w-80 pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Search by address, city, or agent..." value={search} onChange={e => setSearch(e.target.value)} />
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
                <th className="text-center px-4 py-3 font-medium text-gray-600 w-16">Paid</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-20">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDeals.map(deal => (
                  <tr key={deal.id} onClick={() => setSelectedDeal(deal)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{deal.address}</div>
                      <div className="text-xs text-gray-500">{[deal.city, getAgentName(deal.agent_id)].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell"><span className="text-xs text-gray-600">{getRepLabel(deal.representation)}</span></td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(deal.status)}`}>{getStatusLabel(deal.status)}</span></td>
                    <td className="px-4 py-3 text-right text-gray-700 hidden md:table-cell">{formatCurrency(deal.price)}</td>
                    <td className="px-4 py-3 text-gray-700 hidden lg:table-cell">{formatDate(deal.close_date)}</td>
                    <td className="px-4 py-3 text-right"><span className="font-medium text-gray-900">{formatCurrency(deal.tc_fee)}</span></td>
                    <td className="px-4 py-3 text-center">
                      {deal.tc_paid ? (
                        <button onClick={(e) => togglePaid(e, deal)} className="p-1 rounded text-green-600 hover:text-green-800" title="Paid — click to unmark">
                          <Check size={16} strokeWidth={3} />
                        </button>
                      ) : deal.status === 'closed' ? (
                        <button onClick={(e) => togglePaid(e, deal)} className="p-1 rounded text-amber-500 hover:text-amber-700" title="Payment outstanding — click to mark paid">
                          <AlertCircle size={16} />
                        </button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={(e) => openEdit(e, deal)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Edit"><Pencil size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(deal) }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
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

      <DealDetailModal deal={selectedDeal} open={!!selectedDeal} onClose={() => setSelectedDeal(null)} onUpdate={async (id, updates) => { const updated = await updateDeal(id, updates); if (updated) setSelectedDeal(updated) }} agentName={selectedDeal ? getAgentName(selectedDeal.agent_id) : null} coAgentName={selectedDeal ? getAgentName(selectedDeal.co_agent_id) : null} />
    </div>
  )
}
