import { useState } from 'react'

const EMPTY_DEAL = {
  address: '', city: '', type: 'buyer', status: 'active', price: '',
  acceptance_date: '', close_date: '', possession_date: '', inspection_date: '',
  disclosures_sent: '', other_tc: '', commission_buyer: '', commission_seller: '',
  concessions: '', tc_fee: '', tc_paid: false, tc_paid_by: '', notes: '',
}

export default function DealForm({ onSubmit, onCancel, initialData }) {
  const [form, setForm] = useState(initialData || EMPTY_DEAL)

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const handleSubmit = (e) => {
    e.preventDefault()
    const cleaned = { ...form }
    // Convert empty strings to null for numeric/date fields
    ;['price', 'commission_buyer', 'commission_seller', 'concessions', 'tc_fee'].forEach(f => {
      cleaned[f] = cleaned[f] === '' ? null : Number(cleaned[f])
    })
    ;['acceptance_date', 'close_date', 'possession_date', 'inspection_date', 'disclosures_sent'].forEach(f => {
      if (cleaned[f] === '') cleaned[f] = null
    })
    onSubmit(cleaned)
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass}>Property Address *</label>
          <input className={inputClass} value={form.address} onChange={set('address')} required />
        </div>
        <div>
          <label className={labelClass}>City</label>
          <input className={inputClass} value={form.city} onChange={set('city')} />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <select className={inputClass} value={form.type} onChange={set('type')}>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={set('status')}>
            <option value="active">Under Contract</option>
            <option value="listing">Listing</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Price</label>
          <input type="number" className={inputClass} value={form.price} onChange={set('price')} />
        </div>
        <div>
          <label className={labelClass}>Acceptance Date</label>
          <input type="date" className={inputClass} value={form.acceptance_date} onChange={set('acceptance_date')} />
        </div>
        <div>
          <label className={labelClass}>Close Date</label>
          <input type="date" className={inputClass} value={form.close_date} onChange={set('close_date')} />
        </div>
        <div>
          <label className={labelClass}>Possession Date</label>
          <input type="date" className={inputClass} value={form.possession_date} onChange={set('possession_date')} />
        </div>
        <div>
          <label className={labelClass}>Inspection Date</label>
          <input type="date" className={inputClass} value={form.inspection_date} onChange={set('inspection_date')} />
        </div>
        <div>
          <label className={labelClass}>Disclosures Sent</label>
          <input type="date" className={inputClass} value={form.disclosures_sent} onChange={set('disclosures_sent')} />
        </div>
        <div>
          <label className={labelClass}>Other TC</label>
          <input className={inputClass} value={form.other_tc} onChange={set('other_tc')} />
        </div>
        <div>
          <label className={labelClass}>Commission (Buyer %)</label>
          <input type="number" step="0.001" className={inputClass} value={form.commission_buyer} onChange={set('commission_buyer')} />
        </div>
        <div>
          <label className={labelClass}>Commission (Seller %)</label>
          <input type="number" step="0.001" className={inputClass} value={form.commission_seller} onChange={set('commission_seller')} />
        </div>
        <div>
          <label className={labelClass}>Concessions</label>
          <input type="number" className={inputClass} value={form.concessions} onChange={set('concessions')} />
        </div>
        <div>
          <label className={labelClass}>TC Fee</label>
          <input type="number" className={inputClass} value={form.tc_fee} onChange={set('tc_fee')} />
        </div>
        <div>
          <label className={labelClass}>TC Paid By</label>
          <input className={inputClass} value={form.tc_paid_by} onChange={set('tc_paid_by')} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input type="checkbox" id="tc_paid" checked={form.tc_paid} onChange={set('tc_paid')} className="h-4 w-4 text-indigo-600 rounded border-gray-300" />
          <label htmlFor="tc_paid" className="text-sm text-gray-700">TC Fee Paid</label>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Notes</label>
          <textarea className={inputClass} rows={3} value={form.notes} onChange={set('notes')} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700">
          {initialData ? 'Update Deal' : 'Create Deal'}
        </button>
      </div>
    </form>
  )
}
