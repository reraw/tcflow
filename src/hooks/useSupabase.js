import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export function useDeals() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchDeals = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('useDeals error:', error)
    if (!error) setDeals(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchDeals() }, [fetchDeals])

  const logHistory = async (dealId, text) => {
    await supabase.from('deal_history').insert({
      deal_id: dealId,
      text,
      entry_date: format(new Date(), 'yyyy-MM-dd'),
    })
  }

  const createDeal = async (deal) => {
    const { data, error } = await supabase.from('deals').insert(deal).select('*').single()
    if (error) console.error('createDeal error:', error)
    if (!error && data) {
      setDeals(prev => [data, ...prev])
      await logHistory(data.id, 'Deal created')
      return data
    }
    return null
  }

  const updateDeal = async (id, updates) => {
    // Grab old deal for comparison
    const oldDeal = deals.find(d => d.id === id)
    const { data, error } = await supabase.from('deals').update(updates).eq('id', id).select('*').single()
    if (error) console.error('updateDeal error:', error)
    if (!error && data) {
      setDeals(prev => prev.map(d => d.id === id ? data : d))
      // Auto-log changes
      if (oldDeal) {
        if (updates.status !== undefined && updates.status !== oldDeal.status) {
          const labels = { active: 'Under Contract', listing: 'Listing', closed: 'Closed', cancelled: 'Cancelled' }
          await logHistory(id, `Status changed to ${labels[updates.status] || updates.status}`)
        }
        if (updates.tc_paid !== undefined && updates.tc_paid !== oldDeal.tc_paid) {
          await logHistory(id, updates.tc_paid ? 'TC fee marked as paid' : 'TC fee marked as unpaid')
        }
        if (updates.close_date !== undefined && updates.close_date !== oldDeal.close_date && updates.close_date) {
          await logHistory(id, `Close date updated to ${format(new Date(updates.close_date + 'T00:00:00'), 'MM/dd/yyyy')}`)
        }
      }
      return data
    }
    return null
  }

  const deleteDeal = async (id) => {
    const { error } = await supabase.from('deals').delete().eq('id', id)
    if (!error) setDeals(prev => prev.filter(d => d.id !== id))
  }

  return { deals, loading, fetchDeals, createDeal, updateDeal, deleteDeal }
}

export function useContingencies(dealId) {
  const [contingencies, setContingencies] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!dealId) return
    const fetch = async () => {
      setLoading(true)
      const { data } = await supabase.from('contingencies').select('*').eq('deal_id', dealId).single()
      setContingencies(data)
      setLoading(false)
    }
    fetch()
  }, [dealId])

  const upsertContingencies = async (values) => {
    const payload = { ...values, deal_id: dealId }
    if (contingencies?.id) {
      const { data } = await supabase.from('contingencies').update(payload).eq('id', contingencies.id).select().single()
      if (data) setContingencies(data)
      return data
    } else {
      const { data } = await supabase.from('contingencies').insert(payload).select().single()
      if (data) setContingencies(data)
      return data
    }
  }

  return { contingencies, loading, upsertContingencies }
}

export function useContacts(dealId) {
  const [contacts, setContacts] = useState([])
  const [extraContacts, setExtraContacts] = useState([])

  useEffect(() => {
    if (!dealId) return
    const fetch = async () => {
      const [{ data: c }, { data: ec }] = await Promise.all([
        supabase.from('contacts').select('*').eq('deal_id', dealId),
        supabase.from('extra_contacts').select('*').eq('deal_id', dealId),
      ])
      setContacts(c || [])
      setExtraContacts(ec || [])
    }
    fetch()
  }, [dealId])

  const upsertContact = async (contact) => {
    const payload = { ...contact, deal_id: dealId }
    if (contact.id) {
      const { data } = await supabase.from('contacts').update(payload).eq('id', contact.id).select().single()
      if (data) setContacts(prev => prev.map(c => c.id === data.id ? data : c))
      return data
    } else {
      const { data } = await supabase.from('contacts').insert(payload).select().single()
      if (data) setContacts(prev => [...prev, data])
      return data
    }
  }

  const addExtraContact = async (contact) => {
    const { data } = await supabase.from('extra_contacts').insert({ ...contact, deal_id: dealId }).select().single()
    if (data) setExtraContacts(prev => [...prev, data])
    return data
  }

  const deleteExtraContact = async (id) => {
    await supabase.from('extra_contacts').delete().eq('id', id)
    setExtraContacts(prev => prev.filter(c => c.id !== id))
  }

  return { contacts, extraContacts, upsertContact, addExtraContact, deleteExtraContact }
}

