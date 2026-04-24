import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO } from 'date-fns'
import DealDetailModal from '../components/deals/DealDetailModal'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [deals, setDeals] = useState([])
  const [customDates, setCustomDates] = useState([])
  const [tasks, setTasks] = useState([])
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const [{ data: d }, { data: cd }, { data: t }] = await Promise.all([
        supabase.from('deals').select('*'),
        supabase.from('custom_dates').select('*, deals(address, id, status)'),
        supabase.from('tasks').select('*, deals(address, id, status)').eq('completed', false),
      ])
      setDeals(d || [])
      setCustomDates(cd || [])
      setTasks(t || [])
      setLoading(false)
    }
    fetch()
  }, [])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart)
    const calEnd = endOfWeek(monthEnd)

    const days = []
    let day = calStart
    while (day <= calEnd) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentMonth])

  // Build events for each day
  const eventsByDay = useMemo(() => {
    const map = {}
    const addEvent = (date, event) => {
      const key = format(date, 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(event)
    }

    // Close dates (red)
    deals.forEach(deal => {
      if (!deal.close_date || deal.status === 'cancelled') return
      const d = parseISO(deal.close_date)
      addEvent(d, { label: deal.address, color: 'bg-red-500', textColor: 'text-white', deal, type: 'close' })
    })

    // Custom dates
    customDates.forEach(cd => {
      if (!cd.date || !cd.deals) return
      const d = parseISO(cd.date)
      const isContingency = cd.label.startsWith('Contingency:') || cd.label.startsWith('Contingency: ')
      const isInspection = cd.label.startsWith('Inspection:') || cd.label.startsWith('Inspection: ')
      let color = 'bg-gray-400'
      let textColor = 'text-white'
      if (isContingency) color = 'bg-purple-500'
      else if (isInspection) color = 'bg-blue-500'
      const cleanLabel = cd.label.replace(/^(Contingency|Inspection):\s?/, '')
      addEvent(d, { label: `${cleanLabel} — ${cd.deals.address}`, color, textColor, deal: cd.deals, type: 'custom' })
    })

    // Tasks (orange)
    tasks.forEach(t => {
      if (!t.due_date || !t.deals) return
      const d = parseISO(t.due_date)
      addEvent(d, { label: `${t.description} — ${t.deals.address}`, color: 'bg-orange-500', textColor: 'text-white', deal: t.deals, type: 'task' })
    })

    return map
  }, [deals, customDates, tasks])

  const handleEventClick = (event) => {
    if (event.deal?.id) {
      const fullDeal = deals.find(d => d.id === event.deal.id)
      if (fullDeal) setSelectedDeal(fullDeal)
    }
  }

  const today = new Date()

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Loading...</div></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Calendar</h2>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft size={20} /></button>
          <h3 className="text-lg font-semibold text-gray-800 min-w-[160px] text-center">{format(currentMonth, 'MMMM yyyy')}</h3>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight size={20} /></button>
          <button onClick={() => setCurrentMonth(startOfMonth(new Date()))} className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50">Today</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500" /> Close of Escrow</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-500" /> Contingency</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" /> Inspection</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-400" /> Other Date</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-500" /> Task</div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Day names header */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {DAY_NAMES.map(d => (
            <div key={d} className="px-2 py-2 text-xs font-medium text-gray-500 text-center">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const key = format(day, 'yyyy-MM-dd')
            const events = eventsByDay[key] || []
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isToday = isSameDay(day, today)

            return (
              <div key={key} className={`min-h-[100px] border-b border-r border-gray-100 p-1 ${!isCurrentMonth ? 'bg-gray-50' : ''}`}>
                <div className={`text-xs font-medium mb-1 text-right px-1 ${isToday ? 'bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center ml-auto' : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {events.slice(0, 3).map((event, j) => (
                    <button
                      key={j}
                      onClick={() => handleEventClick(event)}
                      className={`w-full text-left px-1 py-0.5 rounded text-[10px] font-medium truncate ${event.color} ${event.textColor} hover:opacity-80`}
                    >
                      {event.label}
                    </button>
                  ))}
                  {events.length > 3 && (
                    <p className="text-[10px] text-gray-400 px-1">+{events.length - 3} more</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <DealDetailModal
        deal={selectedDeal}
        open={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
        onUpdate={async (id, updates) => {
          const { data } = await supabase.from('deals').update(updates).eq('id', id).select('*').single()
          if (data) { setSelectedDeal(data); setDeals(prev => prev.map(d => d.id === id ? data : d)) }
        }}
      />
    </div>
  )
}
