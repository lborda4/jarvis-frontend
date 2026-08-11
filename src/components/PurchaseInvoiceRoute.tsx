import { Navigate } from 'react-router-dom'
import LoadingIndicator from './LoadingIndicator'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import SupportDocumentPage from '../pages/SupportDocumentPage'
import {
  JARVIS_PURCHASE_INVOICE_WORKSPACE,
  PURCHASE_INVOICE_WORKSPACE,
} from '../constants/documentWorkspaceConfig'
import { INTEGRATION_PROVIDER } from '../types/integration'
import '../pages/AuthPages.css'

function PurchaseInvoiceRoute() {
  const {
    isCheckingSetup,
    isPurchaseInvoiceEnabled,
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

  if (!isPurchaseInvoiceEnabled) {
    return (
      <Navigate
        to={setupPath}
        replace
        state={{ integrationSetupRequired: true }}
      />
    )
  }

  return (
    <SupportDocumentPage
      config={
        hasJarvisIntegration
          ? JARVIS_PURCHASE_INVOICE_WORKSPACE
          : PURCHASE_INVOICE_WORKSPACE
      }
    />
  )
}

export default PurchaseInvoiceRoute
