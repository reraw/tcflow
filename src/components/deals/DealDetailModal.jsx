import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import CurrencyInput from '../ui/CurrencyInput'
import { useContacts, useDealHistory, useCustomDates, useTasks } from '../../hooks/useSupabase'
import { formatDate, formatCurrency, daysUntil, getStatusLabel, getRepLabel } from '../../lib/helpers'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'

const TABS = ['Details', 'Timeline', 'Contacts', 'Financials', 'Tasks', 'History']
const CONTACT_ROLES = [
  { value: 'listing_agent', label: 'Listing Agent' },
  { value: 'buyer_agent', label: 'Buyer Agent' },
  { value: 'lender', label: 'Lender' },
  { value: 'escrow', label: 'Escrow' },
]

export default function DealDetailModal({ deal, open, onClose, onUpdate, agentName, coAgentName }) {
  const [tab, setTab] = useState('Details')
  const { contacts, extraContacts, upsertContact, addExtraContact, deleteExtraContact } = useContacts(deal?.id)
  const { history, addEntry } = useDealHistory(deal?.id)
  const { customDates, addCustomDate, deleteCustomDate } = useCustomDates(deal?.id)

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

      <div className="flex flex-wrap gap-4 text-sm mb-4 pb-3 border-b border-gray-100">
        <div><span className="text-gray-500">Status:</span> <span className="font-medium">{getStatusLabel(deal.status)}</span></div>
        <div><span className="text-gray-500">Rep:</span> <span className="font-medium">{getRepLabel(deal.representation)}</span></div>
        {agentName && <div><span className="text-gray-500">Agent:</span> <span className="font-medium text-indigo-600">{agentName}</span></div>}
        {coAgentName && <div><span className="text-gray-500">Co-Agent:</span> <span className="font-medium text-indigo-600">{coAgentName}</span></div>}
      </div>

      <div className="flex gap-1 mb-5 border-b border-gray-200 -mx-6 px-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-indigo-primary text-indigo-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      {tab === 'Details' && <DetailsTab deal={deal} onUpdate={onUpdate} />}
      {tab === 'Timeline' && <TimelineTab deal={deal} customDates={customDates} addCustomDate={addCustomDate} deleteCustomDate={deleteCustomDate} />}
      {tab === 'Contacts' && <ContactsTab contacts={contacts} extraContacts={extraContacts} upsertContact={upsertContact} addExtraContact={addExtraContact} deleteExtraContact={deleteExtraContact} />}
      {tab === 'Financials' && <FinancialsTab deal={deal} onUpdate={onUpdate} />}
      {tab === 'Tasks' && <TasksTab dealId={deal.id} />}
      {tab === 'History' && <HistoryTab history={history} addEntry={addEntry} />}
    </Modal>
  )
}