export function useDealHistory(dealId) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!dealId) return
    const fetch = async () => {
      const { data } = await supabase.from('deal_history').select('*').eq('deal_id', dealId).order('created_at', { ascending: false })
      setHistory(data || [])
    }
    fetch()
  }, [dealId])

  const addEntry = async (text, entryDate) => {
    const { data } = await supabase.from('deal_history')
      .insert({ deal_id: dealId, text, entry_date: entryDate || new Date().toISOString().split('T')[0] })
      .select().single()
    if (data) setHistory(prev => [data, ...prev])
    return data
  }

  return { history, addEntry }
}

export function useCustomDates(dealId) {
  const [customDates, setCustomDates] = useState([])

  const fetchDates = useCallback(async () => {
    if (!dealId) return
    const { data } = await supabase.from('custom_dates').select('*').eq('deal_id', dealId).order('date')
    setCustomDates(data || [])
  }, [dealId])

  useEffect(() => { fetchDates() }, [fetchDates])

  const addCustomDate = async (label, date) => {
    const { data } = await supabase.from('custom_dates').insert({ deal_id: dealId, label, date }).select().single()
    if (data) setCustomDates(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)))
    return data
  }

  const updateCustomDate = async (id, label, date) => {
    const { data } = await supabase.from('custom_dates').update({ label, date }).eq('id', id).select().single()
    if (data) setCustomDates(prev => prev.map(d => d.id === id ? data : d).sort((a, b) => a.date.localeCompare(b.date)))
    return data
  }

  const deleteCustomDate = async (id) => {
    await supabase.from('custom_dates').delete().eq('id', id)
    setCustomDates(prev => prev.filter(d => d.id !== id))
  }

  const bulkSyncDates = async (dates) => {
    await supabase.from('custom_dates').delete().eq('deal_id', dealId)
    if (dates.length > 0) {
      const rows = dates.map(d => ({ deal_id: dealId, label: d.label, date: d.date }))
      await supabase.from('custom_dates').insert(rows)
    }
    await fetchDates()
  }

  return { customDates, addCustomDate, updateCustomDate, deleteCustomDate, bulkSyncDates, fetchDates }
}

export function useReminderDismissals() {
  const [dismissals, setDismissals] = useState([])

  const fetchDismissals = useCallback(async () => {
    const { data } = await supabase.from('reminder_dismissals').select('*, deals(address)')
    setDismissals(data || [])
  }, [])

  useEffect(() => { fetchDismissals() }, [fetchDismissals])

  const findDismissal = (dealId, reminderKey) =>
    dismissals.find(d => d.deal_id === dealId && d.reminder_key === reminderKey)

  const isDismissed = (dealId, reminderKey) => !!findDismissal(dealId, reminderKey)

  const getCompletedAt = (dealId, reminderKey) => findDismissal(dealId, reminderKey)?.completed_at || null

  const toggleDismissal = async (dealId, reminderKey) => {
    const existing = findDismissal(dealId, reminderKey)
    if (existing) {
      await supabase.from('reminder_dismissals').delete().eq('id', existing.id)
      setDismissals(prev => prev.filter(d => d.id !== existing.id))
    } else {
      const { data } = await supabase
        .from('reminder_dismissals')
        .insert({ deal_id: dealId, reminder_key: reminderKey, completed_at: new Date().toISOString() })
        .select('*, deals(address)')
        .single()
      if (data) setDismissals(prev => [...prev, data])
    }
  }

  return { dismissals, isDismissed, getCompletedAt, toggleDismissal }
}

export function useTasks(dealId) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('tasks').select('*, deals(address)').order('completed').order('due_date', { ascending: true, nullsFirst: false })
    if (dealId) query = query.eq('deal_id', dealId)
    const { data } = await query
    setTasks(data || [])
    setLoading(false)
  }, [dealId])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const createTask = async (task) => {
    const { data, error } = await supabase.from('tasks').insert(task).select('*, deals(address)').single()
    if (error) console.error('createTask error:', error)
    if (data) setTasks(prev => [...prev, data].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1)))
    return data
  }

  const toggleTask = async (id, completed) => {
    const { data } = await supabase.from('tasks').update({ completed }).eq('id', id).select('*, deals(address)').single()
    if (data) setTasks(prev => prev.map(t => t.id === id ? data : t))
    return data
  }

  const deleteTask = async (id) => {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  return { tasks, loading, fetchTasks, createTask, toggleTask, deleteTask }
}

