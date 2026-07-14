import { Navigate } from 'react-router-dom'
import LoadingIndicator from './LoadingIndicator'
import { useSiigoSetup } from '../context/SiigoSetupContext'
import SupportDocumentPage from '../pages/SupportDocumentPage'
import '../pages/AuthPages.css'

function SupportDocumentRoute() {
  const { isCheckingSiigoSetup, isSupportDocumentEnabled } = useSiigoSetup()

  if (isCheckingSiigoSetup) {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Verificando configuración de SIIGO..." />
      </div>
    )
  }

  if (!isSupportDocumentEnabled) {
    return (
      <Navigate
        to="/configuracion/integracion-siigo"
        replace
        state={{ siigoSetupRequired: true }}
      />
    )
  }

  return <SupportDocumentPage />
}

export default SupportDocumentRoute
