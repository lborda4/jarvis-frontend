import { Navigate } from 'react-router-dom'
import LoadingIndicator from './LoadingIndicator'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import JarvisIntegrationSettings from '../pages/JarvisIntegrationSettings'
import '../pages/AuthPages.css'

function JarvisIntegrationRoute() {
  const { isCheckingSetup, isJarvisCompany, setupPath } = useIntegrationSetup()

  if (isCheckingSetup) {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Cargando..." />
      </div>
    )
  }

  if (!isJarvisCompany) {
    return <Navigate to={setupPath} replace />
  }

  return <JarvisIntegrationSettings />
}

export default JarvisIntegrationRoute