export function useAgents() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('agents')
      .select('*, agent_vendors(*), agent_logins(*)')
      .order('name')
    setAgents(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  const createAgent = async (agent) => {
    const { data, error } = await supabase.from('agents').insert(agent).select().single()
    if (!error) { await fetchAgents(); return data }
    return null
  }

  const updateAgent = async (id, updates) => {
    const { data, error } = await supabase.from('agents').update(updates).eq('id', id).select().single()
    if (!error) { await fetchAgents(); return data }
    return null
  }

  const deleteAgent = async (id) => {
    const { error } = await supabase.from('agents').delete().eq('id', id)
    if (!error) setAgents(prev => prev.filter(a => a.id !== id))
  }

  const addVendor = async (agentId, vendor) => {
    await supabase.from('agent_vendors').insert({ ...vendor, agent_id: agentId })
    await fetchAgents()
  }

  const updateVendor = async (id, updates) => {
    await supabase.from('agent_vendors').update(updates).eq('id', id)
    await fetchAgents()
  }

  const deleteVendor = async (id) => {
    await supabase.from('agent_vendors').delete().eq('id', id)
    await fetchAgents()
  }

  const addLogin = async (agentId, login) => {
    await supabase.from('agent_logins').insert({ ...login, agent_id: agentId })
    await fetchAgents()
  }

  const deleteLogin = async (id) => {
    await supabase.from('agent_logins').delete().eq('id', id)
    await fetchAgents()
  }

  return { agents, loading, fetchAgents, createAgent, updateAgent, deleteAgent, addVendor, updateVendor, deleteVendor, addLogin, deleteLogin }
}