function DetailsTab({ deal, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => {
    setForm({
      status: deal.status || 'active',
      acceptance_date: deal.acceptance_date || '', close_date: deal.close_date || '',
      possession_date: deal.possession_date || '', disclosures_sent: deal.disclosures_sent || '',
      representation: deal.representation || 'buyer_only',
      other_tc_name: deal.other_tc_name || '', other_tc_phone: deal.other_tc_phone || '', other_tc_email: deal.other_tc_email || '',
      other_agent_name: deal.other_agent_name || '', other_agent_phone: deal.other_agent_phone || '', other_agent_email: deal.other_agent_email || '',
      is_referral: deal.is_referral || false,
      referral_agreement: deal.referral_agreement || false,
      referral_percentage: deal.referral_percentage || '',
      notes: deal.notes || '',
    })
  }, [deal])

  const handleSave = async () => {
    const cleaned = { ...form }
    ;['acceptance_date', 'close_date', 'possession_date', 'disclosures_sent',
      'other_tc_name', 'other_tc_phone', 'other_tc_email',
      'other_agent_name', 'other_agent_phone', 'other_agent_email', 'notes'].forEach(k => {
      if (cleaned[k] === '') cleaned[k] = null
    })
    cleaned.referral_percentage = cleaned.referral_percentage === '' ? null : Number(cleaned.referral_percentage)
    if (!cleaned.is_referral) { cleaned.referral_agreement = false; cleaned.referral_percentage = null }
    if (!cleaned.referral_agreement) { cleaned.referral_percentage = null }
    await onUpdate(deal.id, cleaned)
    setEditing(false)
  }

  const inputClass = 'w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none'
  const showOtherAgent = form.representation !== 'both'

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => editing ? handleSave() : setEditing(true)} className="text-sm text-indigo-primary hover:text-indigo-700 font-medium">{editing ? 'Save' : 'Edit'}</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
          {editing ? (
            <select className={inputClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="listing">Listing</option>
              <option value="active">Under Contract</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          ) : (
            <p className="text-sm text-gray-900 mt-0.5">{getStatusLabel(deal.status)}</p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Representation</label>
          {editing ? (
            <select className={inputClass} value={form.representation} onChange={e => setForm({ ...form, representation: e.target.value })}>
              <option value="seller_only">Seller Only</option>
              <option value="buyer_only">Buyer Only</option>
              <option value="both">Both (Double-Ended)</option>
            </select>
          ) : (
            <p className="text-sm text-gray-900 mt-0.5">{getRepLabel(deal.representation)}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[{ key: 'acceptance_date', label: 'Acceptance Date' }, { key: 'close_date', label: 'Close Date' }, { key: 'possession_date', label: 'Possession Date' }, { key: 'disclosures_sent', label: 'Disclosures Sent' }].map(f => (
          <div key={f.key}>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{f.label}</label>
            {editing ? <input type="date" className={inputClass} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} /> : <p className="text-sm text-gray-900 mt-0.5">{formatDate(deal[f.key])}</p>}
          </div>
        ))}
      </div>

      {/* Referral section */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Referral</p>
        {editing ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.is_referral} onChange={e => setForm({ ...form, is_referral: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
              Referral?
            </label>
            {form.is_referral && (
              <label className="flex items-center gap-2 text-sm text-gray-700 ml-6">
                <input type="checkbox" checked={form.referral_agreement} onChange={e => setForm({ ...form, referral_agreement: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                Referral agreement on file?
              </label>
            )}
            {form.is_referral && form.referral_agreement && (
              <div className="ml-6">
                <label className="text-xs text-gray-400">Referral Percentage (%)</label>
                <input type="number" step="0.001" className={inputClass + ' max-w-xs'} value={form.referral_percentage} onChange={e => setForm({ ...form, referral_percentage: e.target.value })} />
              </div>
            )}
          </div>
        ) : (
          deal.is_referral ? (
            <div className="space-y-1 text-sm">
              <p className="text-gray-900">Yes — Referral</p>
              <p className="text-gray-600">Agreement on file: {deal.referral_agreement ? 'Yes' : 'No'}</p>
              {deal.referral_agreement && deal.referral_percentage && (
                <p className="text-gray-600">Referral: {deal.referral_percentage}%</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No referral</p>
          )
        )}
      </div>

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Other TC</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[{ key: 'other_tc_name', label: 'Name' }, { key: 'other_tc_phone', label: 'Phone' }, { key: 'other_tc_email', label: 'Email' }].map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-400">{f.label}</label>
              {editing ? <input className={inputClass} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} /> : <p className="text-sm text-gray-900">{deal[f.key] || '—'}</p>}
            </div>
          ))}
        </div>
      </div>

      {showOtherAgent && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Other Agent</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[{ key: 'other_agent_name', label: 'Name' }, { key: 'other_agent_phone', label: 'Phone' }, { key: 'other_agent_email', label: 'Email' }].map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-400">{f.label}</label>
                {editing ? <input className={inputClass} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} /> : <p className="text-sm text-gray-900">{deal[f.key] || '—'}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</label>
        {editing ? <textarea className={inputClass} rows={3} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /> : <p className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">{deal.notes || '—'}</p>}
      </div>
    </div>
  )
}

function TimelineTab({ deal, customDates, addCustomDate, deleteCustomDate }) {
  const [newCD, setNewCD] = useState({ label: '', date: '' })

  const getDaysColor = (days) => {
    if (days === null) return 'text-gray-400'
    if (days < 0) return 'text-red-600'
    if (days <= 3) return 'text-red-500'
    if (days <= 7) return 'text-orange-500'
    if (days <= 14) return 'text-yellow-600'
    return 'text-green-600'
  }

  const formatDays = (days) => {
    if (days === null) return ''
    if (days === 0) return 'Today'
    if (days > 0) return `${days}d`
    return `${Math.abs(days)}d ago`
  }

  const closeDays = daysUntil(deal.close_date)
  const isContingency = d => d.label.startsWith('Contingency:') || d.label.startsWith('Contingency: ')
  const isInspection = d => d.label.startsWith('Inspection:') || d.label.startsWith('Inspection: ')
  const contingencies = customDates.filter(isContingency)
  const inspections = customDates.filter(isInspection)
  const otherDates = customDates.filter(d => !isContingency(d) && !isInspection(d))

  const handleAdd = async () => {
    if (!newCD.label || !newCD.date) return
    await addCustomDate(newCD.label, newCD.date)
    setNewCD({ label: '', date: '' })
  }

  const renderDateRow = (label, date, id, colorClass = 'bg-gray-50') => {
    const days = daysUntil(date)
    return (
      <div key={id} className={`flex items-center justify-between p-3 ${colorClass} rounded-lg`}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{label}</p>
          <p className="text-xs text-gray-500">{formatDate(date)}</p>
        </div>
        {days !== null && <span className={`text-sm font-semibold mr-2 ${getDaysColor(days)}`}>{formatDays(days)}</span>}
        {id && <button onClick={() => deleteCustomDate(id)} className="text-gray-400 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
        <div><p className="text-sm font-semibold text-red-800">Close of Escrow</p><p className="text-xs text-red-600">{formatDate(deal.close_date)}</p></div>
        {closeDays !== null && <span className={`text-sm font-bold ${getDaysColor(closeDays)}`}>{formatDays(closeDays)}</span>}
      </div>

      {contingencies.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Contingencies</h4>
          <div className="space-y-2">
            {contingencies.map(cd => renderDateRow(cd.label.replace(/^Contingency:\s?/, ''), cd.date, cd.id, 'bg-purple-50 border border-purple-200'))}
          </div>
        </div>
      )}

      {inspections.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Inspections</h4>
          <div className="space-y-2">
            {inspections.map(cd => renderDateRow(cd.label.replace(/^Inspection:\s?/, ''), cd.date, cd.id, 'bg-blue-50 border border-blue-200'))}
          </div>
        </div>
      )}

      {otherDates.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Other Dates</h4>
          <div className="space-y-2">
            {otherDates.map(cd => renderDateRow(cd.label, cd.date, cd.id, 'bg-indigo-50 border border-indigo-200'))}
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 pt-3">
        <p className="text-xs font-medium text-gray-500 mb-2">Add Date</p>
        <div className="flex gap-2 items-end">
          <input className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="Label (e.g. Contingency: Loan)" value={newCD.label} onChange={e => setNewCD({ ...newCD, label: e.target.value })} />
          <input type="date" className="px-2 py-1.5 border border-gray-300 rounded text-sm" value={newCD.date} onChange={e => setNewCD({ ...newCD, date: e.target.value })} />
          <button onClick={handleAdd} className="px-2 py-1.5 text-indigo-primary border border-indigo-300 rounded hover:bg-indigo-50"><Plus size={16} /></button>
        </div>
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

  return (
    <div className="space-y-6">
      {CONTACT_ROLES.map(role => {
        const contact = contacts.find(c => c.role === role.value) || { role: role.value }
        const isEditing = editingId === role.value
        return (
          <div key={role.value} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-gray-800">{role.label}</h4>
              <button onClick={() => { if (isEditing) { upsertContact(form); setEditingId(null) } else { setEditingId(role.value); setForm({ ...contact }) } }} className="text-xs text-indigo-primary hover:text-indigo-700 font-medium">{isEditing ? 'Save' : 'Edit'}</button>
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
                {[['Name', contact.name], ['Phone', contact.phone], ['Email', contact.email], ['Company', contact.company], ['Officer', contact.officer]].map(([l, v]) => (
                  <><span className="text-gray-500">{l}:</span><span className="text-gray-900">{v || '—'}</span></>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-semibold text-gray-800">Additional Contacts</h4>
          <button onClick={() => setShowAddExtra(true)} className="text-xs text-indigo-primary font-medium">+ Add</button>
        </div>
        {showAddExtra && (
          <div className="border border-gray-200 rounded-lg p-3 mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} placeholder="Role" value={newExtra.role_label} onChange={e => setNewExtra({ ...newExtra, role_label: e.target.value })} />
              <input className={inputClass} placeholder="Name" value={newExtra.name} onChange={e => setNewExtra({ ...newExtra, name: e.target.value })} />
              <input className={inputClass} placeholder="Phone" value={newExtra.phone} onChange={e => setNewExtra({ ...newExtra, phone: e.target.value })} />
              <input className={inputClass} placeholder="Email" value={newExtra.email} onChange={e => setNewExtra({ ...newExtra, email: e.target.value })} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddExtra(false)} className="text-xs text-gray-500">Cancel</button>
              <button onClick={async () => { await addExtraContact(newExtra); setNewExtra({ role_label: '', name: '', phone: '', email: '' }); setShowAddExtra(false) }} className="text-xs text-white bg-indigo-primary px-3 py-1 rounded-lg">Add</button>
            </div>
          </div>
        )}
        {extraContacts.map(ec => (
          <div key={ec.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
            <div className="text-sm"><span className="font-medium text-gray-700">{ec.role_label}:</span> {ec.name}{ec.phone && ` · ${ec.phone}`}{ec.email && ` · ${ec.email}`}</div>
            <button onClick={() => deleteExtraContact(ec.id)} className="text-xs text-red-500">Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function FinancialsTab({ deal, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [buyerType, setBuyerType] = useState(deal.commission_buyer_type || 'percent')
  const [sellerType, setSellerType] = useState(deal.commission_seller_type || 'percent')
  const [commissionType, setCommissionType] = useState(deal.commission_type || 'percentage')

  useEffect(() => {
    setForm({ price: deal.price || '', commission_buyer: deal.commission_buyer || '', commission_seller: deal.commission_seller || '', commission_flat_amount: deal.commission_flat_amount || '', concessions: deal.concessions || '', tc_fee: deal.tc_fee || '', tc_paid: deal.tc_paid || false, tc_paid_by: deal.tc_paid_by || '' })
    setBuyerType(deal.commission_buyer_type || 'percent')
    setSellerType(deal.commission_seller_type || 'percent')
    setCommissionType(deal.commission_type || 'percentage')
  }, [deal])

  const handleSave = async () => {
    const cleaned = { ...form, commission_buyer_type: buyerType, commission_seller_type: sellerType, commission_type: commissionType }
    ;['price', 'commission_buyer', 'commission_seller', 'commission_flat_amount', 'concessions', 'tc_fee'].forEach(f => { cleaned[f] = cleaned[f] === '' ? null : Number(cleaned[f]) })
    if (commissionType === 'flat') {
      cleaned.commission_buyer = null
      cleaned.commission_seller = null
    } else {
      cleaned.commission_flat_amount = null
    }
    if (cleaned.tc_paid_by === '') cleaned.tc_paid_by = null
    await onUpdate(deal.id, cleaned)
    setEditing(false)
  }

  const price = Number(form.price || deal.price) || 0
  const buyerDollar = buyerType === 'percent' && price && (form.commission_buyer || deal.commission_buyer) ? price * Number(form.commission_buyer || deal.commission_buyer) / 100 : null
  const sellerDollar = sellerType === 'percent' && price && (form.commission_seller || deal.commission_seller) ? price * Number(form.commission_seller || deal.commission_seller) / 100 : null
  const inputClass = 'w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none'

  const ToggleButton = ({ type, setType }) => (
    <button
      type="button"
      onClick={() => setType(type === 'percent' ? 'flat' : 'percent')}
      className="ml-1 px-2 py-1 text-xs font-medium rounded border border-gray-300 hover:bg-gray-100"
    >
      {type === 'percent' ? '%' : '$'}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => editing ? handleSave() : setEditing(true)} className="text-sm text-indigo-primary hover:text-indigo-700 font-medium">{editing ? 'Save' : 'Edit'}</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Price */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Price</label>
          {editing ? <CurrencyInput className={inputClass} value={form.price || ''} onChange={e => setForm({ ...form, price: e.target.value })} /> : <p className="text-sm text-gray-900 mt-0.5">{formatCurrency(deal.price)}</p>}
        </div>

        {/* Commission Type toggle */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Commission Type</label>
          {editing ? (
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm mt-0.5">
              <button type="button" onClick={() => setCommissionType('percentage')} className={`px-3 py-1 ${commissionType === 'percentage' ? 'bg-indigo-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Percentage</button>
              <button type="button" onClick={() => setCommissionType('flat')} className={`px-3 py-1 border-l border-gray-300 ${commissionType === 'flat' ? 'bg-indigo-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Flat Fee</button>
            </div>
          ) : (
            <p className="text-sm text-gray-900 mt-0.5">{commissionType === 'flat' ? 'Flat Fee' : 'Percentage'}</p>
          )}
        </div>

        {commissionType === 'flat' ? (
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Commission (Flat Fee)</label>
            {editing ? (
              <CurrencyInput className={inputClass} value={form.commission_flat_amount || ''} onChange={e => setForm({ ...form, commission_flat_amount: e.target.value })} />
            ) : (
              <p className="text-sm text-gray-900 mt-0.5">{formatCurrency(deal.commission_flat_amount)}</p>
            )}
          </div>
        ) : (
          <>
            {/* Buyer Commission */}
            <div>
              <div className="flex items-center">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Buyer Commission ({buyerType === 'percent' ? '%' : '$'})</label>
                {editing && <ToggleButton type={buyerType} setType={setBuyerType} />}
              </div>
              {editing ? (
                buyerType === 'percent' ? (
                  <input type="number" step="0.001" className={inputClass} value={form.commission_buyer || ''} onChange={e => setForm({ ...form, commission_buyer: e.target.value })} />
                ) : (
                  <CurrencyInput className={inputClass} value={form.commission_buyer || ''} onChange={e => setForm({ ...form, commission_buyer: e.target.value })} />
                )
              ) : (
                <p className="text-sm text-gray-900 mt-0.5">{buyerType === 'percent' ? (deal.commission_buyer ? `${deal.commission_buyer}%` : '—') : formatCurrency(deal.commission_buyer)}</p>
              )}
              {buyerDollar !== null && buyerDollar !== undefined && <p className="text-xs text-green-600 mt-0.5">= {formatCurrency(buyerDollar)}</p>}
            </div>

            {/* Seller Commission */}
            <div>
              <div className="flex items-center">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Seller Commission ({sellerType === 'percent' ? '%' : '$'})</label>
                {editing && <ToggleButton type={sellerType} setType={setSellerType} />}
              </div>
              {editing ? (
                sellerType === 'percent' ? (
                  <input type="number" step="0.001" className={inputClass} value={form.commission_seller || ''} onChange={e => setForm({ ...form, commission_seller: e.target.value })} />
                ) : (
                  <CurrencyInput className={inputClass} value={form.commission_seller || ''} onChange={e => setForm({ ...form, commission_seller: e.target.value })} />
                )
              ) : (
                <p className="text-sm text-gray-900 mt-0.5">{sellerType === 'percent' ? (deal.commission_seller ? `${deal.commission_seller}%` : '—') : formatCurrency(deal.commission_seller)}</p>
              )}
              {sellerDollar !== null && sellerDollar !== undefined && <p className="text-xs text-green-600 mt-0.5">= {formatCurrency(sellerDollar)}</p>}
            </div>
          </>
        )}

        {/* Concessions */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Concessions</label>
          {editing ? <CurrencyInput className={inputClass} value={form.concessions || ''} onChange={e => setForm({ ...form, concessions: e.target.value })} /> : <p className="text-sm text-gray-900 mt-0.5">{formatCurrency(deal.concessions)}</p>}
        </div>

        {/* TC Fee */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">TC Fee</label>
          {editing ? <CurrencyInput className={inputClass} value={form.tc_fee || ''} onChange={e => setForm({ ...form, tc_fee: e.target.value })} /> : <p className="text-sm text-gray-900 mt-0.5">{formatCurrency(deal.tc_fee)}</p>}
        </div>

        {/* TC Paid By */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">TC Paid By</label>
          {editing ? <input type="text" className={inputClass} value={form.tc_paid_by || ''} onChange={e => setForm({ ...form, tc_paid_by: e.target.value })} /> : <p className="text-sm text-gray-900 mt-0.5">{deal.tc_paid_by || '—'}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <><input type="checkbox" checked={form.tc_paid} onChange={e => setForm({ ...form, tc_paid: e.target.checked })} className="h-4 w-4 text-indigo-600 rounded border-gray-300" /><span className="text-sm text-gray-700">TC Fee Paid</span></>
        ) : (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${deal.tc_paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{deal.tc_paid ? 'Paid' : 'Unpaid'}</div>
        )}
      </div>
    </div>
  )
}

function TasksTab({ dealId }) {
  const { tasks, createTask, toggleTask, deleteTask } = useTasks(dealId)
  const [newTask, setNewTask] = useState({ description: '', due_date: '' })

  const handleAdd = async () => {
    if (!newTask.description) return
    await createTask({ deal_id: dealId, description: newTask.description, due_date: newTask.due_date || null })
    setNewTask({ description: '', due_date: '' })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <input
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          placeholder="New task description..."
          value={newTask.description}
          onChange={e => setNewTask({ ...newTask, description: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        />
        <input type="date" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} />
        <button onClick={handleAdd} className="px-4 py-2 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700">Add</button>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No tasks for this deal</p>
      ) : (
        <div className="space-y-2">
          {tasks.map(t => (
            <div key={t.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${t.completed ? 'bg-gray-50 border-gray-200' : 'bg-orange-50 border-orange-200'}`}>
              <input
                type="checkbox"
                checked={t.completed}
                onChange={() => toggleTask(t.id, !t.completed)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${t.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>{t.description}</p>
              </div>
              {t.due_date && <span className="text-xs text-gray-500">{formatDate(t.due_date)}</span>}
              <button onClick={() => deleteTask(t.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryTab({ history, addEntry }) {
  const [text, setText] = useState('')
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Add a history entry..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { addEntry(text.trim()); setText('') } }} />
        <button onClick={() => { if (text.trim()) { addEntry(text.trim()); setText('') } }} className="px-4 py-2 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700">Add</button>
      </div>
      {history.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No history entries</p> : (
        <div className="space-y-3">{history.map(entry => (
          <div key={entry.id} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0">
            <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 shrink-0" />
            <div><p className="text-sm text-gray-900">{entry.text}</p><p className="text-xs text-gray-400 mt-0.5">{formatDate(entry.entry_date)}</p></div>
          </div>
        ))}</div>
      )}
    </div>
  )
}
