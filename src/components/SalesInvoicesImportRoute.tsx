import { Navigate } from 'react-router-dom'
import LoadingIndicator from './LoadingIndicator'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { SALES_INVOICE_BULK_IMPORT_ENABLED } from '../constants/featureFlags'
import SalesInvoicesImportPage from '../pages/SalesInvoicesImportPage'

export default function SalesInvoicesImportRoute() {
  const { isCheckingSetup, integrationMode, isJarvisCompany, isSalesInvoiceEnabled, setupPath } = useIntegrationSetup()
  if (isCheckingSetup || integrationMode === 'unknown') return <LoadingIndicator message="Verificando configuración…" />
  if (!isJarvisCompany || !isSalesInvoiceEnabled) return <Navigate to={setupPath} replace state={{ integrationSetupRequired: true }} />
  return SALES_INVOICE_BULK_IMPORT_ENABLED ? <SalesInvoicesImportPage /> : <Navigate to="/factura-venta" replace />
}
