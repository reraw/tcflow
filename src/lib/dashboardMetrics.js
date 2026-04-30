// dashboardMetrics.js
// ─────────────────────────────────────────────────────────────────────────
// Single source of truth for every dollar/count rendered on the Dashboard.
// All UI metric calculations import from here; no inlining in components.
//
// Canonical definitions (locked in by user spec, 2026-04-30):
//
// Deal status (closure) and payment state are INDEPENDENT axes.
//   CLOSED  ⟺ deal.status === 'closed'  (manual, payment-irrelevant)
//   PAID-IN-FULL ⟺ Σ payments >= tc_fee
//   PARTIAL      ⟺ 0 < Σ payments < tc_fee
//   AWAITING     ⟺ Σ payments = 0  AND  CLOSED
//   NOT_YET_DUE  ⟺ Σ payments = 0  AND  NOT CLOSED
//
// All metrics here treat the legacy boolean `deal.tc_paid` as informational
// only (DO NOT READ). Source of truth is `deal_payments` rows.
// ─────────────────────────────────────────────────────────────────────────

import { startOfMonth, endOfMonth, parseISO, isWithinInterval, format } from 'date-fns'

// Tiny helpers
const num = (v) => Number(v) || 0
export const sumPayments = (payments = []) => payments.reduce((s, p) => s + num(p.amount), 0)
export const isClosed = (deal) => deal?.status === 'closed'
export const isCancelled = (deal) => deal?.status === 'cancelled'
export const isActive = (deal) => deal?.status === 'active'
export const isListing = (deal) => deal?.status === 'listing'

// Bucket a single deal into per-segment dollar contributions for the
// This-Month progress bar. Returns { closedFull, closedReceived,
// closedOutstanding, notClosedReceived, notClosedRemaining }.
// Sum of all five segments == max(0, tc_fee). For cancelled deals,
// returns zeros (callers should pre-filter).
export function dealContributions(deal, payments = []) {
  const fee = num(deal?.tc_fee)
  if (fee <= 0) return { closedFull: 0, closedReceived: 0, closedOutstanding: 0, notClosedReceived: 0, notClosedRemaining: 0 }
  const received = Math.min(fee, sumPayments(payments))   // never overpaid
  const remaining = Math.max(0, fee - received)
  if (isClosed(deal)) {
    if (received >= fee) return { closedFull: fee, closedReceived: 0, closedOutstanding: 0, notClosedReceived: 0, notClosedRemaining: 0 }
    return { closedFull: 0, closedReceived: received, closedOutstanding: remaining, notClosedReceived: 0, notClosedRemaining: 0 }
  }
  return { closedFull: 0, closedReceived: 0, closedOutstanding: 0, notClosedReceived: received, notClosedRemaining: remaining }
}

// Universe filter: deals closing in [start, end] excluding cancelled.
function dealsInWindow(deals, start, end) {
  return deals.filter(d => {
    if (isCancelled(d)) return false
    if (!d.close_date) return false
    return isWithinInterval(parseISO(d.close_date), { start, end })
  })
}

// Build a map dealId -> payments[] from a flat list.
export function indexPaymentsByDeal(allPayments = []) {
  const m = {}
  allPayments.forEach(p => { (m[p.deal_id] = m[p.deal_id] || []).push(p) })
  return m
}

