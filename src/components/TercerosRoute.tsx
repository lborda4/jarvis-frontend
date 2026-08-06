import { Navigate } from 'react-router-dom'
import LoadingIndicator from './LoadingIndicator'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import TercerosPage from '../pages/TercerosPage'
import '../pages/AuthPages.css'

function TercerosRoute() {
  const {
    isCheckingSetup,
    isJarvisCompany,
    isConfigured,
    integrationMode,
    setupPath,
  } = useIntegrationSetup()

  if (isCheckingSetup || integrationMode === 'unknown') {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Cargando..." />
      </div>
    )
  }

  if (!isJarvisCompany) {
    return <Navigate to={setupPath} replace />
  }

  if (!isConfigured) {
    return (
      <Navigate
        to={setupPath}
        replace
        state={{ integrationSetupRequired: true }}
      />
    )
  }

  return <TercerosPage />
}

export default TercerosRoute
