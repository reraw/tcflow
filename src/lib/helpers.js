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

/**
 * Generate color-coded reminders for the next 14 days
 * Red = close of escrow
 * Yellow = 1 week before close
 * Orange = two evenly spaced file check touchpoints between 1 week out and close
 * Lavender = contingency removals
 */
export function generateReminders(deals, allContingencies = []) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = addDays(today, 14)
  const reminders = []

  deals.forEach(deal => {
    if (deal.status === 'closed' || deal.status === 'cancelled') return
    if (!deal.close_date) return

    const closeDate = parseISO(deal.close_date)
    if (!isValid(closeDate)) return

    const daysToClose = differenceInDays(closeDate, today)

    // Red: Close of escrow within 14 days
    if (daysToClose >= 0 && daysToClose <= 14) {
      reminders.push({
        date: closeDate,
        label: `Close of Escrow — ${deal.address}`,
        color: 'red',
        deal,
        daysOut: daysToClose,
      })
    }

    // Yellow: 1 week before close
    const oneWeekBefore = addDays(closeDate, -7)
    const daysToOneWeek = differenceInDays(oneWeekBefore, today)
    if (daysToOneWeek >= 0 && daysToOneWeek <= 14) {
      reminders.push({
        date: oneWeekBefore,
        label: `1 Week to Close — ${deal.address}`,
        color: 'yellow',
        deal,
        daysOut: daysToOneWeek,
      })
    }

    // Orange: Two evenly spaced touchpoints between 1 week and close
    if (daysToClose > 7) {
      const gap = 7
      const interval = gap / 3
      for (let i = 1; i <= 2; i++) {
        const touchDate = addDays(closeDate, -(7 - Math.round(interval * i)))
        const daysTillTouch = differenceInDays(touchDate, today)
        if (daysTillTouch >= 0 && daysTillTouch <= 14) {
          reminders.push({
            date: touchDate,
            label: `File Check ${i} — ${deal.address}`,
            color: 'orange',
            deal,
            daysOut: daysTillTouch,
          })
        }
      }
    }

    // Lavender: Contingency removals
    const dealContingencies = allContingencies.find(c => c.deal_id === deal.id)
    if (dealContingencies) {
      const contingencyTypes = ['loan', 'appraisal', 'inspection', 'disclosures', 'hoa', 'insurability', 'prelim']
      contingencyTypes.forEach(type => {
        if (!dealContingencies[type]) return
        const cDate = parseISO(dealContingencies[type])
        if (!isValid(cDate)) return
        const daysTill = differenceInDays(cDate, today)
        if (daysTill >= 0 && daysTill <= 14) {
          reminders.push({
            date: cDate,
            label: `${type.charAt(0).toUpperCase() + type.slice(1)} Contingency — ${deal.address}`,
            color: 'lavender',
            deal,
            daysOut: daysTill,
          })
        }
      })
    }
  })

  return reminders.sort((a, b) => a.date - b.date)
}

export const REMINDER_COLORS = {
  red: { bg: 'bg-red-50 border-red-300', dot: 'bg-red-500', text: 'text-red-800', label: 'Close of Escrow' },
  yellow: { bg: 'bg-yellow-50 border-yellow-300', dot: 'bg-yellow-400', text: 'text-yellow-800', label: '1 Week to Close' },
  orange: { bg: 'bg-orange-50 border-orange-300', dot: 'bg-orange-400', text: 'text-orange-800', label: 'File Check' },
  lavender: { bg: 'bg-purple-50 border-purple-300', dot: 'bg-purple-400', text: 'text-purple-800', label: 'Contingency Removal' },
}