// ─────────────────────────────────────────────────────────────────────────
// "This Month" panel metrics — payment-aware, reconciled to canonical spec.
//
//   Universe: close_date ∈ [thisMonthStart, thisMonthEnd], excl. cancelled
//
//   Cards:
//     projected           = Σ tc_fee for universe          (count: |universe|)
//     closedAndPaid       = Σ tc_fee for CLOSED && PAID    (count: matches)
//     awaitingPayment     = Σ outstanding for CLOSED && !PAID (count: matches)
//     stillToClose        = Σ remaining for !CLOSED        (count: matches)
//
//   Reconciliation:
//     closedAndPaidCount + awaitingCount + stillToCloseCount === projectedCount
//
//   Progress bar segments (sum to projected $):
//     closedFull          ← whole tc_fee for closed+paid deals        (green)
//     closedReceived      ← received portion on closed but not full   (green)
//     closedOutstanding   ← unpaid remainder on closed but not full   (amber)
//     notClosedReceived   ← received portion on not-closed deals      (green)
//     notClosedRemaining  ← unpaid remainder on not-closed deals      (gray)
//
//   "Closures" bar: Σ tc_fee for closed deals in universe / projected.
// ─────────────────────────────────────────────────────────────────────────
export function thisMonthMetrics(deals, allPayments, ref = new Date()) {
  const start = startOfMonth(ref)
  const end   = endOfMonth(ref)
  const monthLabel = format(ref, 'MMMM yyyy')
  const monthKey   = format(ref, 'yyyy-MM')
  const byDeal = indexPaymentsByDeal(allPayments)
  const universe = dealsInWindow(deals, start, end)

  let projected = 0
  let closedAndPaid = 0, closedAndPaidCount = 0
  let awaitingPayment = 0, awaitingCount = 0
  let stillToClose = 0, stillToCloseCount = 0
  // Five-segment buckets for collections bar.
  let segClosedFull = 0, segClosedReceived = 0, segClosedOutstanding = 0
  let segNotClosedReceived = 0, segNotClosedRemaining = 0
  // Closures bar.
  let closedFeeSum = 0, closedCount = 0

  for (const deal of universe) {
    const fee = num(deal.tc_fee)
    const payments = byDeal[deal.id] || []
    const received = Math.min(fee, sumPayments(payments))
    const remaining = Math.max(0, fee - received)
    const closed = isClosed(deal)

    projected += fee

    if (closed) {
      closedFeeSum += fee
      closedCount += 1
      if (received >= fee && fee > 0) {
        closedAndPaid += fee
        closedAndPaidCount += 1
        segClosedFull += fee
      } else {
        awaitingPayment += remaining
        awaitingCount += 1
        segClosedReceived += received
        segClosedOutstanding += remaining
      }
    } else {
      stillToClose += remaining
      stillToCloseCount += 1
      segNotClosedReceived += received
      segNotClosedRemaining += remaining
    }
  }

  const projectedCount = universe.length

  // Cap segment widths at projected — float artifacts only, but defensive.
  const safeProjected = Math.max(1, projected) // avoid div-by-zero
  const pct = (v) => projected > 0 ? (v / safeProjected) * 100 : 0

  return {
    monthLabel, monthKey,
    universe,
    projected, projectedCount,
    closedAndPaid, closedAndPaidCount,
    awaitingPayment, awaitingCount,
    stillToClose, stillToCloseCount,
    // Closures bar
    closedFeeSum, closedCount,
    closuresPct: pct(closedFeeSum),
    // Collections bar segments (% of projected)
    segments: {
      closedFull: segClosedFull,
      closedReceived: segClosedReceived,
      closedOutstanding: segClosedOutstanding,
      notClosedReceived: segNotClosedReceived,
      notClosedRemaining: segNotClosedRemaining,
      // Aggregate dollar tallies for the caption line.
      collected: segClosedFull + segClosedReceived + segNotClosedReceived,
      awaiting: segClosedOutstanding,
      pending: segNotClosedRemaining,
    },
    segmentsPct: {
      closedFull: pct(segClosedFull),
      closedReceived: pct(segClosedReceived),
      closedOutstanding: pct(segClosedOutstanding),
      notClosedReceived: pct(segNotClosedReceived),
      notClosedRemaining: pct(segNotClosedRemaining),
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Business Overview metrics — payment-aware, reconciled to This Month.
//
//   Listings        = count where status='listing'
//   UnderContract # = count where status='active'
//   Cancelled       = count where status='cancelled'
//   Closed YTD      = count where status='closed' AND close_date in current
//                     calendar year
//   Collected       = Σ payments.amount where payment_date is YTD
//                     (across ALL deals — total revenue in)
//   Outstanding Fees= Σ outstanding for ALL closed deals (any month/year)
//                     where Σ payments < tc_fee
//                     (canonical: tc_fee − Σ payments per closed deal)
//   UnderContract $ = Σ tc_fee for status='active'
//   Potential       = Σ tc_fee for status='listing'
//   Total Pipeline  = Outstanding Fees + UnderContract$ + Potential
// ─────────────────────────────────────────────────────────────────────────
export function businessOverviewMetrics(deals, allPayments, ref = new Date()) {
  const year = ref.getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`
  const byDeal = indexPaymentsByDeal(allPayments)

  const listings = deals.filter(isListing)
  const active = deals.filter(isActive)
  const cancelled = deals.filter(isCancelled)
  const closedAll = deals.filter(isClosed)
  const closedYTD = closedAll.filter(d => d.close_date && d.close_date >= yearStart && d.close_date <= yearEnd)

  // Collected = Σ payments YTD across all deals.
  const collected = allPayments
    .filter(p => p.payment_date >= yearStart && p.payment_date <= yearEnd)
    .reduce((s, p) => s + num(p.amount), 0)

  // Outstanding Fees = Σ (tc_fee - received) for ALL closed deals where
  // received < tc_fee.
  const outstandingFees = closedAll.reduce((s, d) => {
    const fee = num(d.tc_fee)
    const received = sumPayments(byDeal[d.id] || [])
    if (received >= fee) return s
    return s + Math.max(0, fee - received)
  }, 0)

  const underContractProjected = active.reduce((s, d) => s + num(d.tc_fee), 0)
  const potentialFees = listings.reduce((s, d) => s + num(d.tc_fee), 0)
  const totalPipeline = outstandingFees + underContractProjected + potentialFees

  return {
    listingsCount: listings.length,
    activeCount: active.length,
    cancelledCount: cancelled.length,
    closedYTDCount: closedYTD.length,
    collected,
    outstandingFees,
    underContractProjected,
    potentialFees,
    totalPipeline,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Sanity scenarios (also asserted in dev console on import in non-prod).
// ─────────────────────────────────────────────────────────────────────────
export function _runSanityScenarios() {
  const ref = new Date(2026, 3, 15) // April 2026
  const mk = (id, fee, status, payments = []) => ({ id, tc_fee: fee, status, close_date: '2026-04-15' })
  const pay = (deal_id, amount, payment_date = '2026-04-10') => ({ deal_id, amount, payment_date })

  const deals = [
    mk('A', 1000, 'closed'),  // fully paid
    mk('B', 500,  'closed'),  // partial 300
    mk('C', 800,  'active'),  // not closed, no payment
    mk('D', 1200, 'active'),  // not closed, partial 400
  ]
  const payments = [
    pay('A', 1000),
    pay('B', 300),
    pay('D', 400),
  ]
  const m = thisMonthMetrics(deals, payments, ref)

  const expect = (label, actual, want) => {
    const ok = actual === want
    if (!ok) console.warn(`[dashboardMetrics] ${label}: expected ${want}, got ${actual}`)
    return ok
  }

  let pass = true
  pass &= expect('projected $', m.projected, 3500)
  pass &= expect('projectedCount', m.projectedCount, 4)
  pass &= expect('closedAndPaid $', m.closedAndPaid, 1000)
  pass &= expect('closedAndPaidCount', m.closedAndPaidCount, 1)
  pass &= expect('awaiting $', m.awaitingPayment, 200)
  pass &= expect('awaitingCount', m.awaitingCount, 1)
  pass &= expect('stillToClose $', m.stillToClose, 1600) // 800 + 800 (1200-400)
  pass &= expect('stillToCloseCount', m.stillToCloseCount, 2)
  // Counts reconcile: 1 + 1 + 2 = 4 = projectedCount.
  pass &= expect('count reconcile', m.closedAndPaidCount + m.awaitingCount + m.stillToCloseCount, m.projectedCount)
  // Segment sum equals projected.
  const segSum = m.segments.closedFull + m.segments.closedReceived + m.segments.closedOutstanding
              + m.segments.notClosedReceived + m.segments.notClosedRemaining
  pass &= expect('segments sum to projected', segSum, m.projected)
  // Closures bar: 2 of 4 closed, $ 1500 of 3500.
  pass &= expect('closedCount', m.closedCount, 2)
  pass &= expect('closedFeeSum', m.closedFeeSum, 1500)
  return !!pass
}
