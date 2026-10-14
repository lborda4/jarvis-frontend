import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingIndicator from './LoadingIndicator'
import '../pages/AuthPages.css'

/** El catálogo de la empresa activa es compartido por clientes y administradores. */
function ClientProductsRoute() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Cargando..." />
      </div>
    )
  }

  return <Outlet />
}

export default ClientProductsRoute
