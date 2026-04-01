import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Deals from './pages/Deals'
import AgentProfiles from './pages/AgentProfiles'
import Reports from './pages/Reports'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/deals" element={<Deals />} />
        <Route path="/agents" element={<AgentProfiles />} />
        <Route path="/reports" element={<Reports />} />
      </Route>
    </Routes>
  )
}
