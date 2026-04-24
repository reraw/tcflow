import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import CurrencyInput from '../ui/CurrencyInput'
import ConfirmDialog from '../ui/ConfirmDialog'
import {
  formatCurrency,
  paymentStateFor,
  PAYMENT_STATE_STYLES,
  PAYMENT_STATE_LABELS,
  PAID_BY_OPTIONS,
} from '../../lib/helpers'
import { Check, AlertCircle, CircleDashed } from 'lucide-react'

// A 4-state paid indicator + quick-action popover rendered via portal so
// it escapes the table row's click handler. Click the dot → popover opens.
// Popover actions: Mark Paid in Full, Record Partial Payment, Mark Unpaid.
export default function PaidStatusCell({ deal, payments, onMarkPaidInFull, onAddPayment, onClearPayments }) {
  const [open, setOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState(null)
  const [showPartial, setShowPartial] = useState(false)
  const [form, setForm] = useState({ amount: '', paid_by: 'Agent', paid_by_other: '' })
  const [confirmUnpaid, setConfirmUnpaid] = useState(false)
  const btnRef = useRef(null)

  const state = paymentStateFor(deal, payments)

  // Reposition on scroll/resize so the popover stays anchored.
  useEffect(() => {
    if (!open) return
    const reposition = () => {
      if (btnRef.current) setAnchorRect(btnRef.current.getBoundingClientRect())
    }
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  const close = () => {
    setOpen(false)
    setShowPartial(false)
    setForm({ amount: '', paid_by: 'Agent', paid_by_other: '' })
  }

  const iconFor = (s) => {
    if (s === 'paid') return <Check size={16} strokeWidth={3} />
    if (s === 'partial') return <CircleDashed size={16} strokeWidth={2.5} />
    if (s === 'awaiting') return <AlertCircle size={16} />
    return <span className="text-gray-300">—</span>
  }

  const styles = PAYMENT_STATE_STYLES[state]

  const handleMarkFull = async () => {
    await onMarkPaidInFull()
    close()
  }

  const handlePartialSubmit = async () => {
    if (!form.amount || Number(form.amount) <= 0) return
    await onAddPayment({
      amount: form.amount,
      paid_by: form.paid_by,
      paid_by_other: form.paid_by === 'Other' ? form.paid_by_other : null,
    })
    close()
  }

  const handleUnpaid = async () => {
    await onClearPayments()
    setConfirmUnpaid(false)
    close()
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation()
          setAnchorRect(e.currentTarget.getBoundingClientRect())
          setOpen(!open)
        }}
        className={`p-1 rounded ${state === 'paid' ? 'text-green-600 hover:text-green-800' : state === 'partial' ? 'text-blue-600 hover:text-blue-800' : state === 'awaiting' ? 'text-amber-500 hover:text-amber-700' : 'text-gray-300 hover:text-gray-500'}`}
        title={PAYMENT_STATE_LABELS[state]}
      >
        {iconFor(state)}
      </button>

      {open && anchorRect && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            onClick={e => e.stopPropagation()}
            className="fixed z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3"
            style={{
              top: Math.min(anchorRect.bottom + 4, window.innerHeight - 280),
              left: Math.max(8, Math.min(anchorRect.left - 200, window.innerWidth - 296)),
            }}
          >
            <div className={`text-xs font-medium uppercase tracking-wide mb-2 pb-2 border-b border-gray-100 ${styles.text}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${styles.dot} mr-1.5 align-middle`} />
              {PAYMENT_STATE_LABELS[state]}
            </div>

            {showPartial ? (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">Amount</label>
                  <CurrencyInput
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Paid by</label>
                  <select
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    value={form.paid_by}
                    onChange={e => setForm({ ...form, paid_by: e.target.value })}
                  >
                    {PAID_BY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                {form.paid_by === 'Other' && (
                  <div>
                    <label className="text-xs text-gray-500">Specify</label>
                    <input
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      value={form.paid_by_other}
                      onChange={e => setForm({ ...form, paid_by_other: e.target.value })}
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setShowPartial(false)} className="text-xs text-gray-500">Cancel</button>
                  <button
                    onClick={handlePartialSubmit}
                    className="text-xs font-medium text-white bg-indigo-primary px-3 py-1.5 rounded"
                  >
                    Add Payment
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <button
                  onClick={handleMarkFull}
                  disabled={!deal.tc_fee || Number(deal.tc_fee) <= 0 || state === 'paid'}
                  className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-green-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                >
                  <span className="font-medium text-green-700">Mark Paid in Full</span>
                  <span className="block text-xs text-gray-500">${Number(deal.tc_fee || 0).toLocaleString()} · today</span>
                </button>
                <button
                  onClick={() => setShowPartial(true)}
                  className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-blue-50"
                >
                  <span className="font-medium text-blue-700">Record Partial Payment</span>
                  <span className="block text-xs text-gray-500">Add amount + paid-by</span>
                </button>
                <button
                  onClick={() => setConfirmUnpaid(true)}
                  disabled={payments.length === 0}
                  className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-amber-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                >
                  <span className="font-medium text-amber-700">Mark Unpaid</span>
                  <span className="block text-xs text-gray-500">Delete all payments</span>
                </button>
              </div>
            )}
          </div>
        </>,
        document.body
      )}

      <ConfirmDialog
        open={confirmUnpaid}
        onConfirm={handleUnpaid}
        onCancel={() => setConfirmUnpaid(false)}
        title="Mark Unpaid"
        message={`This deletes all ${payments.length} payment${payments.length === 1 ? '' : 's'} for this deal (${formatCurrency(payments.reduce((s, p) => s + Number(p.amount || 0), 0))}). Continue?`}
      />
    </>
  )
}
