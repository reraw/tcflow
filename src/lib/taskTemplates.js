// Default task checklist templates.
// ─────────────────────────────────────────────────────────────────────────
// Fixed, code-defined checklists materialized into the `tasks` table for
// deals that originated as listings (deals.created_as_listing === true).
// Each item has a STABLE template_key — never rename one, or existing seeded
// rows orphan. sort_order follows array position.
// ─────────────────────────────────────────────────────────────────────────

export const LISTING_TASK_TEMPLATES = [
  { template_key: 'listing_create_skyslope', label: 'Create SkySlope' },
  { template_key: 'listing_input_mls', label: 'Input MLS' },
  { template_key: 'listing_upload_photos', label: 'Upload Photos' },
  { template_key: 'listing_write_description', label: 'Write Description' },
  { template_key: 'listing_send_seller_disclosures', label: 'Send Seller Disclosures' },
  { template_key: 'listing_send_seller_agreement_copy', label: 'Send Seller Copy of Agreement' },
  { template_key: 'listing_order_up_sign', label: 'Order Up Sign' },
  { template_key: 'listing_top_producer', label: 'Top Producer' },
]

export const CLOSED_TASK_TEMPLATES = [
  { template_key: 'closed_change_mls_status', label: 'Change MLS Status' },
  { template_key: 'closed_order_down_sign', label: 'Order Down Sign' },
]

// Keyed by stage. Each template is stamped with its stage + sort_order so a
// single seedDefaultTasks(dealId, stage) call has everything it needs.
export const DEFAULT_TASK_TEMPLATES = {
  listing: LISTING_TASK_TEMPLATES.map((t, i) => ({ ...t, stage: 'listing', sort_order: i })),
  closed: CLOSED_TASK_TEMPLATES.map((t, i) => ({ ...t, stage: 'closed', sort_order: i })),
}

// Section headers for the Tasks tab.
export const STAGE_LABELS = { listing: 'Listing Tasks', closed: 'Closing Tasks' }
export const STAGE_RANK = { listing: 0, closed: 1 }

// A task is RESOLVED when complete or n/a; OUTSTANDING otherwise (open/unset).
export const isTaskResolved = (task) => task?.status === 'complete' || task?.status === 'na'
export const isTaskOpen = (task) => !isTaskResolved(task)

// Human-readable gate-rejection message for forward status changes.
export function gateMessage(remaining = []) {
  const n = remaining.length
  return `Cannot advance — ${n} task${n === 1 ? '' : 's'} remaining: ${remaining.join(', ')}`
}
