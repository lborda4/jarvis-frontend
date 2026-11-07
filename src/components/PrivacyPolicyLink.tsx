import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getIntegrationPolicy } from '../constants/integrationPolicies'
import { PRIVACY_POLICY_URL } from '../constants/privacyPolicy'
import IntegrationPolicyModal from './IntegrationPolicyModal'

export default function PrivacyPolicyLink({ children = 'Política de tratamiento de datos', mode = 'jarvis', className }: {
  children?: ReactNode
  mode?: 'jarvis' | 'siigo'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const policy = getIntegrationPolicy(mode)!
  return <>
    <a className={className} href={`${PRIVACY_POLICY_URL}${mode === 'siigo' ? '?integracion=siigo' : ''}`} aria-haspopup="dialog" onClick={event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      setOpen(true)
    }}>{children}</a>
    {open && createPortal(<IntegrationPolicyModal policy={policy} onClose={() => setOpen(false)} />, document.body)}
  </>
}
