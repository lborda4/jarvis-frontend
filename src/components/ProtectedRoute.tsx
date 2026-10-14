import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingIndicator from './LoadingIndicator'
import IntegrationPolicyGate from './IntegrationPolicyGate'
import { useAuth } from '../context/AuthContext'
import '../pages/AuthPages.css'

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Validando sesión..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <IntegrationPolicyGate><Outlet /></IntegrationPolicyGate>
}

export default ProtectedRoute
