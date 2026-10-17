import { Navigate, Outlet } from 'react-router-dom'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import LoadingIndicator from './LoadingIndicator'

export default function JarvisCreditNoteRoute() {
  const { isCheckingSetup, isJarvisCompany, setupPath } = useIntegrationSetup()

  if (isCheckingSetup) {
    return <LoadingIndicator message="Cargando..." />
  }

  if (!isJarvisCompany) {
    return <Navigate to={setupPath} replace />
  }

  return <Outlet />
}
