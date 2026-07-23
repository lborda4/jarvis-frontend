import { Navigate } from 'react-router-dom'
import { isAdminRole } from '../constants/userRole'
import LoadingIndicator from './LoadingIndicator'
import { useAuth } from '../context/AuthContext'
import AdminPage from '../pages/AdminPage'
import '../pages/AuthPages.css'

function AdminRoute() {
  const { user, isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Validando acceso..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: '/admin' }} />
  }

  if (!isAdminRole(user?.role)) {
    return <Navigate to="/inicio" replace />
  }

  return <AdminPage />
}

export default AdminRoute
