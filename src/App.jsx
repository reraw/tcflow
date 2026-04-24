import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Deals from './pages/Deals'
import AgentProfiles from './pages/AgentProfiles'
import Reports from './pages/Reports'
import CalendarView from './pages/CalendarView'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/deals" element={<Deals />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/agents" element={<AgentProfiles />} />
        <Route path="/reports" element={<Reports />} />
      </Route>
    </Routes>
  )
}
