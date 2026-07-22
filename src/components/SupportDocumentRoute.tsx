import { Navigate } from 'react-router-dom'
import LoadingIndicator from './LoadingIndicator'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import SupportDocumentPage from '../pages/SupportDocumentPage'
import '../pages/AuthPages.css'

function SupportDocumentRoute() {
  const {
    isCheckingSetup,
    isSupportDocumentEnabled,
    isJarvisCompany,
    setupPath,
  } = useIntegrationSetup()

  if (isCheckingSetup) {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Verificando configuración..." />
      </div>
    )
  }

  if (isJarvisCompany) {
    return <Navigate to={setupPath} replace />
  }

  if (!isSupportDocumentEnabled) {
    return (
      <Navigate
        to={setupPath}
        replace
        state={{ integrationSetupRequired: true }}
      />
    )
  }

  return <SupportDocumentPage />
}

export default SupportDocumentRoute
