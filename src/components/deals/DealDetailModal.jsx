import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { useContingencies, useContacts, useDealHistory } from '../../hooks/useSupabase'
import { formatDate, formatCurrency, daysUntil, getStatusLabel } from '../../lib/helpers'
import { supabase } from '../../lib/supabase'
import { AlertTriangle } from 'lucide-react'

const TABS = ['Details', 'Timeline', 'Contacts', 'Financials', 'History']
const CONTINGENCY_FIELDS = ['loan', 'appraisal', 'inspection', 'disclosures', 'hoa', 'insurability', 'prelim']
const CONTACT_ROLES = [
  { value: 'listing_agent', label: 'Listing Agent' },
  { value: 'buyer_agent', label: 'Buyer Agent' },
  { value: 'lender', label: 'Lender' },
  { value: 'escrow', label: 'Escrow' },
]

export default function DealDetailModal({ deal, open, onClose, onUpdate }) {
  const [tab, setTab] = useState('Details')
  const { contingencies, upsertContingencies } = useContingencies(deal?.id)
  const { contacts, extraContacts, upsertContact, addExtraContact, deleteExtraContact } = useContacts(deal?.id)
  const { history, addEntry } = useDealHistory(deal?.id)

  if (!deal) return null
  const isCancelled = deal.status === 'cancelled'

  return (
    <Modal open={open} onClose={onClose} title={deal.address} wide>
      {isCancelled && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg mb-4 -mt-1">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <span className="text-sm font-medium text-red-700">This deal has been cancelled</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200 -mx-6 px-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t
                ? 'border-indigo-primary text-indigo-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Details' && <DetailsTab deal={deal} onUpdate={onUpdate} />}
      {tab === 'Timeline' && <TimelineTab deal={deal} contingencies={contingencies} upsertContingencies={upsertContingencies} />}
      {tab === 'Contacts' && <ContactsTab contacts={contacts} extraContacts={extraContacts} upsertContact={upsertContact} addExtraContact={addExtraContact} deleteExtraContact={deleteExtraContact} />}
      {tab === 'Financials' && <FinancialsTab deal={deal} onUpdate={onUpdate} />}
      {tab === 'History' && <HistoryTab history={history} addEntry={addEntry} />}
    </Modal>
  )
}

