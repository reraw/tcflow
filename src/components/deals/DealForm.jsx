import { useState, useEffect } from 'react'
import { useAgents } from '../../hooks/useSupabase'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/helpers'
import CurrencyInput from '../ui/CurrencyInput'
import PhoneInput from '../ui/PhoneInput'
import { Plus, X, Zap } from 'lucide-react'

const EMPTY_DEAL = {
  address: '', city: '', status: 'active', representation: 'buyer_only',
  agent_id: '', co_agent_id: '', price: '',
  acceptance_date: '', close_date: '', possession_date: '',
  disclosures_sent: '',
  other_tc_name: '', other_tc_phone: '', other_tc_email: '',
  other_agent_name: '', other_agent_phone: '', other_agent_email: '',
  commission_buyer: '', commission_seller: '',
  commission_type: 'percentage', commission_flat_amount: '',
  concessions: '', tc_fee: '', tc_paid: false, tc_paid_by: '',
  is_referral: false, referral_agreement: false, referral_percentage: '',
  notes: '',
}

const FIXED_CONTINGENCIES = ['Loan', 'Appraisal', 'Inspection', 'Disclosures', 'HOA Docs', 'Insurance', 'Prelim']
const FIXED_INSPECTIONS = ['Home', 'Termite']

function SectionHeader({ children }) {
  return (
    <div className="sm:col-span-2 border-t border-gray-200 pt-5 mt-1">
      <h3 className="text-sm font-semibold text-gray-800 tracking-wide uppercase">{children}</h3>
    </div>
  )
}

