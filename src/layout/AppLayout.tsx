import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import './AppLayout.css'

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div
      className={`app-layout${isSidebarOpen ? '' : ' app-layout--sidebar-collapsed'}`}
    >
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpen={() => setIsSidebarOpen(true)}
      />

      <div className="app-layout__content">
        <Outlet />
      </div>
    </div>
  )
}

export default AppLayout
