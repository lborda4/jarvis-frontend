import { Navigate } from 'react-router-dom'
import LoadingIndicator from './LoadingIndicator'
import JarvisDashboardPage from '../pages/JarvisDashboardPage'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import '../pages/AuthPages.css'

function DefaultAppRedirect() {
  const {
    isCheckingSetup,
    requiresSetup,
    setupPath,
    isJarvisCompany,
    isSupportDocumentEnabled,
    integrationMode,
  } = useIntegrationSetup()

  if (isCheckingSetup || integrationMode === 'unknown') {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Cargando..." />
      </div>
    )
  }

  if (isJarvisCompany) return <JarvisDashboardPage />

  if (requiresSetup) {
    return (
      <Navigate
        to={setupPath}
        replace
        state={{ integrationSetupRequired: true }}
      />
    )
  }

  if (isSupportDocumentEnabled) {
    return <Navigate to="/documento-soporte" replace />
  }

  return <Navigate to="/documento-soporte" replace />
}

export default DefaultAppRedirect
