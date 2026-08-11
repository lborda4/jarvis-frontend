import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import './SupportDocumentStart.css'

function getFirstName(fullName: string | undefined): string {
  const first = fullName?.trim().split(/\s+/)[0]
  return first || 'de nuevo'
}

function CreateDocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" strokeLinejoin="round" />
      <path d="M12 11v6M9 14h6" strokeLinecap="round" />
    </svg>
  )
}

function BulkUploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M9 4v16" />
      <path d="M13 9.5l4 5M17 9.5l-4 5" strokeLinecap="round" />
    </svg>
  )
}

function SupportDocumentStart() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <section className="ds-start">
      <header className="ds-start__header">
        <p className="ds-start__greeting">¡Hola {getFirstName(user?.name)}!</p>
        <h1 className="ds-start__title">¿Qué quieres hacer hoy?</h1>
        <p className="ds-start__subtitle">
          Elige la opción que mejor se adapte a lo que necesitas.
        </p>
      </header>

      <div className="ds-start__options">
        <article className="ds-start__card">
          <span className="ds-start__icon ds-start__icon--create">
            <CreateDocumentIcon />
          </span>
          <h2 className="ds-start__card-title">Crear uno a uno</h2>
          <p className="ds-start__card-text">
            Crea un documento soporte ingresando la información paso a paso.
          </p>
          <Button
            variant="primary"
            className="ds-start__action"
            onClick={() => navigate('/documento-soporte/nuevo')}
          >
            Crear documento
          </Button>
        </article>

        <article className="ds-start__card">
          <span className="ds-start__icon ds-start__icon--bulk">
            <BulkUploadIcon />
          </span>
          <h2 className="ds-start__card-title">Cargar masivo</h2>
          <p className="ds-start__card-text">
            Sube un archivo Excel y deja que JARVIS haga el resto.
          </p>
          <Button
            variant="primary"
            className="ds-start__action"
            onClick={() => navigate('/documento-soporte/masivo')}
          >
            Cargar archivo
          </Button>
        </article>
      </div>

      <p className="ds-start__tip">
        <strong>Consejo:</strong> usa “Crear uno a uno” para un documento puntual
        o la carga masiva con Excel cuando tengas varios.
      </p>
    </section>
  )
}

export default SupportDocumentStart
