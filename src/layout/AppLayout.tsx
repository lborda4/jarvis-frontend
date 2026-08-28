import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import PurchaseInvoiceImportBadge from '../components/supportDocument/PurchaseInvoiceImportBadge'
import { hydrateFromStorage } from '../services/realtime/purchaseInvoiceImportJobsStore'
import './AppLayout.css'

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    void hydrateFromStorage()
  }, [])

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

      <PurchaseInvoiceImportBadge />
    </div>
  )
}

export default AppLayout
