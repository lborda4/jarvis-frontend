import { Navigate } from 'react-router-dom'
import LoadingIndicator from './LoadingIndicator'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import '../pages/AuthPages.css'

function DefaultAppRedirect() {
  const {
    isCheckingSetup,
    requiresSetup,
    setupPath,
    isJarvisCompany,
    isConfigured,
  } = useIntegrationSetup()

  if (isCheckingSetup) {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Cargando..." />
      </div>
    )
  }

  if (requiresSetup) {
    return (
      <Navigate
        to={setupPath}
        replace
        state={{ integrationSetupRequired: true }}
      />
    )
  }

  if (isJarvisCompany && isConfigured) {
    return <Navigate to="/configuracion/integracion-jarvis" replace />
  }

  return <Navigate to="/documento-soporte" replace />
}

export default DefaultAppRedirect
