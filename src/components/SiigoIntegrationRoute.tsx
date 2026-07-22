import { Navigate } from 'react-router-dom'
import LoadingIndicator from './LoadingIndicator'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import SiigoIntegrationSettings from '../pages/SiigoIntegrationSettings'
import '../pages/AuthPages.css'

function SiigoIntegrationRoute() {
  const { isCheckingSetup, isSiigoCompany, setupPath } = useIntegrationSetup()

  if (isCheckingSetup) {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Cargando..." />
      </div>
    )
  }

  if (!isSiigoCompany) {
    return <Navigate to={setupPath} replace />
  }

  return <SiigoIntegrationSettings />
}

export default SiigoIntegrationRoute
