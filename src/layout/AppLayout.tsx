import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import ScrollToTopButton from '../components/ScrollToTopButton'
import SupportFab from '../components/SupportFab'
import PurchaseInvoiceImportBadge from '../components/supportDocument/PurchaseInvoiceImportBadge'
import JarvisDocumentQuotaNotice from '../components/JarvisDocumentQuotaNotice'
import JarvisBackNavigation from '../components/JarvisBackNavigation'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { hydrateFromStorage } from '../services/realtime/purchaseInvoiceImportJobsStore'
import './AppLayout.css'

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)
  const { isJarvisCompany } = useIntegrationSetup()
  const { user } = useAuth()

  useEffect(() => {
    void hydrateFromStorage()
  }, [])

  return (
    <div
      className={`app-layout${isSidebarOpen ? '' : ' app-layout--sidebar-collapsed'}${isJarvisCompany ? ' app-layout--jarvis' : ''}`}
    >
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpen={() => setIsSidebarOpen(true)}
      />

      <div className="app-layout__content" ref={contentRef}>
        <JarvisDocumentQuotaNotice />
        <JarvisBackNavigation key={user?.company?.id} enabled={isJarvisCompany}>
          <Outlet />
        </JarvisBackNavigation>
      </div>

      <ScrollToTopButton scrollContainerRef={contentRef} />
      {isJarvisCompany && <SupportFab />}

      <PurchaseInvoiceImportBadge />
    </div>
  )
}

export default AppLayout
