import { Navigate } from 'react-router-dom'
import LoadingIndicator from './LoadingIndicator'
import { useSiigoSetup } from '../context/SiigoSetupContext'
import '../pages/AuthPages.css'

function DefaultAppRedirect() {
  const { isCheckingSiigoSetup, isSupportDocumentEnabled } = useSiigoSetup()

  if (isCheckingSiigoSetup) {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Cargando..." />
      </div>
    )
  }

  if (isSupportDocumentEnabled) {
    return <Navigate to="/documento-soporte" replace />
  }

  return <Navigate to="/configuracion/integracion-siigo" replace />
}

export default DefaultAppRedirect
