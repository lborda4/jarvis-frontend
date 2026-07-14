import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PanelLeftIcon } from '../components/icons/SidebarIcons'
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
      />

      <div className="app-layout__content">
        {!isSidebarOpen && (
          <button
            type="button"
            className="app-layout__sidebar-open"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Mostrar menú lateral"
            title="Mostrar menú"
          >
            <PanelLeftIcon className="app-layout__sidebar-open-icon" />
            <span className="app-layout__sidebar-open-label">Menú</span>
          </button>
        )}

        <Outlet />
      </div>
    </div>
  )
}

export default AppLayout
