import { Navigate } from 'react-router-dom'
import LoadingIndicator from '../components/LoadingIndicator'
import { useAuth } from '../context/AuthContext'
import type { MarketingProduct } from '../marketing/catalog'
import LandingContent from './LandingContent'

export default function LandingPage({ product }: { product?: MarketingProduct }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <div className="landing-loading"><LoadingIndicator message="Cargando..." /></div>
  if (isAuthenticated) return <Navigate to="/documento-soporte" replace />
  return <LandingContent product={product} />
}
