import { useState, useEffect, useMemo } from 'react'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { supabase } from '../../lib/supabase'
import { VENDOR_TYPES, formatDate } from '../../lib/helpers'
import { Star, Combine, Save, Pencil } from 'lucide-react'

// Vendor detail + merge tool. Uses in-place editing for contact info, shows
// "Preferred by" agents, groups deals by the deal's assigned agent.
export default function VendorDetailModal({ vendor, open, onClose, vendors, agents, deals, preferences, contactsByVendor, onUpdate, onMerge, refetch }) {
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState({})
  const [dealFilter, setDealFilter] = useState('active') // 'active' | 'all'
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [confirmMerge, setConfirmMerge] = useState(false)

  useEffect(() => {
    setForm({ name: vendor.name || '', vendor_type: vendor.vendor_type || '', phone: vendor.phone || '', email: vendor.email || '', notes: vendor.notes || '' })
    setEdit(false)
  }, [vendor.id])

  const agentsById = useMemo(() => {
    const m = {}; agents.forEach(a => { m[a.id] = a }); return m
  }, [agents])

  const dealsById = useMemo(() => {
    const m = {}; deals.forEach(d => { m[d.id] = d }); return m
  }, [deals])

  // Agents that have this vendor marked as preferred.
  const preferredBy = useMemo(() => {
    const rows = preferences.filter(p => p.vendor_id === vendor.id)
    // Collapse by agent — one row per agent, with list of vendor_types.
    const byAgent = {}
    rows.forEach(p => {
      byAgent[p.agent_id] = byAgent[p.agent_id] || { agent: agentsById[p.agent_id], types: [] }
      if (p.vendor_type && !byAgent[p.agent_id].types.includes(p.vendor_type)) byAgent[p.agent_id].types.push(p.vendor_type)
    })
    return Object.values(byAgent).filter(r => r.agent)
  }, [preferences, vendor.id, agentsById])

  // Deals attributed to this vendor (through contacts.vendor_id).
  const attributedDealIds = contactsByVendor[vendor.id] || []
  const uniqueDeals = useMemo(() => {
    const seen = new Set()
    const result = []
    attributedDealIds.forEach(id => {
      if (!seen.has(id) && dealsById[id]) {
        seen.add(id)
        result.push(dealsById[id])
      }
    })
    if (dealFilter === 'active') return result.filter(d => d.status === 'active' || d.status === 'listing')
    return result
  }, [attributedDealIds, dealsById, dealFilter])

  const dealsByAgent = useMemo(() => {
    const m = {}
    uniqueDeals.forEach(d => {
      const key = d.agent_id || 'unassigned'
      m[key] = m[key] || []
      m[key].push(d)
    })
    return m
  }, [uniqueDeals])

  const handleSave = async () => {
    const patch = { ...form }
    ;['vendor_type', 'phone', 'email', 'notes'].forEach(k => { if (!patch[k]) patch[k] = null })
    await onUpdate(vendor.id, patch)
    setEdit(false)
  }

  const handleMerge = async () => {
    if (!mergeTargetId) return
    await onMerge(mergeTargetId)
    setConfirmMerge(false)
    setMergeTargetId('')
  }

  const inp = 'w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none'
  const mergeTarget = vendors.find(v => v.id === mergeTargetId)

  return (
    <Modal open={open} onClose={onClose} title={vendor.name} wide>
      {/* Contact info */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-semibold text-gray-800">Vendor Info</h4>
          <button
            onClick={() => edit ? handleSave() : setEdit(true)}
            className="inline-flex items-center gap-1 text-sm text-indigo-primary hover:text-indigo-700 font-medium"
          >
            {edit ? <><Save size={14} /> Save</> : <><Pencil size={14} /> Edit</>}
          </button>
        </div>

        {edit ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input className={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select className={inp} value={form.vendor_type} onChange={e => setForm({ ...form, vendor_type: e.target.value })}>
                <option value="">— Select —</option>
                {VENDOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input className={inp} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input className={inp} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <textarea className={inp} rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div><dt className="text-xs text-gray-500">Type</dt><dd className="text-gray-900">{vendor.vendor_type || '—'}</dd></div>
            <div><dt className="text-xs text-gray-500">Phone</dt><dd className="text-gray-900">{vendor.phone || '—'}</dd></div>
            <div><dt className="text-xs text-gray-500">Email</dt><dd className="text-gray-900">{vendor.email || '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-gray-500">Notes</dt><dd className="text-gray-900 whitespace-pre-wrap">{vendor.notes || '—'}</dd></div>
          </dl>
        )}
      </div>

      {/* Preferred by */}
      <div className="mb-5 pt-4 border-t border-gray-100">
        <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
          <Star size={14} className="text-amber-500 fill-amber-400" /> Preferred by
        </h4>
        {preferredBy.length === 0 ? (
          <p className="text-sm text-gray-400">Not marked as preferred by any agent</p>
        ) : (
          <div className="space-y-1">
            {preferredBy.map(({ agent, types }) => (
              <div key={agent.id} className="flex items-center justify-between text-sm bg-amber-50/50 px-3 py-1.5 rounded-lg border border-amber-100">
                <span className="font-medium text-gray-800">{agent.name}</span>
                <span className="text-xs text-amber-700">{types.filter(Boolean).join(' · ') || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deals */}
      <div className="mb-5 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-800">Deals ({uniqueDeals.length})</h4>
          <div className="inline-flex rounded border border-gray-300 overflow-hidden text-xs">
            {['active', 'all'].map((key, i) => (
              <button
                key={key}
                onClick={() => setDealFilter(key)}
                className={`px-2 py-1 ${i > 0 ? 'border-l border-gray-300' : ''} ${dealFilter === key ? 'bg-indigo-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                {key === 'active' ? 'Active' : 'All'}
              </button>
            ))}
          </div>
        </div>
        {Object.keys(dealsByAgent).length === 0 ? (
          <p className="text-sm text-gray-400">No deals found</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(dealsByAgent).map(([agentId, dealList]) => {
              const agent = agentsById[agentId]
              return (
                <div key={agentId} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-800 mb-1.5">
                    {agent?.name || 'Unassigned'} <span className="text-xs text-gray-500 font-normal">· {dealList.length} deal{dealList.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="space-y-1">
                    {dealList.map(d => (
                      <div key={d.id} className="text-sm flex items-center justify-between">
                        <span className="text-gray-900">{d.address}</span>
                        <span className="text-xs text-gray-500">{d.status} · {formatDate(d.close_date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Merge */}
      <div className="pt-4 border-t border-gray-100">
        <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
          <Combine size={14} className="text-gray-500" /> Merge with another vendor
        </h4>
        <p className="text-xs text-gray-500 mb-2">
          Pick a vendor to merge INTO this one. All deals + agent preferences reassign; the other vendor is deleted.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={mergeTargetId}
            onChange={e => setMergeTargetId(e.target.value)}
            className={inp + ' flex-1'}
          >
            <option value="">— Select vendor to merge in —</option>
            {vendors.filter(v => v.id !== vendor.id).map(v => (
              <option key={v.id} value={v.id}>{v.name}{v.vendor_type ? ` (${v.vendor_type})` : ''}</option>
            ))}
          </select>
          <button
            onClick={() => setConfirmMerge(true)}
            disabled={!mergeTargetId}
            className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700 disabled:opacity-40"
          >
            Merge
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmMerge}
        onConfirm={handleMerge}
        onCancel={() => setConfirmMerge(false)}
        title="Merge vendors?"
        message={mergeTarget ? `"${mergeTarget.name}" will be deleted. Its deals and agent preferences will move to "${vendor.name}". This cannot be undone.` : ''}
      />
    </Modal>
  )
}
