import { useState, useEffect } from 'react'
import { useAgents, findOrCreateVendor } from '../hooks/useSupabase'
import { supabase } from '../lib/supabase'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { formatCurrency, VENDOR_TYPES } from '../lib/helpers'
import CurrencyInput from '../components/ui/CurrencyInput'
import PhoneInput from '../components/ui/PhoneInput'
import { Plus, User, Phone, Mail, Building2, Search, Trash2, Pencil } from 'lucide-react'

export default function AgentProfiles() {
  const { agents, loading, createAgent, updateAgent, deleteAgent, addVendor, updateVendor, deleteVendor, addLogin, deleteLogin } = useAgents()
  const [showNewAgent, setShowNewAgent] = useState(false)
  const [editingAgent, setEditingAgent] = useState(null)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [search, setSearch] = useState('')

  // Keep selectedAgent in sync with agents list (refreshes after vendor/login add/delete)
  useEffect(() => {
    if (selectedAgent) {
      const updated = agents.find(a => a.id === selectedAgent.id)
      if (updated) setSelectedAgent(updated)
    }
  }, [agents])

  const filtered = agents.filter(a =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.brokerage?.toLowerCase().includes(search.toLowerCase())
  )

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteAgent(deleteTarget.id)
      setDeleteTarget(null)
      if (selectedAgent?.id === deleteTarget.id) setSelectedAgent(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Agent Profiles</h2>
        <button
          onClick={() => setShowNewAgent(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700"
        >
          <Plus size={16} /> New Agent
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full sm:w-80 pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          placeholder="Search agents..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading agents...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12">No agents found</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(agent => (
            <div
              key={agent.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow relative"
            >
              {/* Edit/Delete buttons */}
              <div className="absolute top-3 right-3 flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingAgent(agent) }}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(agent) }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <button
                onClick={() => setSelectedAgent(agent)}
                className="w-full text-left"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-indigo-50 rounded-lg shrink-0">
                    <User size={18} className="text-indigo-primary" />
                  </div>
                  <div className="min-w-0 pr-12">
                    <h3 className="font-semibold text-gray-900 truncate">{agent.name}</h3>
                    {agent.brokerage && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Building2 size={12} /> {agent.brokerage}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  {agent.phone && (
                    <p className="text-gray-600 flex items-center gap-2"><Phone size={13} className="text-gray-400" /> {agent.phone}</p>
                  )}
                  {agent.email && (
                    <p className="text-gray-600 flex items-center gap-2 truncate"><Mail size={13} className="text-gray-400" /> {agent.email}</p>
                  )}
                  {agent.agent_license_number && (
                    <p className="text-xs text-gray-400">License: {agent.agent_license_number}</p>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">TC Fee: <span className="font-medium text-gray-700">{formatCurrency(agent.tc_fee)}</span></span>
                  {agent.tc_fee_double_ended && (
                    <span className="text-xs text-gray-500">Double: <span className="font-medium text-gray-700">{formatCurrency(agent.tc_fee_double_ended)}</span></span>
                  )}
                  <span className="text-xs text-gray-400">{agent.agent_vendors?.length || 0} vendors</span>
                </div>
                {agent.notes && (
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">{agent.notes}</p>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New Agent Modal */}
      <Modal open={showNewAgent} onClose={() => setShowNewAgent(false)} title="New Agent">
        <AgentForm onSubmit={async (data) => { await createAgent(data); setShowNewAgent(false) }} onCancel={() => setShowNewAgent(false)} />
      </Modal>

      {/* Edit Agent Modal */}
      <Modal open={!!editingAgent} onClose={() => setEditingAgent(null)} title="Edit Agent">
        {editingAgent && (
          <AgentForm
            onSubmit={async (data) => { await updateAgent(editingAgent.id, data); setEditingAgent(null) }}
            onCancel={() => setEditingAgent(null)}
            initialData={editingAgent}
          />
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Agent"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also delete all their vendors and logins.`}
      />

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          open={!!selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onUpdate={updateAgent}
          addVendor={addVendor}
          updateVendor={updateVendor}
          deleteVendor={deleteVendor}
          addLogin={addLogin}
          deleteLogin={deleteLogin}
        />
      )}
    </div>
  )
}

function AgentForm({ onSubmit, onCancel, initialData }) {
  const [form, setForm] = useState(initialData || {
    name: '', brokerage: '', phone: '', email: '', tc_fee: '', tc_fee_double_ended: '',
    agent_license_number: '', brokerage_license_number: '', notes: ''
  })
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value })
  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none'

  const handleSubmit = (e) => {
    e.preventDefault()
    const cleaned = { ...form }
    ;['tc_fee', 'tc_fee_double_ended'].forEach(f => {
      cleaned[f] = cleaned[f] === '' || cleaned[f] == null ? null : Number(cleaned[f])
    })
    ;['agent_license_number', 'brokerage_license_number', 'notes', 'brokerage', 'phone', 'email'].forEach(f => {
      if (cleaned[f] === '') cleaned[f] = null
    })
    // Don't send relational fields
    delete cleaned.agent_vendors
    delete cleaned.agent_logins
    onSubmit(cleaned)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input className={inputClass} value={form.name} onChange={set('name')} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brokerage</label>
          <input className={inputClass} value={form.brokerage || ''} onChange={set('brokerage')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <PhoneInput className={inputClass} value={form.phone || ''} onChange={set('phone')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input className={inputClass} value={form.email || ''} onChange={set('email')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">TC Fee</label>
          <CurrencyInput className={inputClass} value={form.tc_fee || ''} onChange={set('tc_fee')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">TC Fee (Double-Ended)</label>
          <CurrencyInput className={inputClass} value={form.tc_fee_double_ended || ''} onChange={set('tc_fee_double_ended')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Agent License #</label>
          <input className={inputClass} value={form.agent_license_number || ''} onChange={set('agent_license_number')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brokerage License #</label>
          <input className={inputClass} value={form.brokerage_license_number || ''} onChange={set('brokerage_license_number')} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea className={inputClass} rows={3} value={form.notes || ''} onChange={set('notes')} />
      </div>
      <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700">
          {initialData ? 'Update Agent' : 'Create Agent'}
        </button>
      </div>
    </form>
  )
}

function AgentDetailModal({ agent, open, onClose, onUpdate, addVendor, updateVendor, deleteVendor, addLogin, deleteLogin }) {
  const [tab, setTab] = useState('info')
  const [newVendor, setNewVendor] = useState({ vendor_type: '', company: '', name: '', phone: '', email: '', notes: '' })
  const [customVendorType, setCustomVendorType] = useState('')
  const [newLogin, setNewLogin] = useState({ system_name: '', username: '', note: '' })
  const [showAddVendor, setShowAddVendor] = useState(false)
  const [showAddLogin, setShowAddLogin] = useState(false)

  // NHD state
  const nhdVendor = agent.agent_vendors?.find(v => v.vendor_type === 'NHD')
  const [nhdForm, setNhdForm] = useState({ company: '', website: '' })
  const [nhdDirty, setNhdDirty] = useState(false)

  useEffect(() => {
    if (nhdVendor) {
      setNhdForm({ company: nhdVendor.company || '', website: nhdVendor.notes || '' })
    } else {
      setNhdForm({ company: '', website: '' })
    }
    setNhdDirty(false)
  }, [agent])

  const handleSaveNhd = async () => {
    if (nhdVendor) {
      await updateVendor(nhdVendor.id, { company: nhdForm.company || null, notes: nhdForm.website || null })
    } else {
      await addVendor(agent.id, { vendor_type: 'NHD', company: nhdForm.company || null, notes: nhdForm.website || null })
    }
    // Auto-create vendor card + preferred link (silent).
    if (nhdForm.company) {
      const v = await findOrCreateVendor({ name: nhdForm.company, vendor_type: 'NHD', notes: nhdForm.website || null })
      if (v) await supabase.from('agent_preferred_vendors').upsert({ agent_id: agent.id, vendor_id: v.id, vendor_type: 'NHD' }, { onConflict: 'agent_id,vendor_id,vendor_type' })
    }
    setNhdDirty(false)
  }

  const inputClass = 'w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none'
  const tabs = ['info', 'vendors', 'logins', 'notes']

  const handleAddVendor = async () => {
    const type = newVendor.vendor_type === '__custom__' ? customVendorType : newVendor.vendor_type
    await addVendor(agent.id, { ...newVendor, vendor_type: type })
    // Auto-create normalized vendor + preferred link (silent).
    const vendorName = newVendor.company || newVendor.name
    if (vendorName) {
      const v = await findOrCreateVendor({
        name: vendorName,
        vendor_type: type || null,
        phone: newVendor.phone || null,
        email: newVendor.email || null,
        notes: newVendor.notes || null,
      })
      if (v && type) {
        await supabase.from('agent_preferred_vendors').upsert(
          { agent_id: agent.id, vendor_id: v.id, vendor_type: type },
          { onConflict: 'agent_id,vendor_id,vendor_type' }
        )
      }
    }
    setNewVendor({ vendor_type: '', company: '', name: '', phone: '', email: '', notes: '' })
    setCustomVendorType('')
    setShowAddVendor(false)
  }

  const handleAddLogin = async () => {
    await addLogin(agent.id, newLogin)
    setNewLogin({ system_name: '', username: '', note: '' })
    setShowAddLogin(false)
  }

  return (
    <Modal open={open} onClose={onClose} title={agent.name} wide>
      <div className="flex gap-1 mb-5 border-b border-gray-200 -mx-6 px-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium capitalize whitespace-nowrap border-b-2 transition-colors ${
              tab === t ? 'border-indigo-primary text-indigo-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'info' ? 'Contact Info' : t}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="space-y-3">
          {[
            { label: 'Brokerage', value: agent.brokerage },
            { label: 'Phone', value: agent.phone },
            { label: 'Email', value: agent.email },
            { label: 'TC Fee', value: formatCurrency(agent.tc_fee) },
            { label: 'TC Fee (Double)', value: formatCurrency(agent.tc_fee_double_ended) },
            { label: 'Agent License #', value: agent.agent_license_number },
            { label: 'Brokerage License #', value: agent.brokerage_license_number },
          ].map(f => (
            <div key={f.label} className="flex gap-4">
              <span className="text-sm text-gray-500 w-36 shrink-0">{f.label}</span>
              <span className="text-sm text-gray-900">{f.value || '—'}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'vendors' && (
        <div className="space-y-3">
          {/* NHD Section */}
          <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-amber-800">NHD (Natural Hazard Disclosure)</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Company Name</label>
                <input className={inputClass} value={nhdForm.company} onChange={e => { setNhdForm({ ...nhdForm, company: e.target.value }); setNhdDirty(true) }} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Website</label>
                <input className={inputClass} value={nhdForm.website} onChange={e => { setNhdForm({ ...nhdForm, website: e.target.value }); setNhdDirty(true) }} />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={handleSaveNhd} disabled={!nhdDirty} className={`text-xs px-3 py-1 rounded-lg ${nhdDirty ? 'text-white bg-amber-600 hover:bg-amber-700' : 'text-gray-400 bg-gray-100 cursor-not-allowed'}`}>
                {nhdVendor ? 'Update NHD' : 'Save NHD'}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold text-gray-700">Preferred Vendors</h4>
            <button onClick={() => setShowAddVendor(true)} className="text-xs text-indigo-primary hover:text-indigo-700 font-medium">+ Add Vendor</button>
          </div>

          {showAddVendor && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <select className={inputClass} value={newVendor.vendor_type} onChange={e => setNewVendor({ ...newVendor, vendor_type: e.target.value })}>
                    <option value="">Select type...</option>
                    {VENDOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="__custom__">Custom...</option>
                  </select>
                  {newVendor.vendor_type === '__custom__' && (
                    <input className={inputClass + ' mt-1'} placeholder="Custom type" value={customVendorType} onChange={e => setCustomVendorType(e.target.value)} />
                  )}
                </div>
                <input className={inputClass} placeholder="Company Name" value={newVendor.company} onChange={e => setNewVendor({ ...newVendor, company: e.target.value })} />
                <input className={inputClass} placeholder="Rep / Contact Name" value={newVendor.name} onChange={e => setNewVendor({ ...newVendor, name: e.target.value })} />
                <PhoneInput className={inputClass} placeholder="Phone" value={newVendor.phone} onChange={e => setNewVendor({ ...newVendor, phone: e.target.value })} />
                <input className={inputClass} placeholder="Email" value={newVendor.email} onChange={e => setNewVendor({ ...newVendor, email: e.target.value })} />
                <input className={inputClass} placeholder="Notes / Misc" value={newVendor.notes} onChange={e => setNewVendor({ ...newVendor, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddVendor(false)} className="text-xs text-gray-500">Cancel</button>
                <button onClick={handleAddVendor} className="text-xs text-white bg-indigo-primary px-3 py-1 rounded-lg">Add</button>
              </div>
            </div>
          )}

          {(agent.agent_vendors?.filter(v => v.vendor_type !== 'NHD').length || 0) === 0 && !showAddVendor ? (
            <p className="text-sm text-gray-400">No vendors added</p>
          ) : (
            agent.agent_vendors?.filter(v => v.vendor_type !== 'NHD').map(v => (
              <div key={v.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div className="text-sm space-y-0.5">
                  <div><span className="font-medium text-gray-700">{v.vendor_type}</span></div>
                  {v.company && <div className="text-gray-900">{v.company}</div>}
                  {v.name && <div className="text-gray-600">Rep: {v.name}</div>}
                  <div className="flex gap-3 text-xs text-gray-500">
                    {v.phone && <span>{v.phone}</span>}
                    {v.email && <span>{v.email}</span>}
                    {v.contact && !v.phone && <span>{v.contact}</span>}
                  </div>
                  {v.notes && <div className="text-xs text-gray-400">{v.notes}</div>}
                </div>
                <button onClick={() => deleteVendor(v.id)} className="text-gray-400 hover:text-red-500 shrink-0 mt-1"><Trash2 size={14} /></button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'logins' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold text-gray-700">System Logins</h4>
            <button onClick={() => setShowAddLogin(true)} className="text-xs text-indigo-primary hover:text-indigo-700 font-medium">+ Add Login</button>
          </div>

          {showAddLogin && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <input className={inputClass} placeholder="System Name" value={newLogin.system_name} onChange={e => setNewLogin({ ...newLogin, system_name: e.target.value })} />
                <input className={inputClass} placeholder="Username" value={newLogin.username} onChange={e => setNewLogin({ ...newLogin, username: e.target.value })} />
                <input className={inputClass} placeholder="Note" value={newLogin.note} onChange={e => setNewLogin({ ...newLogin, note: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddLogin(false)} className="text-xs text-gray-500">Cancel</button>
                <button onClick={handleAddLogin} className="text-xs text-white bg-indigo-primary px-3 py-1 rounded-lg">Add</button>
              </div>
            </div>
          )}

          {(agent.agent_logins?.length || 0) === 0 && !showAddLogin ? (
            <p className="text-sm text-gray-400">No logins added</p>
          ) : (
            agent.agent_logins?.map(l => (
              <div key={l.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="text-sm">
                  <span className="font-medium text-gray-700">{l.system_name}:</span>{' '}
                  <span className="text-gray-900">{l.username}</span>
                  {l.note && <span className="text-gray-500"> · {l.note}</span>}
                </div>
                <button onClick={() => deleteLogin(l.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{agent.notes || 'No notes'}</p>
        </div>
      )}
    </Modal>
  )
}
