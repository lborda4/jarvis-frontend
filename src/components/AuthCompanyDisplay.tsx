import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

interface AuthCompanyDisplayProps {
  label?: string
}

function AuthCompanyDisplay({ label = 'Empresa' }: AuthCompanyDisplayProps) {
  const { user, isLoading } = useAuth()

  useEffect(() => {
    console.log('[Auth] Estado de empresa en UI:', {
      isLoading,
      user,
      company: user?.company ?? null,
    })
  }, [isLoading, user])

  if (isLoading) {
    return (
      <div className="settings-company-field">
        <span className="settings-company-field__label">{label}</span>
        <span className="settings-company-field__value">Cargando empresa...</span>
      </div>
    )
  }

  if (!user?.company) {
    return (
      <div className="settings-company-field">
        <span className="settings-company-field__label">{label}</span>
        <span className="settings-company-field__value settings-company-field__value--muted">
          Empresa no disponible.
        </span>
      </div>
    )
  }

  return (
    <div className="settings-company-field">
      <span className="settings-company-field__label">{label}</span>
      <span className="settings-company-field__value">
        {user.company.name} ({user.company.nit})
      </span>
    </div>
  )
}

export default AuthCompanyDisplay