function DetailsTab({ deal, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => {
    setForm({
      acceptance_date: deal.acceptance_date || '',
      close_date: deal.close_date || '',
      possession_date: deal.possession_date || '',
      inspection_date: deal.inspection_date || '',
      disclosures_sent: deal.disclosures_sent || '',
      other_tc: deal.other_tc || '',
      notes: deal.notes || '',
    })
  }, [deal])

  const handleSave = async () => {
    const cleaned = { ...form }
    Object.keys(cleaned).forEach(k => { if (cleaned[k] === '') cleaned[k] = null })
    await onUpdate(deal.id, cleaned)
    setEditing(false)
  }

  const inputClass = 'w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none'
  const fields = [
    { key: 'acceptance_date', label: 'Acceptance Date', type: 'date' },
    { key: 'close_date', label: 'Close Date', type: 'date' },
    { key: 'possession_date', label: 'Possession Date', type: 'date' },
    { key: 'inspection_date', label: 'Inspection Date', type: 'date' },
    { key: 'disclosures_sent', label: 'Disclosures Sent', type: 'date' },
    { key: 'other_tc', label: 'Other TC', type: 'text' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <span className="text-sm text-gray-500">Status:</span>
          <span className="text-sm font-medium">{getStatusLabel(deal.status)}</span>
        </div>
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          className="text-sm text-indigo-primary hover:text-indigo-700 font-medium"
        >
          {editing ? 'Save' : 'Edit'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map(f => (
          <div key={f.key}>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{f.label}</label>
            {editing ? (
              <input
                type={f.type}
                className={inputClass}
                value={form[f.key] || ''}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              />
            ) : (
              <p className="text-sm text-gray-900 mt-0.5">{f.type === 'date' ? formatDate(deal[f.key]) : (deal[f.key] || '—')}</p>
            )}
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</label>
        {editing ? (
          <textarea
            className={inputClass}
            rows={3}
            value={form.notes || ''}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />
        ) : (
          <p className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">{deal.notes || '—'}</p>
        )}
      </div>
    </div>
  )
}

function TimelineTab({ deal, contingencies, upsertContingencies }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => {
    const initial = {}
    CONTINGENCY_FIELDS.forEach(f => { initial[f] = contingencies?.[f] || '' })
    setForm(initial)
  }, [contingencies])

  const handleSave = async () => {
    const cleaned = { ...form }
    Object.keys(cleaned).forEach(k => { if (cleaned[k] === '') cleaned[k] = null })
    await upsertContingencies(cleaned)
    setEditing(false)
  }

  const getDaysColor = (days) => {
    if (days === null) return 'text-gray-400'
    if (days < 0) return 'text-red-600'
    if (days <= 3) return 'text-red-500'
    if (days <= 7) return 'text-orange-500'
    if (days <= 14) return 'text-yellow-600'
    return 'text-green-600'
  }

  const items = CONTINGENCY_FIELDS.map(f => ({
    key: f,
    label: f.charAt(0).toUpperCase() + f.slice(1),
    date: contingencies?.[f],
    days: daysUntil(contingencies?.[f]),
  }))

  const closeDate = deal.close_date
  const closeDays = daysUntil(closeDate)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-gray-700">Contingency Dates</h4>
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          className="text-sm text-indigo-primary hover:text-indigo-700 font-medium"
        >
          {editing ? 'Save' : 'Edit'}
        </button>
      </div>

      {/* Close of Escrow - highlighted */}
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-red-800">Close of Escrow</p>
          <p className="text-xs text-red-600">{formatDate(closeDate)}</p>
        </div>
        {closeDays !== null && (
          <span className={`text-sm font-bold ${getDaysColor(closeDays)}`}>
            {closeDays === 0 ? 'Today' : closeDays > 0 ? `${closeDays} days` : `${Math.abs(closeDays)}d ago`}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{item.label}</p>
              {editing ? (
                <input
                  type="date"
                  className="mt-1 px-2 py-1 border border-gray-300 rounded text-sm w-full max-w-xs"
                  value={form[item.key] || ''}
                  onChange={e => setForm({ ...form, [item.key]: e.target.value })}
                />
              ) : (
                <p className="text-xs text-gray-500">{formatDate(item.date)}</p>
              )}
            </div>
            {!editing && item.days !== null && (
              <span className={`text-sm font-semibold ${getDaysColor(item.days)}`}>
                {item.days === 0 ? 'Today' : item.days > 0 ? `${item.days}d` : `${Math.abs(item.days)}d ago`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ContactsTab({ contacts, extraContacts, upsertContact, addExtraContact, deleteExtraContact }) {
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({})
  const [newExtra, setNewExtra] = useState({ role_label: '', name: '', phone: '', email: '' })
  const [showAddExtra, setShowAddExtra] = useState(false)

  const inputClass = 'w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none'

  const startEdit = (contact) => {
    setEditingId(contact.role)
    setForm({ ...contact })
  }

  const saveContact = async () => {
    await upsertContact(form)
    setEditingId(null)
  }

  const handleAddExtra = async () => {
    await addExtraContact(newExtra)
    setNewExtra({ role_label: '', name: '', phone: '', email: '' })
    setShowAddExtra(false)
  }

  return (
    <div className="space-y-6">
      {CONTACT_ROLES.map(role => {
        const contact = contacts.find(c => c.role === role.value) || { role: role.value }
        const isEditing = editingId === role.value
        return (
          <div key={role.value} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-gray-800">{role.label}</h4>
              <button
                onClick={() => isEditing ? saveContact() : startEdit(contact)}
                className="text-xs text-indigo-primary hover:text-indigo-700 font-medium"
              >
                {isEditing ? 'Save' : 'Edit'}
              </button>
            </div>
            {isEditing ? (
              <div className="grid grid-cols-2 gap-2">
                <input className={inputClass} placeholder="Name" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
                <input className={inputClass} placeholder="Phone" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <input className={inputClass} placeholder="Email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
                <input className={inputClass} placeholder="Company" value={form.company || ''} onChange={e => setForm({ ...form, company: e.target.value })} />
                <input className={inputClass} placeholder="Officer" value={form.officer || ''} onChange={e => setForm({ ...form, officer: e.target.value })} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-1 text-sm">
                <span className="text-gray-500">Name:</span><span className="text-gray-900">{contact.name || '—'}</span>
                <span className="text-gray-500">Phone:</span><span className="text-gray-900">{contact.phone || '—'}</span>
                <span className="text-gray-500">Email:</span><span className="text-gray-900">{contact.email || '—'}</span>
                <span className="text-gray-500">Company:</span><span className="text-gray-900">{contact.company || '—'}</span>
                <span className="text-gray-500">Officer:</span><span className="text-gray-900">{contact.officer || '—'}</span>
              </div>
            )}
          </div>
        )
      })}

      {/* Extra contacts */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-semibold text-gray-800">Additional Contacts</h4>
          <button onClick={() => setShowAddExtra(true)} className="text-xs text-indigo-primary hover:text-indigo-700 font-medium">
            + Add Contact
          </button>
        </div>

        {showAddExtra && (
          <div className="border border-gray-200 rounded-lg p-3 mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} placeholder="Role / Label" value={newExtra.role_label} onChange={e => setNewExtra({ ...newExtra, role_label: e.target.value })} />
              <input className={inputClass} placeholder="Name" value={newExtra.name} onChange={e => setNewExtra({ ...newExtra, name: e.target.value })} />
              <input className={inputClass} placeholder="Phone" value={newExtra.phone} onChange={e => setNewExtra({ ...newExtra, phone: e.target.value })} />
              <input className={inputClass} placeholder="Email" value={newExtra.email} onChange={e => setNewExtra({ ...newExtra, email: e.target.value })} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddExtra(false)} className="text-xs text-gray-500">Cancel</button>
              <button onClick={handleAddExtra} className="text-xs text-white bg-indigo-primary px-3 py-1 rounded-lg">Add</button>
            </div>
          </div>
        )}

        {extraContacts.length === 0 && !showAddExtra && (
          <p className="text-sm text-gray-400">No additional contacts</p>
        )}

        {extraContacts.map(ec => (
          <div key={ec.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
            <div className="text-sm">
              <span className="font-medium text-gray-700">{ec.role_label}:</span>{' '}
              <span className="text-gray-900">{ec.name}</span>
              {ec.phone && <span className="text-gray-500"> · {ec.phone}</span>}
              {ec.email && <span className="text-gray-500"> · {ec.email}</span>}
            </div>
            <button onClick={() => deleteExtraContact(ec.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function FinancialsTab({ deal, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => {
    setForm({
      price: deal.price || '',
      commission_buyer: deal.commission_buyer || '',
      commission_seller: deal.commission_seller || '',
      concessions: deal.concessions || '',
      tc_fee: deal.tc_fee || '',
      tc_paid: deal.tc_paid || false,
      tc_paid_by: deal.tc_paid_by || '',
    })
  }, [deal])

  const handleSave = async () => {
    const cleaned = { ...form }
    ;['price', 'commission_buyer', 'commission_seller', 'concessions', 'tc_fee'].forEach(f => {
      cleaned[f] = cleaned[f] === '' ? null : Number(cleaned[f])
    })
    if (cleaned.tc_paid_by === '') cleaned.tc_paid_by = null
    await onUpdate(deal.id, cleaned)
    setEditing(false)
  }

  const inputClass = 'w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none'

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          className="text-sm text-indigo-primary hover:text-indigo-700 font-medium"
        >
          {editing ? 'Save' : 'Edit'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { key: 'price', label: 'Price', format: v => formatCurrency(v) },
          { key: 'commission_buyer', label: 'Buyer Commission (%)', format: v => v ? `${v}%` : '—' },
          { key: 'commission_seller', label: 'Seller Commission (%)', format: v => v ? `${v}%` : '—' },
          { key: 'concessions', label: 'Concessions', format: v => formatCurrency(v) },
          { key: 'tc_fee', label: 'TC Fee', format: v => formatCurrency(v) },
          { key: 'tc_paid_by', label: 'TC Paid By', format: v => v || '—' },
        ].map(f => (
          <div key={f.key}>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{f.label}</label>
            {editing ? (
              <input
                type={f.key === 'tc_paid_by' ? 'text' : 'number'}
                step={f.key.startsWith('commission') ? '0.001' : '1'}
                className={inputClass}
                value={form[f.key] || ''}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              />
            ) : (
              <p className="text-sm text-gray-900 mt-0.5">{f.format(deal[f.key])}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <input
              type="checkbox"
              checked={form.tc_paid}
              onChange={e => setForm({ ...form, tc_paid: e.target.checked })}
              className="h-4 w-4 text-indigo-600 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">TC Fee Paid</span>
          </>
        ) : (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
            deal.tc_paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {deal.tc_paid ? 'Paid' : 'Unpaid'}
          </div>
        )}
      </div>
    </div>
  )
}

function HistoryTab({ history, addEntry }) {
  const [text, setText] = useState('')

  const handleAdd = async () => {
    if (!text.trim()) return
    await addEntry(text.trim())
    setText('')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          placeholder="Add a history entry..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700"
        >
          Add
        </button>
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No history entries</p>
      ) : (
        <div className="space-y-3">
          {history.map(entry => (
            <div key={entry.id} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0">
              <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 shrink-0" />
              <div>
                <p className="text-sm text-gray-900">{entry.text}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(entry.entry_date)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
