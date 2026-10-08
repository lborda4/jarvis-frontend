import { useState } from 'react'
import { PRIVACY_POLICY_URL } from '../constants/privacyPolicy'

interface PrivacyPolicyConsentProps {
  accepted: boolean
  onAccepted: () => void
  disabled?: boolean
}

function PrivacyPolicyConsent({
  accepted,
  onAccepted,
  disabled = false,
}: PrivacyPolicyConsentProps) {
  const [hasOpenedPolicy, setHasOpenedPolicy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const markPolicyOpened = () => {
    setHasOpenedPolicy(true)
    setHint(null)
  }

  const handleAccept = () => {
    if (!hasOpenedPolicy) {
      setHint('Abre y lee la política de tratamiento de datos antes de aceptarla.')
      return
    }

    onAccepted()
  }

  return (
    <div className="auth-privacy">
      <p className="auth-privacy__copy">
        Para crear la cuenta debes leer la{' '}
        <a
          href={PRIVACY_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={markPolicyOpened}
        >
          política de tratamiento de datos personales
        </a>
        .
      </p>

      <button
        type="button"
        className={`auth-privacy__accept${accepted ? ' auth-privacy__accept--done' : ''}`}
        onClick={handleAccept}
        disabled={disabled || accepted || !hasOpenedPolicy}
        aria-pressed={accepted}
      >
        {accepted ? 'Política aceptada' : 'He leído y acepto'}
      </button>

      {!accepted && !hasOpenedPolicy ? (
        <p className="auth-privacy__hint">
          Ábrela en una pestaña nueva para habilitar la aceptación.
        </p>
      ) : null}

      {hint ? <p className="auth-privacy__hint">{hint}</p> : null}
    </div>
  )
}

export default PrivacyPolicyConsent
