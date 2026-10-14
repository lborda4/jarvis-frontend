import { Navigate } from 'react-router-dom'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import LoadingIndicator from './LoadingIndicator'
import RadianPage from '../pages/RadianPage'

export default function RadianRoute() {
  const { isCheckingSetup, isJarvisCompany, isJarvisCompanyConfigured, setupPath } = useIntegrationSetup()
  if (isCheckingSetup) return <LoadingIndicator message="Cargando..." />
  if (!isJarvisCompany || !isJarvisCompanyConfigured) return <Navigate to={setupPath} replace />
  return <RadianPage />
}
