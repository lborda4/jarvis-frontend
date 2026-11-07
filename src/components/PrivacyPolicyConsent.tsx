import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { IntegrationPolicy } from '../constants/integrationPolicies'
import IntegrationPolicyModal from './IntegrationPolicyModal'

interface PrivacyPolicyConsentProps {
  policy: IntegrationPolicy
  acceptedPolicy?: IntegrationPolicy
  onAccepted: (policy: IntegrationPolicy) => void
  disabled?: boolean
}

export default function PrivacyPolicyConsent({ policy, acceptedPolicy, onAccepted, disabled = false }: PrivacyPolicyConsentProps) {
  const [openPolicy, setOpenPolicy] = useState<IntegrationPolicy | null>(null)
  function open() {
    if (!disabled) setOpenPolicy(acceptedPolicy ?? policy)
  }
  const readingOnly = acceptedPolicy?.id === openPolicy?.id
  return <div className="auth-privacy">
    <p className="auth-privacy__copy">Para crear la cuenta debes leer la política de tratamiento de datos y los términos del servicio de tu empresa.</p>
    <button type="button" className={`auth-privacy__accept${acceptedPolicy ? ' auth-privacy__accept--done' : ''}`} disabled={disabled} onClick={open} aria-haspopup="dialog">
      {acceptedPolicy ? 'Política aceptada · Consultar' : 'Leer política y aceptar'}
    </button>
    {acceptedPolicy && <p className="auth-privacy__hint" role="status">Tu aceptación ya está guardada. Puedes volver a consultar el documento.</p>}
    {openPolicy && createPortal(<IntegrationPolicyModal key={openPolicy.id} policy={openPolicy}
      {...(readingOnly ? { onClose: () => setOpenPolicy(null) } : {
        onCancel: () => setOpenPolicy(null),
        onAccept: () => { onAccepted(openPolicy); setOpenPolicy(null) },
      })}
    />, document.body)}
  </div>
}
