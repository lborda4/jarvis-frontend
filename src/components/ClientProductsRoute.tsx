import { Navigate, Outlet } from 'react-router-dom'
import { isAdminRole } from '../constants/userRole'
import { useAuth } from '../context/AuthContext'
import LoadingIndicator from './LoadingIndicator'
import '../pages/AuthPages.css'

/** Rutas de Productos: menú y páginas del cliente, no del administrador. */
function ClientProductsRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Cargando..." />
      </div>
    )
  }

  if (isAdminRole(user?.role)) {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}

export default ClientProductsRoute
