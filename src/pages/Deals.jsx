import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDeals } from '../hooks/useSupabase'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../lib/helpers'
import Modal from '../components/ui/Modal'
import DealForm from '../components/deals/DealForm'
import DealDetailModal from '../components/deals/DealDetailModal'
import { Plus, Search } from 'lucide-react'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'listing', label: 'Listings' },
  { key: 'active', label: 'Under Contract' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'closed', label: 'Closed' },
]

export default function Deals() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('status') || 'all'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [search, setSearch] = useState('')
  const { deals, loading, createDeal, updateDeal } = useDeals()

  const filteredDeals = useMemo(() => {
    let filtered = deals
    if (activeTab !== 'all') {
      filtered = filtered.filter(d => d.status === activeTab)
    }
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(d =>
        d.address?.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q)
      )
    }
    return filtered
  }, [deals, activeTab, search])

  const handleTabChange = (key) => {
    setActiveTab(key)
    if (key === 'all') setSearchParams({})
    else setSearchParams({ status: key })
  }

  const handleCreateDeal = async (formData) => {
    await createDeal(formData)
    setShowNewDeal(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Deals</h2>
        <button
          onClick={() => setShowNewDeal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700"
        >
          <Plus size={16} /> New Deal
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-indigo-primary text-indigo-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
              {tab.key === 'all' ? deals.length : deals.filter(d => d.status === tab.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full sm:w-80 pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          placeholder="Search by address or city..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading deals...</div>
      ) : filteredDeals.length === 0 ? (
        <div className="text-center text-gray-400 py-12">No deals found</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Property</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Price</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Close Date</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">TC Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDeals.map(deal => (
                  <tr
                    key={deal.id}
                    onClick={() => setSelectedDeal(deal)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{deal.address}</div>
                      {deal.city && <div className="text-xs text-gray-500">{deal.city}</div>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="capitalize text-gray-700">{deal.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(deal.status)}`}>
                        {getStatusLabel(deal.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 hidden md:table-cell">{formatCurrency(deal.price)}</td>
                    <td className="px-4 py-3 text-gray-700 hidden lg:table-cell">{formatDate(deal.close_date)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-gray-900">{formatCurrency(deal.tc_fee)}</span>
                      {deal.tc_paid && <span className="ml-1.5 text-xs text-green-600">Paid</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Deal Modal */}
      <Modal open={showNewDeal} onClose={() => setShowNewDeal(false)} title="New Deal" wide>
        <DealForm onSubmit={handleCreateDeal} onCancel={() => setShowNewDeal(false)} />
      </Modal>

      {/* Deal Detail Modal */}
      <DealDetailModal
        deal={selectedDeal}
        open={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
        onUpdate={async (id, updates) => {
          const updated = await updateDeal(id, updates)
          if (updated) setSelectedDeal(updated)
        }}
      />
    </div>
  )
}
