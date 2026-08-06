import { Navigate } from 'react-router-dom'
import LoadingIndicator from './LoadingIndicator'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import SupportDocumentIndividualPage from '../pages/SupportDocumentIndividualPage'
import SupportDocumentPage from '../pages/SupportDocumentPage'
import SupportDocumentStart from '../pages/SupportDocumentStart'
import {
  JARVIS_SUPPORT_DOCUMENT_WORKSPACE,
  SUPPORT_DOCUMENT_WORKSPACE,
} from '../constants/documentWorkspaceConfig'
import { INTEGRATION_PROVIDER } from '../types/integration'
import '../pages/AuthPages.css'

interface SupportDocumentRouteProps {
  view?: 'start' | 'workspace' | 'individual'
}

function SupportDocumentRoute({ view = 'start' }: SupportDocumentRouteProps) {
  const {
    isCheckingSetup,
    isSupportDocumentEnabled,
    integrationProviders,
    integrationMode,
    setupPath,
  } = useIntegrationSetup()
  const hasJarvisIntegration = integrationProviders.includes(
    INTEGRATION_PROVIDER.JARVIS,
  )

  if (isCheckingSetup || integrationMode === 'unknown') {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Verificando configuración..." />
      </div>
    )
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

  if (hasJarvisIntegration && view === 'start') {
    return <SupportDocumentStart />
  }

  if (hasJarvisIntegration && view === 'individual') {
    return <SupportDocumentIndividualPage />
  }

  if (view === 'individual') {
    return <Navigate to="/documento-soporte" replace />
  }

  return (
    <SupportDocumentPage
      config={
        hasJarvisIntegration
          ? JARVIS_SUPPORT_DOCUMENT_WORKSPACE
          : SUPPORT_DOCUMENT_WORKSPACE
      }
    />
  )
}

export default SupportDocumentRoute
