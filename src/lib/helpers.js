import { format, differenceInDays, parseISO, addDays, isValid } from 'date-fns'

export function formatCurrency(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

export function formatDate(date) {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return isValid(d) ? format(d, 'MM/dd/yyyy') : '—'
}

export function formatShortDate(date) {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return isValid(d) ? format(d, 'MMM d') : '—'
}

export function daysUntil(date) {
  if (!date) return null
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return null
  return differenceInDays(d, new Date())
}

export function getStatusColor(status) {
  const colors = {
    active: 'bg-green-100 text-green-800',
    listing: 'bg-blue-100 text-blue-800',
    closed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

export function getStatusLabel(status) {
  const labels = {
    active: 'Under Contract',
    listing: 'Listing',
    closed: 'Closed',
    cancelled: 'Cancelled',
  }
  return labels[status] || status
}

export function getRepLabel(rep) {
  const labels = {
    seller_only: 'Seller Only',
    buyer_only: 'Buyer Only',
    both: 'Both (Double-Ended)',
  }
  return labels[rep] || rep || '—'
}

export const VENDOR_TYPES = ['Escrow', 'Title', 'Home Inspector', 'Termite', 'Home Warranty', 'Lender', 'Stager', 'Photographer', 'Notary', 'Other']

export const DEFAULT_CONTINGENCIES = ['Loan', 'Appraisal', 'Inspection', 'Disclosures', 'HOA', 'Insurability', 'Prelim']

export function generateReminders(deals, allCustomDates = []) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const reminders = []

  deals.forEach(deal => {
    if (deal.status === 'closed' || deal.status === 'cancelled') return
    if (!deal.close_date) return

    const closeDate = parseISO(deal.close_date)
    if (!isValid(closeDate)) return

    const daysToClose = differenceInDays(closeDate, today)

    // Close of escrow: past due OR within 14 days
    if (daysToClose <= 14) {
      reminders.push({
        date: closeDate,
        label: `Close of Escrow — ${deal.address}`,
        color: 'red',
        deal,
        daysOut: daysToClose,
        overdue: daysToClose < 0,
        isCloseOfEscrow: true,
        key: `close_${deal.id}`,
      })
    }

    // Yellow: 1 week before close
    const oneWeekBefore = addDays(closeDate, -7)
    const daysToOneWeek = differenceInDays(oneWeekBefore, today)
    if (daysToOneWeek <= 14) {
      reminders.push({
        date: oneWeekBefore,
        label: `1 Week to Close — ${deal.address}`,
        color: 'yellow',
        deal,
        daysOut: daysToOneWeek,
        overdue: daysToOneWeek < 0,
        key: `1week_${deal.id}`,
      })
    }

    // Orange: Two file check touchpoints between 1 week and close
    if (daysToClose > 7) {
      const interval = 7 / 3
      for (let i = 1; i <= 2; i++) {
        const touchDate = addDays(closeDate, -(7 - Math.round(interval * i)))
        const daysTillTouch = differenceInDays(touchDate, today)
        if (daysTillTouch <= 14) {
          reminders.push({
            date: touchDate,
            label: `File Check ${i} — ${deal.address}`,
            color: 'orange',
            deal,
            daysOut: daysTillTouch,
            overdue: daysTillTouch < 0,
            key: `filecheck${i}_${deal.id}`,
          })
        }
      }
    }

    // Lavender: Contingency dates from custom_dates
    const dealDates = allCustomDates.filter(cd => cd.deal_id === deal.id && (cd.label.startsWith('Contingency:') || cd.label.startsWith('Contingency: ')))
    dealDates.forEach(cd => {
      const cDate = parseISO(cd.date)
      if (!isValid(cDate)) return
      const daysTill = differenceInDays(cDate, today)
      if (daysTill <= 14) {
        reminders.push({
          date: cDate,
          label: `${cd.label.replace(/^Contingency:\s?/, '')} — ${deal.address}`,
          color: 'lavender',
          deal,
          daysOut: daysTill,
          overdue: daysTill < 0,
          key: `cont_${cd.id}`,
        })
      }
    })
  })

  // Sort: overdue first (most overdue at top), then by date ascending
  return reminders.sort((a, b) => {
    if (a.overdue && !b.overdue) return -1
    if (!a.overdue && b.overdue) return 1
    if (a.overdue && b.overdue) return a.daysOut - b.daysOut // most overdue first
    return a.date - b.date
  })
}

export const REMINDER_COLORS = {
  red: { bg: 'bg-red-50 border-red-300', dot: 'bg-red-500', text: 'text-red-800', label: 'Close of Escrow' },
  yellow: { bg: 'bg-yellow-50 border-yellow-300', dot: 'bg-yellow-400', text: 'text-yellow-800', label: '1 Week to Close' },
  orange: { bg: 'bg-orange-50 border-orange-300', dot: 'bg-orange-400', text: 'text-orange-800', label: 'File Check' },
  lavender: { bg: 'bg-purple-50 border-purple-300', dot: 'bg-purple-400', text: 'text-purple-800', label: 'Contingency Deadline' },
}
