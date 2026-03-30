import { Outlet } from 'react-router-dom'

import Navbar from '../components/Navbar.jsx'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-transparent text-slate-100">
      <Navbar />
      <Outlet />
    </div>
  )
}
