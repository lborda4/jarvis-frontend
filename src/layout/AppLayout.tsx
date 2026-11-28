import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { companyJarvisModules, jarvisModuleForPath } from '../types/companyModules'
import Sidebar from './Sidebar'
import GlobalSearch from '../components/GlobalSearch'
import ScrollToTopButton from '../components/ScrollToTopButton'
import DashboardCreateMenu from '../components/DashboardCreateMenu'
import PurchaseInvoiceImportBadge from '../components/supportDocument/PurchaseInvoiceImportBadge'
import JarvisDocumentQuotaNotice from '../components/JarvisDocumentQuotaNotice'
import SubscriptionExpiryNotice from '../components/SubscriptionExpiryNotice'
import { useSubscriptionAccess } from '../context/SubscriptionAccessContext'
import JarvisBackNavigation from '../components/JarvisBackNavigation'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { hydrateFromStorage } from '../services/realtime/purchaseInvoiceImportJobsStore'
import './AppLayout.css'
import Banner from '../components/Banner'

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)
  const { isJarvisCompany } = useIntegrationSetup()
  const { user } = useAuth()
  const { readOnly } = useSubscriptionAccess()
  const location = useLocation()
  const modules = companyJarvisModules(user?.company?.jarvisModules)
  const requiredModule = jarvisModuleForPath(location.pathname)
  const moduleUnavailable = isJarvisCompany && requiredModule && !modules.includes(requiredModule)

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
        <GlobalSearch />
        {user?.company?.isDemo && <Banner variant="info" message="Empresa demo compartida · Los cambios son visibles para todos los comerciales. Los envíos a la DIAN y los correos se simulan." />}
        <SubscriptionExpiryNotice key={user?.company?.id} />
        <JarvisDocumentQuotaNotice />
        <JarvisBackNavigation key={user?.company?.id} enabled={isJarvisCompany}>
          {moduleUnavailable ? <Navigate to="/inicio" replace /> : <Outlet />}
        </JarvisBackNavigation>
      </div>

      <ScrollToTopButton scrollContainerRef={contentRef} />
      {isJarvisCompany && !readOnly && <DashboardCreateMenu key={`${user?.company?.id}:${location.key}`} variant="floating" />}

      <PurchaseInvoiceImportBadge />
    </div>
  )
}

export default AppLayout
