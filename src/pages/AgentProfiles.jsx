import { useState } from 'react'
import { useAgents } from '../hooks/useSupabase'
import Modal from '../components/ui/Modal'
import { formatCurrency } from '../lib/helpers'
import { Plus, User, Phone, Mail, Building2, Search, Trash2 } from 'lucide-react'

export default function AgentProfiles() {
  const { agents, loading, createAgent, updateAgent, addVendor, deleteVendor, addLogin, deleteLogin } = useAgents()
  const [showNewAgent, setShowNewAgent] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = agents.filter(a =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.brokerage?.toLowerCase().includes(search.toLowerCase())
  )

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
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-indigo-50 rounded-lg shrink-0">
                  <User size={18} className="text-indigo-primary" />
                </div>
                <div className="min-w-0">
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
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">TC Fee: <span className="font-medium text-gray-700">{formatCurrency(agent.tc_fee)}</span></span>
                <span className="text-xs text-gray-400">{agent.agent_vendors?.length || 0} vendors</span>
              </div>
              {agent.notes && (
                <p className="text-xs text-gray-400 mt-2 line-clamp-2">{agent.notes}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* New Agent Modal */}
      <Modal open={showNewAgent} onClose={() => setShowNewAgent(false)} title="New Agent">
        <AgentForm onSubmit={async (data) => { await createAgent(data); setShowNewAgent(false) }} onCancel={() => setShowNewAgent(false)} />
      </Modal>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          open={!!selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onUpdate={updateAgent}
          addVendor={addVendor}
          deleteVendor={deleteVendor}
          addLogin={addLogin}
          deleteLogin={deleteLogin}
        />
      )}
    </div>
  )
}

function AgentForm({ onSubmit, onCancel, initialData }) {
  const [form, setForm] = useState(initialData || { name: '', brokerage: '', phone: '', email: '', tc_fee: '', notes: '' })
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value })
  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none'

  const handleSubmit = (e) => {
    e.preventDefault()
    const cleaned = { ...form, tc_fee: form.tc_fee === '' ? null : Number(form.tc_fee) }
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
          <input className={inputClass} value={form.brokerage} onChange={set('brokerage')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input className={inputClass} value={form.phone} onChange={set('phone')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input className={inputClass} value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">TC Fee</label>
          <input type="number" className={inputClass} value={form.tc_fee} onChange={set('tc_fee')} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea className={inputClass} rows={3} value={form.notes} onChange={set('notes')} />
      </div>
      <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700">
          {initialData ? 'Update' : 'Create Agent'}
        </button>
      </div>
    </form>
  )
}

function AgentDetailModal({ agent, open, onClose, onUpdate, addVendor, deleteVendor, addLogin, deleteLogin }) {
  const [tab, setTab] = useState('info')
  const [newVendor, setNewVendor] = useState({ vendor_type: '', name: '', contact: '' })
  const [newLogin, setNewLogin] = useState({ system_name: '', username: '', note: '' })
  const [showAddVendor, setShowAddVendor] = useState(false)
  const [showAddLogin, setShowAddLogin] = useState(false)

  const inputClass = 'w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none'
  const tabs = ['info', 'vendors', 'logins', 'notes']

  const handleAddVendor = async () => {
    await addVendor(agent.id, newVendor)
    setNewVendor({ vendor_type: '', name: '', contact: '' })
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
          ].map(f => (
            <div key={f.label} className="flex gap-4">
              <span className="text-sm text-gray-500 w-24 shrink-0">{f.label}</span>
              <span className="text-sm text-gray-900">{f.value || '—'}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'vendors' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold text-gray-700">Preferred Vendors</h4>
            <button onClick={() => setShowAddVendor(true)} className="text-xs text-indigo-primary hover:text-indigo-700 font-medium">+ Add Vendor</button>
          </div>

          {showAddVendor && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <input className={inputClass} placeholder="Type (e.g. Title)" value={newVendor.vendor_type} onChange={e => setNewVendor({ ...newVendor, vendor_type: e.target.value })} />
                <input className={inputClass} placeholder="Name" value={newVendor.name} onChange={e => setNewVendor({ ...newVendor, name: e.target.value })} />
                <input className={inputClass} placeholder="Contact" value={newVendor.contact} onChange={e => setNewVendor({ ...newVendor, contact: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddVendor(false)} className="text-xs text-gray-500">Cancel</button>
                <button onClick={handleAddVendor} className="text-xs text-white bg-indigo-primary px-3 py-1 rounded-lg">Add</button>
              </div>
            </div>
          )}

          {(agent.agent_vendors?.length || 0) === 0 && !showAddVendor ? (
            <p className="text-sm text-gray-400">No vendors added</p>
          ) : (
            agent.agent_vendors?.map(v => (
              <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="text-sm">
                  <span className="font-medium text-gray-700">{v.vendor_type}:</span>{' '}
                  <span className="text-gray-900">{v.name}</span>
                  {v.contact && <span className="text-gray-500"> · {v.contact}</span>}
                </div>
                <button onClick={() => deleteVendor(v.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
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
