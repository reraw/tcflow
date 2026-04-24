import { NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { LayoutDashboard, FileText, Users, BarChart3, Calendar, X, LogOut, Briefcase } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/deals', label: 'Deals', icon: FileText },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/agents', label: 'Agent Profiles', icon: Users },
  { to: '/vendors', label: 'Vendors', icon: Briefcase },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
]

export default function Sidebar({ open, onClose }) {
  const { user, signOut } = useAuth()

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-200 ease-in-out flex flex-col
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-0`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 shrink-0">
          <h1 className="text-xl font-bold text-indigo-primary">TCFlow</h1>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <nav className="mt-6 px-3 space-y-1 flex-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-primary'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User & Logout */}
        <div className="px-3 pb-4 border-t border-gray-200 pt-3 shrink-0">
          {user && (
            <p className="text-xs text-gray-400 truncate px-3 mb-2">{user.email}</p>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
