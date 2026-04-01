import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useDeals() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchDeals = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setDeals(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchDeals() }, [fetchDeals])

  const createDeal = async (deal) => {
    const { data, error } = await supabase.from('deals').insert(deal).select().single()
    if (!error) { setDeals(prev => [data, ...prev]); return data }
    return null
  }

  const updateDeal = async (id, updates) => {
    const { data, error } = await supabase.from('deals').update(updates).eq('id', id).select().single()
    if (!error) { setDeals(prev => prev.map(d => d.id === id ? data : d)); return data }
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

  const addVendor = async (agentId, vendor) => {
    await supabase.from('agent_vendors').insert({ ...vendor, agent_id: agentId })
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

  return { agents, loading, fetchAgents, createAgent, updateAgent, addVendor, deleteVendor, addLogin, deleteLogin }
}
