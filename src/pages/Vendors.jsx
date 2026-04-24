import { useState, useEffect, useMemo } from 'react'
import { useVendors, useDeals, useAgents } from '../hooks/useSupabase'
import { supabase } from '../lib/supabase'
import { VENDOR_TYPES } from '../lib/helpers'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import VendorDetailModal from '../components/vendors/VendorDetailModal'
import { Plus, Search, Star, ChevronUp, ChevronDown, Pencil, Trash2, AlertTriangle } from 'lucide-react'

const SORTABLE = {
  name:       { label: 'Name' },
  vendor_type:{ label: 'Type' },
  deal_count: { label: 'Deals', numeric: true },
}

export default function Vendors() {
  const { vendors, preferences, loading, createVendor, updateVendor, deleteVendor, mergeVendor, fetchAll } = useVendors()
  const { deals } = useDeals()
  const { agents } = useAgents()

  const [search, setSearch] = useState('')
  const [sortColumn, setSortColumn] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [selectedId, setSelectedId] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Vendor IDs in use on deals (via contacts.vendor_id).
  const [dealCountByVendor, setDealCountByVendor] = useState({})
  // Contacts-by-vendor (used in detail modal) fetched globally once.
  const [contactsByVendor, setContactsByVendor] = useState({})

  useEffect(() => {
    supabase.from('contacts').select('deal_id, vendor_id').then(({ data }) => {
      const byDeal = {}
      const byVendor = {}
      ;(data || []).forEach(c => {
        if (c.vendor_id) {
          byDeal[c.vendor_id] = byDeal[c.vendor_id] || new Set()
          byDeal[c.vendor_id].add(c.deal_id)
          byVendor[c.vendor_id] = byVendor[c.vendor_id] || []
          byVendor[c.vendor_id].push(c.deal_id)
        }
      })
      const counts = {}
      Object.entries(byDeal).forEach(([vid, set]) => { counts[vid] = set.size })
      setDealCountByVendor(counts)
      setContactsByVendor(byVendor)
    })
  }, [vendors])

  const preferredByVendor = useMemo(() => {
    const m = {}
    preferences.forEach(p => {
      m[p.vendor_id] = m[p.vendor_id] || []
      m[p.vendor_id].push(p)
    })
    return m
  }, [preferences])

  // Near-duplicate detection: same type + shared prefix (≥4 chars) + edit dist ≤ 2 roughly.
  // Conservative — only surfaces obvious candidates.
  const duplicateGroups = useMemo(() => {
    const groups = []
    const byType = {}
    vendors.forEach(v => {
      const key = v.vendor_type || 'Other'
      byType[key] = byType[key] || []
      byType[key].push(v)
    })
    Object.values(byType).forEach(list => {
      const byPrefix = {}
      list.forEach(v => {
        const prefix = (v.name || '').trim().toLowerCase().slice(0, 4)
        if (prefix.length < 4) return
        byPrefix[prefix] = byPrefix[prefix] || []
        byPrefix[prefix].push(v)
      })
      Object.values(byPrefix).forEach(group => {
        if (group.length >= 2) groups.push(group)
      })
    })
    return groups
  }, [vendors])

  const handleSort = (col) => {
    if (sortColumn === col) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortColumn(col); setSortDirection('asc') }
  }

  const filtered = useMemo(() => {
    let list = vendors
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(v => v.name?.toLowerCase().includes(q) || v.vendor_type?.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      let av, bv
      if (sortColumn === 'deal_count') {
        av = dealCountByVendor[a.id] || 0
        bv = dealCountByVendor[b.id] || 0
      } else {
        av = (a[sortColumn] || '').toLowerCase()
        bv = (b[sortColumn] || '').toLowerCase()
      }
      if (av < bv) return sortDirection === 'asc' ? -1 : 1
      if (av > bv) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [vendors, search, sortColumn, sortDirection, dealCountByVendor])

  const selected = vendors.find(v => v.id === selectedId) || null

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteVendor(deleteTarget.id)
      setDeleteTarget(null)
    }
  }

  const SortTh = ({ col, children, className = '' }) => (
    <th
      onClick={() => handleSort(col)}
      className={`px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none ${className}`}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        {children}
        {sortColumn === col
          ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-600" /> : <ChevronDown size={14} className="text-indigo-600" />)
          : <ChevronDown size={14} className="text-gray-300" />}
      </div>
    </th>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Vendors</h2>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700">
          <Plus size={16} /> New Vendor
        </button>
      </div>

      {duplicateGroups.length > 0 && (
        <div className="flex items-start gap-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <span className="font-medium">Possible duplicates detected</span>
            <span className="text-amber-700"> · {duplicateGroups.length} group{duplicateGroups.length === 1 ? '' : 's'} sharing name prefix + type. Open the vendor and use Merge to consolidate.</span>
            <div className="mt-1 text-xs text-amber-600 flex flex-wrap gap-x-3 gap-y-1">
              {duplicateGroups.slice(0, 5).map((group, i) => (
                <span key={i}>{group.map(v => v.name).join(' / ')}</span>
              ))}
              {duplicateGroups.length > 5 && <span>+{duplicateGroups.length - 5} more</span>}
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full sm:w-80 pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          placeholder="Search vendors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading vendors...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12">No vendors found</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <SortTh col="name" className="text-left">Name</SortTh>
                  <SortTh col="vendor_type" className="text-left">Type</SortTh>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Contact</th>
                  <SortTh col="deal_count" className="text-right">Deals</SortTh>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(v => {
                  const prefCount = (preferredByVendor[v.id] || []).length
                  const dealCount = dealCountByVendor[v.id] || 0
                  return (
                    <tr key={v.id} onClick={() => setSelectedId(v.id)} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {prefCount > 0 && <Star size={14} className="text-amber-500 fill-amber-400 shrink-0" />}
                          <span className="font-medium text-gray-900">{v.name}</span>
                        </div>
                        {prefCount > 0 && <div className="text-xs text-gray-400">Preferred by {prefCount} agent{prefCount === 1 ? '' : 's'}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {v.vendor_type ? <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700">{v.vendor_type}</span> : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="text-xs text-gray-500">
                          {v.phone && <div>{v.phone}</div>}
                          {v.email && <div className="truncate max-w-[200px]">{v.email}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{dealCount}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(v) }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Vendor">
        <VendorForm onSubmit={async (data) => { await createVendor(data); setShowNew(false) }} onCancel={() => setShowNew(false)} />
      </Modal>

      {selected && (
        <VendorDetailModal
          vendor={selected}
          open={!!selected}
          onClose={() => setSelectedId(null)}
          vendors={vendors}
          agents={agents}
          deals={deals}
          preferences={preferences}
          contactsByVendor={contactsByVendor}
          dealCountByVendor={dealCountByVendor}
          onUpdate={updateVendor}
          onMerge={async (toId) => { await mergeVendor(selected.id, toId); setSelectedId(toId) }}
          refetch={fetchAll}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Vendor"
        message={`Delete "${deleteTarget?.name}"? Contacts and agent preferences will be unlinked but their text data remains.`}
      />
    </div>
  )
}

function VendorForm({ initialData, onSubmit, onCancel }) {
  const [form, setForm] = useState(initialData || { name: '', vendor_type: '', phone: '', email: '', notes: '' })
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value })
  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none'

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name?.trim()) return
    onSubmit({ ...form, name: form.name.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
        <input className={inp} value={form.name} onChange={set('name')} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <select className={inp} value={form.vendor_type || ''} onChange={set('vendor_type')}>
            <option value="">— Select —</option>
            {VENDOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
          <input className={inp} value={form.phone || ''} onChange={set('phone')} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
          <input className={inp} value={form.email || ''} onChange={set('email')} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
        <textarea className={inp} rows={3} value={form.notes || ''} onChange={set('notes')} />
      </div>
      <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700">{initialData ? 'Save' : 'Create'}</button>
      </div>
    </form>
  )
}