export default function DealForm({ onSubmit, onCancel, initialData, initialCustomDates, initialContacts }) {
  const { agents, createAgent } = useAgents()
  const [form, setForm] = useState(() => {
    if (initialData) {
      const f = { ...EMPTY_DEAL }
      Object.keys(f).forEach(k => { if (initialData[k] != null) f[k] = initialData[k] })
      if (f.representation === 'buyer') f.representation = 'buyer_only'
      if (f.representation === 'seller') f.representation = 'seller_only'
      return f
    }
    return { ...EMPTY_DEAL }
  })

  // Contacts state
  const [escrow, setEscrow] = useState({ company: '', officer: '', phone: '', email: '' })
  const [lender, setLender] = useState({ company: '', name: '', phone: '', email: '' })
  const [client1, setClient1] = useState({ name: '', phone: '', email: '' })
  const [client2, setClient2] = useState({ name: '', phone: '', email: '' })
  const [hasClient2, setHasClient2] = useState(false)

  // Load contacts on edit
  useEffect(() => {
    if (!initialContacts) return
    const esc = initialContacts.find(c => c.role === 'escrow')
    if (esc) setEscrow({ company: esc.company || '', officer: esc.officer || '', phone: esc.phone || '', email: esc.email || '' })
    const lend = initialContacts.find(c => c.role === 'lender')
    if (lend) setLender({ company: lend.company || '', name: lend.name || '', phone: lend.phone || '', email: lend.email || '' })
    const c1 = initialContacts.find(c => c.role === 'client_1')
    if (c1) setClient1({ name: c1.name || '', phone: c1.phone || '', email: c1.email || '' })
    const c2 = initialContacts.find(c => c.role === 'client_2')
    if (c2) { setClient2({ name: c2.name || '', phone: c2.phone || '', email: c2.email || '' }); setHasClient2(true) }
  }, [initialContacts])

  // Contingencies
  const findDate = (prefix, label) => {
    if (!initialCustomDates) return ''
    const match = initialCustomDates.find(d => d.label === `${prefix}${label}` || d.label === `${prefix} ${label}`)
    return match?.date || ''
  }

  const [contingencyDates, setContingencyDates] = useState(() =>
    FIXED_CONTINGENCIES.map(label => ({ label, date: findDate('Contingency:', label) }))
  )
  const [customContingencies, setCustomContingencies] = useState(() => {
    if (!initialCustomDates) return []
    return initialCustomDates
      .filter(d => d.label.startsWith('Contingency:') || d.label.startsWith('Contingency: '))
      .map(d => d.label.replace(/^Contingency:\s?/, ''))
      .filter(label => !FIXED_CONTINGENCIES.includes(label))
      .map(label => ({ label, date: findDate('Contingency:', label) }))
  })

  // Inspections
  const [inspectionDates, setInspectionDates] = useState(() =>
    FIXED_INSPECTIONS.map(label => ({ label, date: findDate('Inspection:', label) }))
  )
  const [customInspections, setCustomInspections] = useState(() => {
    if (!initialCustomDates) return []
    return initialCustomDates
      .filter(d => d.label.startsWith('Inspection:') || d.label.startsWith('Inspection: '))
      .map(d => d.label.replace(/^Inspection:\s?/, ''))
      .filter(label => !FIXED_INSPECTIONS.includes(label))
      .map(label => ({ label, date: findDate('Inspection:', label) }))
  })

  // Other custom dates
  const [otherDates, setOtherDates] = useState(() => {
    if (!initialCustomDates) return []
    return initialCustomDates
      .filter(d => !d.label.startsWith('Contingency:') && !d.label.startsWith('Contingency: ') && !d.label.startsWith('Inspection:') && !d.label.startsWith('Inspection: '))
      .map(d => ({ label: d.label, date: d.date }))
  })
  const [newOtherDate, setNewOtherDate] = useState({ label: '', date: '' })

  const [hasCoAgent, setHasCoAgent] = useState(() => !!(initialData?.co_agent_id))
  const [showInlineCoAgent, setShowInlineCoAgent] = useState(false)
  const [inlineCoAgent, setInlineCoAgent] = useState({ name: '', brokerage: '', phone: '', email: '', tc_fee: '' })

  const [showInlineAgent, setShowInlineAgent] = useState(false)
  const [inlineAgent, setInlineAgent] = useState({ name: '', brokerage: '', phone: '', email: '', tc_fee: '' })

  // Preferred vendor auto-fill
  const [agentVendors, setAgentVendors] = useState([])
  useEffect(() => {
    if (!form.agent_id || form.agent_id === '__new__') { setAgentVendors([]); return }
    supabase.from('agent_vendors').select('*').eq('agent_id', form.agent_id).then(({ data }) => setAgentVendors(data || []))
  }, [form.agent_id])

  const escrowVendor = agentVendors.find(v => v.vendor_type && (v.vendor_type.toLowerCase().includes('escrow') || v.vendor_type.toLowerCase().includes('title')))
  const lenderVendor = agentVendors.find(v => v.vendor_type && v.vendor_type.toLowerCase() === 'lender')

  const fillEscrowFromVendor = () => {
    if (!escrowVendor) return
    setEscrow({ company: escrowVendor.company || escrowVendor.name || '', officer: escrowVendor.name || '', phone: escrowVendor.phone || '', email: escrowVendor.email || '' })
  }
  const fillLenderFromVendor = () => {
    if (!lenderVendor) return
    setLender({ company: lenderVendor.company || lenderVendor.name || '', name: lenderVendor.name || '', phone: lenderVendor.phone || '', email: lenderVendor.email || '' })
  }

  // Auto-populate tc_fee
  useEffect(() => {
    if (!form.agent_id || form.agent_id === '__new__') return
    const agent = agents.find(a => a.id === form.agent_id)
    if (!agent) return
    if (form.representation === 'both' && agent.tc_fee_double_ended) {
      setForm(prev => ({ ...prev, tc_fee: agent.tc_fee_double_ended }))
    } else if (agent.tc_fee) {
      setForm(prev => ({ ...prev, tc_fee: agent.tc_fee }))
    }
  }, [form.agent_id, form.representation, agents])

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const handleAgentChange = (e) => {
    const val = e.target.value
    if (val === '__new__') { setShowInlineAgent(true); setForm({ ...form, agent_id: '__new__' }) }
    else { setShowInlineAgent(false); setForm({ ...form, agent_id: val || '' }) }
  }

  const handleCreateInlineAgent = async () => {
    const cleaned = { ...inlineAgent, tc_fee: inlineAgent.tc_fee === '' ? null : Number(inlineAgent.tc_fee) }
    const agent = await createAgent(cleaned)
    if (agent) { setForm(prev => ({ ...prev, agent_id: agent.id })); setShowInlineAgent(false); setInlineAgent({ name: '', brokerage: '', phone: '', email: '', tc_fee: '' }) }
  }

  const handleCoAgentChange = (e) => {
    const val = e.target.value
    if (val === '__new__') { setShowInlineCoAgent(true); setForm({ ...form, co_agent_id: '__new__' }) }
    else { setShowInlineCoAgent(false); setForm({ ...form, co_agent_id: val || '' }) }
  }

  const handleCreateInlineCoAgent = async () => {
    const cleaned = { ...inlineCoAgent, tc_fee: inlineCoAgent.tc_fee === '' ? null : Number(inlineCoAgent.tc_fee) }
    const agent = await createAgent(cleaned)
    if (agent) { setForm(prev => ({ ...prev, co_agent_id: agent.id })); setShowInlineCoAgent(false); setInlineCoAgent({ name: '', brokerage: '', phone: '', email: '', tc_fee: '' }) }
  }

  const [buyerCommType, setBuyerCommType] = useState(() => initialData?.commission_buyer_type || 'percent')
  const [sellerCommType, setSellerCommType] = useState(() => initialData?.commission_seller_type || 'percent')

  const price = Number(form.price) || 0
  const buyerCommDollar = buyerCommType === 'percent' && price && form.commission_buyer ? price * Number(form.commission_buyer) / 100 : null
  const sellerCommDollar = sellerCommType === 'percent' && price && form.commission_seller ? price * Number(form.commission_seller) / 100 : null

  const showOtherAgent = form.representation !== 'both' && form.status === 'active'
  const showOtherAgentSeller = form.representation === 'seller_only' && form.status !== 'listing'

  const handleSubmit = async (e) => {
    e.preventDefault()
    const cleaned = { ...form }
    ;['price', 'commission_buyer', 'commission_seller', 'concessions', 'tc_fee', 'commission_flat_amount'].forEach(f => {
      cleaned[f] = cleaned[f] === '' ? null : Number(cleaned[f])
    })
    if (cleaned.commission_type === 'flat') {
      cleaned.commission_buyer = null
      cleaned.commission_seller = null
    } else {
      cleaned.commission_flat_amount = null
    }
    ;['acceptance_date', 'close_date', 'possession_date', 'disclosures_sent'].forEach(f => {
      if (cleaned[f] === '') cleaned[f] = null
    })
    ;['other_tc_name', 'other_tc_phone', 'other_tc_email', 'other_agent_name', 'other_agent_phone', 'other_agent_email', 'tc_paid_by'].forEach(f => {
      if (cleaned[f] === '') cleaned[f] = null
    })
    cleaned.referral_percentage = cleaned.referral_percentage === '' ? null : Number(cleaned.referral_percentage)
    if (!cleaned.is_referral) { cleaned.referral_agreement = false; cleaned.referral_percentage = null }
    if (!cleaned.referral_agreement) { cleaned.referral_percentage = null }
    cleaned.commission_buyer_type = buyerCommType
    cleaned.commission_seller_type = sellerCommType
    if (cleaned.agent_id === '' || cleaned.agent_id === '__new__') cleaned.agent_id = null
    if (!hasCoAgent || cleaned.co_agent_id === '' || cleaned.co_agent_id === '__new__') cleaned.co_agent_id = null

    const allCustomDates = [
      ...contingencyDates.filter(c => c.date).map(c => ({ label: `Contingency:${c.label}`, date: c.date })),
      ...customContingencies.filter(c => c.label && c.date).map(c => ({ label: `Contingency:${c.label}`, date: c.date })),
      ...inspectionDates.filter(i => i.date).map(i => ({ label: `Inspection:${i.label}`, date: i.date })),
      ...customInspections.filter(i => i.label && i.date).map(i => ({ label: `Inspection:${i.label}`, date: i.date })),
      ...otherDates.filter(d => d.label && d.date),
    ]

    // Build contacts array
    const contacts = []
    if (escrow.company || escrow.officer || escrow.phone || escrow.email) {
      contacts.push({ role: 'escrow', company: escrow.company || null, officer: escrow.officer || null, name: escrow.officer || null, phone: escrow.phone || null, email: escrow.email || null })
    }
    if (lender.company || lender.name || lender.phone || lender.email) {
      contacts.push({ role: 'lender', company: lender.company || null, name: lender.name || null, phone: lender.phone || null, email: lender.email || null })
    }
    if (client1.name || client1.phone || client1.email) {
      contacts.push({ role: 'client_1', name: client1.name || null, phone: client1.phone || null, email: client1.email || null })
    }
    if (hasClient2 && (client2.name || client2.phone || client2.email)) {
      contacts.push({ role: 'client_2', name: client2.name || null, phone: client2.phone || null, email: client2.email || null })
    }

    onSubmit(cleaned, allCustomDates, contacts)
  }

  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
  const lbl = 'block text-xs font-medium text-gray-500 mb-1'
  const dateInp = 'px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none'

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">

        {/* ── AGENT ── */}
        <div className="sm:col-span-2">
          <label className={lbl}>Assigned Agent</label>
          <select className={inp} value={form.agent_id} onChange={handleAgentChange}>
            <option value="">— Select Agent —</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name} — {a.brokerage || 'No brokerage'}</option>)}
            <option value="__new__">+ Add new agent...</option>
          </select>
        </div>
        {showInlineAgent && (
          <div className="sm:col-span-2 border border-indigo-200 bg-indigo-50/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-indigo-700">Create New Agent</p>
            <div className="grid grid-cols-2 gap-3">
              <input className={inp} placeholder="Name *" value={inlineAgent.name} onChange={e => setInlineAgent({ ...inlineAgent, name: e.target.value })} />
              <input className={inp} placeholder="Brokerage" value={inlineAgent.brokerage} onChange={e => setInlineAgent({ ...inlineAgent, brokerage: e.target.value })} />
              <input className={inp} placeholder="Phone" value={inlineAgent.phone} onChange={e => setInlineAgent({ ...inlineAgent, phone: e.target.value })} />
              <input className={inp} placeholder="Email" value={inlineAgent.email} onChange={e => setInlineAgent({ ...inlineAgent, email: e.target.value })} />
              <CurrencyInput className={inp} placeholder="TC Fee" value={inlineAgent.tc_fee} onChange={e => setInlineAgent({ ...inlineAgent, tc_fee: e.target.value })} />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowInlineAgent(false); setForm({ ...form, agent_id: '' }) }} className="text-xs text-gray-500">Cancel</button>
              <button type="button" onClick={handleCreateInlineAgent} className="text-xs text-white bg-indigo-primary px-3 py-1.5 rounded-lg">Create & Select</button>
            </div>
          </div>
        )}

        {/* ── CO-AGENT ── */}
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={hasCoAgent} onChange={e => { setHasCoAgent(e.target.checked); if (!e.target.checked) setForm(prev => ({ ...prev, co_agent_id: '' })) }} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
            Co-Agent?
          </label>
        </div>
        {hasCoAgent && (
          <>
            <div className="sm:col-span-2">
              <label className={lbl}>Co-Agent</label>
              <select className={inp} value={form.co_agent_id} onChange={handleCoAgentChange}>
                <option value="">— Select Co-Agent —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name} — {a.brokerage || 'No brokerage'}</option>)}
                <option value="__new__">+ Add new agent...</option>
              </select>
            </div>
            {showInlineCoAgent && (
              <div className="sm:col-span-2 border border-indigo-200 bg-indigo-50/50 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-indigo-700">Create New Co-Agent</p>
                <div className="grid grid-cols-2 gap-3">
                  <input className={inp} placeholder="Name *" value={inlineCoAgent.name} onChange={e => setInlineCoAgent({ ...inlineCoAgent, name: e.target.value })} />
                  <input className={inp} placeholder="Brokerage" value={inlineCoAgent.brokerage} onChange={e => setInlineCoAgent({ ...inlineCoAgent, brokerage: e.target.value })} />
                  <input className={inp} placeholder="Phone" value={inlineCoAgent.phone} onChange={e => setInlineCoAgent({ ...inlineCoAgent, phone: e.target.value })} />
                  <input className={inp} placeholder="Email" value={inlineCoAgent.email} onChange={e => setInlineCoAgent({ ...inlineCoAgent, email: e.target.value })} />
                  <CurrencyInput className={inp} placeholder="TC Fee" value={inlineCoAgent.tc_fee} onChange={e => setInlineCoAgent({ ...inlineCoAgent, tc_fee: e.target.value })} />
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setShowInlineCoAgent(false); setForm({ ...form, co_agent_id: '' }) }} className="text-xs text-gray-500">Cancel</button>
                  <button type="button" onClick={handleCreateInlineCoAgent} className="text-xs text-white bg-indigo-primary px-3 py-1.5 rounded-lg">Create & Select</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── PROPERTY ── */}
        <SectionHeader>Property Details</SectionHeader>
        <div className="sm:col-span-2"><label className={lbl}>Address *</label><input className={inp} value={form.address} onChange={set('address')} required /></div>
        <div><label className={lbl}>City</label><input className={inp} value={form.city} onChange={set('city')} /></div>
        <div><label className={lbl}>Representation</label>
          <select className={inp} value={form.representation} onChange={set('representation')}>
            <option value="seller_only">Seller Only</option><option value="buyer_only">Buyer Only</option><option value="both">Both (Double-Ended)</option>
          </select>
        </div>
        <div><label className={lbl}>Status</label>
          <select className={inp} value={form.status} onChange={set('status')}>
            <option value="active">Under Contract</option><option value="listing">Listing</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div><label className={lbl}>Price</label><CurrencyInput className={inp} value={form.price} onChange={set('price')} /></div>

        {/* ── FINANCIALS ── */}
        <SectionHeader>Financials</SectionHeader>
        <div><label className={lbl}>TC Fee</label><CurrencyInput className={inp} value={form.tc_fee} onChange={set('tc_fee')} /></div>
        <div><label className={lbl}>TC Paid By</label><input className={inp} value={form.tc_paid_by} onChange={set('tc_paid_by')} /></div>

        <div className="sm:col-span-2">
          <label className={lbl}>Commission Type</label>
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            <button type="button" onClick={() => setForm({ ...form, commission_type: 'percentage' })} className={`px-3 py-1.5 ${form.commission_type === 'percentage' ? 'bg-indigo-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Percentage</button>
            <button type="button" onClick={() => setForm({ ...form, commission_type: 'flat' })} className={`px-3 py-1.5 border-l border-gray-300 ${form.commission_type === 'flat' ? 'bg-indigo-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Flat Fee</button>
          </div>
        </div>

        {form.commission_type === 'flat' ? (
          <div className="sm:col-span-2">
            <label className={lbl}>Commission (Flat Fee)</label>
            <CurrencyInput className={inp} value={form.commission_flat_amount} onChange={set('commission_flat_amount')} />
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="block text-xs font-medium text-gray-500">Buyer Commission ({buyerCommType === 'percent' ? '%' : '$'})</label>
                <button type="button" onClick={() => setBuyerCommType(buyerCommType === 'percent' ? 'flat' : 'percent')} className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-gray-300 hover:bg-gray-100">{buyerCommType === 'percent' ? '%' : '$'}</button>
              </div>
              {buyerCommType === 'percent' ? (
                <input type="number" step="0.001" className={inp} value={form.commission_buyer} onChange={set('commission_buyer')} />
              ) : (
                <CurrencyInput className={inp} value={form.commission_buyer} onChange={set('commission_buyer')} />
              )}
              {buyerCommDollar !== null && <p className="text-xs text-green-600 mt-0.5">= {formatCurrency(buyerCommDollar)}</p>}
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="block text-xs font-medium text-gray-500">Seller Commission ({sellerCommType === 'percent' ? '%' : '$'})</label>
                <button type="button" onClick={() => setSellerCommType(sellerCommType === 'percent' ? 'flat' : 'percent')} className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-gray-300 hover:bg-gray-100">{sellerCommType === 'percent' ? '%' : '$'}</button>
              </div>
              {sellerCommType === 'percent' ? (
                <input type="number" step="0.001" className={inp} value={form.commission_seller} onChange={set('commission_seller')} />
              ) : (
                <CurrencyInput className={inp} value={form.commission_seller} onChange={set('commission_seller')} />
              )}
              {sellerCommDollar !== null && <p className="text-xs text-green-600 mt-0.5">= {formatCurrency(sellerCommDollar)}</p>}
            </div>
          </>
        )}

        <div><label className={lbl}>Concessions</label><CurrencyInput className={inp} value={form.concessions} onChange={set('concessions')} /></div>
        <div className="flex items-center gap-2 pt-5">
          <input type="checkbox" id="tc_paid" checked={form.tc_paid} onChange={set('tc_paid')} className="h-4 w-4 text-indigo-600 rounded border-gray-300" />
          <label htmlFor="tc_paid" className="text-sm text-gray-700">TC Fee Paid</label>
        </div>

        {/* ── KEY DATES ── */}
        <SectionHeader>Key Dates</SectionHeader>
        <div><label className={lbl}>Acceptance Date</label><input type="date" className={inp} value={form.acceptance_date} onChange={set('acceptance_date')} /></div>
        <div><label className={lbl}>Close Date</label><input type="date" className={inp} value={form.close_date} onChange={set('close_date')} /></div>
        <div><label className={lbl}>Possession Date</label><input type="date" className={inp} value={form.possession_date} onChange={set('possession_date')} /></div>
        <div><label className={lbl}>Disclosures Sent</label><input type="date" className={inp} value={form.disclosures_sent} onChange={set('disclosures_sent')} /></div>

        {/* ── CONTACTS ── */}
        <SectionHeader>Contacts</SectionHeader>

        {/* Escrow */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">Escrow</p>
            {escrowVendor && (
              <button type="button" onClick={fillEscrowFromVendor} className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 px-2 py-1 rounded">
                <Zap size={12} /> Use {escrowVendor.company || escrowVendor.name}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Company</label><input className={inp} value={escrow.company} onChange={e => setEscrow({ ...escrow, company: e.target.value })} /></div>
            <div><label className={lbl}>Officer</label><input className={inp} value={escrow.officer} onChange={e => setEscrow({ ...escrow, officer: e.target.value })} /></div>
            <div><label className={lbl}>Phone</label><PhoneInput className={inp} value={escrow.phone} onChange={e => setEscrow({ ...escrow, phone: e.target.value })} /></div>
            <div><label className={lbl}>Email</label><input className={inp} value={escrow.email} onChange={e => setEscrow({ ...escrow, email: e.target.value })} /></div>
          </div>
        </div>

        {/* Lender */}
        <div className="sm:col-span-2 mt-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">Lender</p>
            {lenderVendor && (
              <button type="button" onClick={fillLenderFromVendor} className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 px-2 py-1 rounded">
                <Zap size={12} /> Use {lenderVendor.company || lenderVendor.name}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Company</label><input className={inp} value={lender.company} onChange={e => setLender({ ...lender, company: e.target.value })} /></div>
            <div><label className={lbl}>Contact Name</label><input className={inp} value={lender.name} onChange={e => setLender({ ...lender, name: e.target.value })} /></div>
            <div><label className={lbl}>Phone</label><PhoneInput className={inp} value={lender.phone} onChange={e => setLender({ ...lender, phone: e.target.value })} /></div>
            <div><label className={lbl}>Email</label><input className={inp} value={lender.email} onChange={e => setLender({ ...lender, email: e.target.value })} /></div>
          </div>
        </div>

        {/* Clients */}
        <div className="sm:col-span-2 mt-2">
          <p className="text-xs font-medium text-gray-500 mb-2">Client 1</p>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={lbl}>Name</label><input className={inp} value={client1.name} onChange={e => setClient1({ ...client1, name: e.target.value })} /></div>
            <div><label className={lbl}>Phone</label><PhoneInput className={inp} value={client1.phone} onChange={e => setClient1({ ...client1, phone: e.target.value })} /></div>
            <div><label className={lbl}>Email</label><input className={inp} value={client1.email} onChange={e => setClient1({ ...client1, email: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 mt-3 cursor-pointer">
            <input type="checkbox" checked={hasClient2} onChange={e => setHasClient2(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
            Additional client?
          </label>
          {hasClient2 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-500 mb-2">Client 2</p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={lbl}>Name</label><input className={inp} value={client2.name} onChange={e => setClient2({ ...client2, name: e.target.value })} /></div>
                <div><label className={lbl}>Phone</label><PhoneInput className={inp} value={client2.phone} onChange={e => setClient2({ ...client2, phone: e.target.value })} /></div>
                <div><label className={lbl}>Email</label><input className={inp} value={client2.email} onChange={e => setClient2({ ...client2, email: e.target.value })} /></div>
              </div>
            </div>
          )}
        </div>

        {/* ── OTHER TC ── */}
        <SectionHeader>Other Transaction Coordinator</SectionHeader>
        <div className="sm:col-span-2">
          <div className="grid grid-cols-3 gap-3">
            <div><label className={lbl}>Name</label><input className={inp} value={form.other_tc_name} onChange={set('other_tc_name')} /></div>
            <div><label className={lbl}>Phone</label><PhoneInput className={inp} value={form.other_tc_phone} onChange={set('other_tc_phone')} /></div>
            <div><label className={lbl}>Email</label><input className={inp} value={form.other_tc_email} onChange={set('other_tc_email')} /></div>
          </div>
        </div>

        {/* ── OTHER AGENT ── */}
        {(showOtherAgent || showOtherAgentSeller) && (<>
          <SectionHeader>Other Agent</SectionHeader>
          <div className="sm:col-span-2">
            <div className="grid grid-cols-3 gap-3">
              <div><label className={lbl}>Name</label><input className={inp} value={form.other_agent_name} onChange={set('other_agent_name')} /></div>
              <div><label className={lbl}>Phone</label><PhoneInput className={inp} value={form.other_agent_phone} onChange={set('other_agent_phone')} /></div>
              <div><label className={lbl}>Email</label><input className={inp} value={form.other_agent_email} onChange={set('other_agent_email')} /></div>
            </div>
          </div>
        </>)}

        {/* ── CONTINGENCIES ── */}
        <SectionHeader>Contingencies</SectionHeader>
        <div className="sm:col-span-2 space-y-2">
          {contingencyDates.map((c, i) => (
            <div key={c.label} className="grid grid-cols-[1fr_160px] gap-3 items-center">
              <span className="text-sm text-gray-700">{c.label}</span>
              <input type="date" className={dateInp} value={c.date} onChange={e => { const n = [...contingencyDates]; n[i] = { ...n[i], date: e.target.value }; setContingencyDates(n) }} />
            </div>
          ))}
          {customContingencies.map((c, i) => (
            <div key={'cc' + i} className="grid grid-cols-[1fr_160px_28px] gap-3 items-center">
              <input className={inp} placeholder="Type" value={c.label} onChange={e => { const n = [...customContingencies]; n[i] = { ...n[i], label: e.target.value }; setCustomContingencies(n) }} />
              <input type="date" className={dateInp} value={c.date} onChange={e => { const n = [...customContingencies]; n[i] = { ...n[i], date: e.target.value }; setCustomContingencies(n) }} />
              <button type="button" onClick={() => setCustomContingencies(customContingencies.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><X size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setCustomContingencies([...customContingencies, { label: '', date: '' }])} className="text-xs text-indigo-primary hover:text-indigo-700 font-medium">+ Add another contingency</button>
        </div>

        {/* ── INSPECTIONS ── */}
        <SectionHeader>Inspections</SectionHeader>
        <div className="sm:col-span-2 space-y-2">
          {inspectionDates.map((insp, i) => (
            <div key={insp.label} className="grid grid-cols-[1fr_160px] gap-3 items-center">
              <span className="text-sm text-gray-700">{insp.label}</span>
              <input type="date" className={dateInp} value={insp.date} onChange={e => { const n = [...inspectionDates]; n[i] = { ...n[i], date: e.target.value }; setInspectionDates(n) }} />
            </div>
          ))}
          {customInspections.map((insp, i) => (
            <div key={'ci' + i} className="grid grid-cols-[1fr_160px_28px] gap-3 items-center">
              <input className={inp} placeholder="Type" value={insp.label} onChange={e => { const n = [...customInspections]; n[i] = { ...n[i], label: e.target.value }; setCustomInspections(n) }} />
              <input type="date" className={dateInp} value={insp.date} onChange={e => { const n = [...customInspections]; n[i] = { ...n[i], date: e.target.value }; setCustomInspections(n) }} />
              <button type="button" onClick={() => setCustomInspections(customInspections.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><X size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setCustomInspections([...customInspections, { label: '', date: '' }])} className="text-xs text-indigo-primary hover:text-indigo-700 font-medium">+ Add another inspection</button>
        </div>

        {/* ── OTHER DATES ── */}
        <SectionHeader>Other Dates</SectionHeader>
        <div className="sm:col-span-2 space-y-2">
          {otherDates.map((cd, i) => (
            <div key={i} className="grid grid-cols-[1fr_160px_28px] gap-3 items-center">
              <input className={inp} placeholder="Label" value={cd.label} onChange={e => { const n = [...otherDates]; n[i] = { ...n[i], label: e.target.value }; setOtherDates(n) }} />
              <input type="date" className={dateInp} value={cd.date} onChange={e => { const n = [...otherDates]; n[i] = { ...n[i], date: e.target.value }; setOtherDates(n) }} />
              <button type="button" onClick={() => setOtherDates(otherDates.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setOtherDates([...otherDates, { label: '', date: '' }])} className="text-xs text-indigo-primary hover:text-indigo-700 font-medium">+ Add another date</button>
        </div>

        {/* ── REFERRAL ── */}
        <SectionHeader>Referral</SectionHeader>
        <div className="sm:col-span-2 space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_referral} onChange={set('is_referral')} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
            Referral?
          </label>
          {form.is_referral && (
            <label className="flex items-center gap-2 text-sm text-gray-700 ml-6">
              <input type="checkbox" checked={form.referral_agreement} onChange={set('referral_agreement')} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
              Referral agreement on file?
            </label>
          )}
          {form.is_referral && form.referral_agreement && (
            <div className="ml-6 max-w-xs">
              <label className={lbl}>Referral Percentage (%)</label>
              <input type="number" step="0.001" className={inp} value={form.referral_percentage} onChange={set('referral_percentage')} />
            </div>
          )}
        </div>

        {/* ── NOTES ── */}
        <SectionHeader>Notes</SectionHeader>
        <div className="sm:col-span-2">
          <textarea className={inp} rows={3} value={form.notes} onChange={set('notes')} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-5 border-t border-gray-200 mt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700">
          {initialData ? 'Update Deal' : 'Create Deal'}
        </button>
      </div>
    </form>
  )
}
