import { Navigate } from 'react-router-dom'
import LoadingIndicator from './LoadingIndicator'
import { useSiigoSetup } from '../context/SiigoSetupContext'
import { getAuthEntryMode } from '../utils/siigoSetupStorage'
import '../pages/AuthPages.css'

function DefaultAppRedirect() {
  const { isCheckingSiigoSetup, requiresSiigoSetup } = useSiigoSetup()

  if (isCheckingSiigoSetup) {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Cargando..." />
      </div>
    )
  }

  if (getAuthEntryMode() === 'register' && requiresSiigoSetup) {
    return <Navigate to="/configuracion/integracion-siigo" replace />
  }

  return <Navigate to="/documento-soporte" replace />
}

export default DefaultAppRedirect