// ─────────────────────────────────────────────────────────────────────────
// Payments (deal_payments) — partial payment tracking
// ─────────────────────────────────────────────────────────────────────────
export function usePayments(dealId) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPayments = useCallback(async () => {
    if (!dealId) { setPayments([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('deal_payments')
      .select('*')
      .eq('deal_id', dealId)
      .order('payment_date', { ascending: false })
    setPayments(data || [])
    setLoading(false)
  }, [dealId])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const addPayment = async ({ amount, paid_by, paid_by_other, payment_date }) => {
    const { data } = await supabase.from('deal_payments').insert({
      deal_id: dealId,
      amount: Number(amount),
      paid_by,
      paid_by_other: paid_by_other || null,
      payment_date: payment_date || new Date().toISOString().slice(0, 10),
    }).select('*').single()
    if (data) setPayments(prev => [data, ...prev])
    return data
  }

  const updatePayment = async (id, updates) => {
    const clean = { ...updates }
    if (clean.amount != null) clean.amount = Number(clean.amount)
    const { data } = await supabase.from('deal_payments').update(clean).eq('id', id).select('*').single()
    if (data) setPayments(prev => prev.map(p => p.id === id ? data : p))
    return data
  }

  const deletePayment = async (id) => {
    await supabase.from('deal_payments').delete().eq('id', id)
    setPayments(prev => prev.filter(p => p.id !== id))
  }

  const clearAllPayments = async () => {
    await supabase.from('deal_payments').delete().eq('deal_id', dealId)
    setPayments([])
  }

  return { payments, loading, fetchPayments, addPayment, updatePayment, deletePayment, clearAllPayments }
}

// Global payments cache used by Deals list + Dashboard aggregates.
export function useAllPayments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('deal_payments').select('*')
    setPayments(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { payments, loading, fetchAll, setPayments }
}

// Quick-action helpers for the Deals row popover.
export async function markPaidInFull(dealId, tcFee, paidBy = 'Agent') {
  if (!tcFee || Number(tcFee) <= 0) return null
  // Replace any existing payments with a single full-amount row.
  await supabase.from('deal_payments').delete().eq('deal_id', dealId)
  const { data } = await supabase.from('deal_payments').insert({
    deal_id: dealId,
    amount: Number(tcFee),
    paid_by: paidBy,
    payment_date: new Date().toISOString().slice(0, 10),
  }).select('*').single()
  return data
}

export async function clearPayments(dealId) {
  await supabase.from('deal_payments').delete().eq('deal_id', dealId)
}

// ─────────────────────────────────────────────────────────────────────────
// Vendors
// ─────────────────────────────────────────────────────────────────────────
export function useVendors() {
  const [vendors, setVendors] = useState([])
  const [preferences, setPreferences] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: v }, { data: p }] = await Promise.all([
      supabase.from('vendors').select('*').order('name'),
      supabase.from('agent_preferred_vendors').select('*'),
    ])
    setVendors(v || [])
    setPreferences(p || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const createVendor = async (vendor) => {
    const clean = { ...vendor }
    ;['phone', 'email', 'notes', 'vendor_type'].forEach(k => {
      if (clean[k] === '') clean[k] = null
    })
    const { data } = await supabase.from('vendors').insert(clean).select('*').single()
    if (data) setVendors(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }

  const updateVendor = async (id, updates) => {
    const { data } = await supabase.from('vendors').update(updates).eq('id', id).select('*').single()
    if (data) setVendors(prev => prev.map(v => v.id === id ? data : v))
    return data
  }

  const deleteVendor = async (id) => {
    await supabase.from('vendors').delete().eq('id', id)
    setVendors(prev => prev.filter(v => v.id !== id))
    setPreferences(prev => prev.filter(p => p.vendor_id !== id))
  }

  // Merge: reassigns all references from `fromId` to `toId`, then deletes `fromId`.
  const mergeVendor = async (fromId, toId) => {
    if (fromId === toId) return
    // 1. Reassign contacts
    await supabase.from('contacts').update({ vendor_id: toId }).eq('vendor_id', fromId)
    // 2. Reassign agent_vendors
    await supabase.from('agent_vendors').update({ vendor_id: toId }).eq('vendor_id', fromId)
    // 3. Reassign agent_preferred_vendors — trickier because (agent,vendor,type) is PK.
    //    Fetch prefs for both, manually insert "to" rows that don't exist, delete "from" rows.
    const { data: fromPrefs } = await supabase.from('agent_preferred_vendors').select('*').eq('vendor_id', fromId)
    const { data: toPrefs } = await supabase.from('agent_preferred_vendors').select('*').eq('vendor_id', toId)
    const existingKeys = new Set((toPrefs || []).map(p => `${p.agent_id}:${p.vendor_type || ''}`))
    const toInsert = (fromPrefs || [])
      .filter(p => !existingKeys.has(`${p.agent_id}:${p.vendor_type || ''}`))
      .map(p => ({ agent_id: p.agent_id, vendor_id: toId, vendor_type: p.vendor_type }))
    if (toInsert.length) await supabase.from('agent_preferred_vendors').insert(toInsert)
    await supabase.from('agent_preferred_vendors').delete().eq('vendor_id', fromId)
    // 4. Delete merged-out vendor
    await supabase.from('vendors').delete().eq('id', fromId)
    await fetchAll()
  }

  const addPreference = async (agentId, vendorId, vendorType) => {
    const { data } = await supabase
      .from('agent_preferred_vendors')
      .insert({ agent_id: agentId, vendor_id: vendorId, vendor_type: vendorType })
      .select('*').single()
    if (data) setPreferences(prev => [...prev, data])
    return data
  }

  const removePreference = async (agentId, vendorId, vendorType) => {
    await supabase.from('agent_preferred_vendors')
      .delete()
      .eq('agent_id', agentId)
      .eq('vendor_id', vendorId)
      .eq('vendor_type', vendorType)
    setPreferences(prev => prev.filter(p => !(p.agent_id === agentId && p.vendor_id === vendorId && p.vendor_type === vendorType)))
  }

  return { vendors, preferences, loading, fetchAll, createVendor, updateVendor, deleteVendor, mergeVendor, addPreference, removePreference }
}

// Find-or-create a vendor by exact (case-insensitive, trimmed) name + type.
// Called by DealForm and AgentProfiles auto-create flow. Silent — no toast.
export async function findOrCreateVendor({ name, vendor_type, phone, email, notes }) {
  const trimmed = (name || '').trim()
  if (!trimmed) return null
  // Case-insensitive lookup via ilike (index idx_vendors_name supports LOWER(name)).
  const { data: existing } = await supabase
    .from('vendors')
    .select('*')
    .ilike('name', trimmed)
    .limit(1)
  if (existing && existing.length) {
    // Opportunistic enrichment: fill phone/email if the existing row is empty.
    const v = existing[0]
    const patch = {}
    if (!v.phone && phone) patch.phone = phone
    if (!v.email && email) patch.email = email
    if (Object.keys(patch).length) {
      const { data } = await supabase.from('vendors').update(patch).eq('id', v.id).select('*').single()
      return data || v
    }
    return v
  }
  const { data: created } = await supabase.from('vendors').insert({
    name: trimmed,
    vendor_type: vendor_type || null,
    phone: phone || null,
    email: email || null,
    notes: notes || null,
  }).select('*').single()
  return created
}

