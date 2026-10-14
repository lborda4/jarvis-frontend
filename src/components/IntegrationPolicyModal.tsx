import { useRef, useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import type { IntegrationPolicy } from '../constants/integrationPolicies'
import './IntegrationPolicyModal.css'

export default function IntegrationPolicyModal({ policy, onAccept, onLogout, onClose, accepting = false }: {
  policy: IntegrationPolicy; onAccept?: () => void; onLogout?: () => void; onClose?: () => void; accepting?: boolean
}) {
  const content = useRef<HTMLDivElement>(null)
  const [readToEnd, setReadToEnd] = useState(false)
  function scrollToEnd() {
    const element = content.current
    if (!element) return
    if (element.scrollHeight <= element.clientHeight) setReadToEnd(true)
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
  }

  const readingOnly = Boolean(onClose)
  return <Modal isOpen onClose={onClose ?? onLogout ?? (() => undefined)} dismissible={readingOnly} labelledBy="integration-policy-title" size="lg" className={`integration-policy${readingOnly ? ' integration-policy--reading' : ''}`}>
    <header className="integration-policy__header">
      <span>Integración {policy.integrationLabel} · Versión {policy.version}</span>
      <h2 id="integration-policy-title">{policy.title}</h2>
      <p>{readingOnly ? `Consulta la política aplicable a tu integración ${policy.integrationLabel}.` : 'Lee el documento antes de aceptar y continuar.'}</p>
    </header>
    <div className="integration-policy__reader">
    <div ref={content} className="integration-policy__text" tabIndex={0} role="region" aria-label="Texto de los términos y condiciones" onScroll={event => {
      const element = event.currentTarget
      if (element.scrollHeight - element.scrollTop - element.clientHeight <= 8) setReadToEnd(true)
    }}>
      {policy.text.split(/\r?\n/).filter(line => line.trim()).map((line, index) => /^ARTÍCULO\s+\d+\./.test(line)
        ? <h3 key={index}>{line}</h3>
        : <p key={index}>{line}</p>)}
    </div>
      <button type="button" className="integration-policy__scroll-down" onClick={scrollToEnd} aria-label="Desplazarse hasta el final del documento" title="Desplazarse hasta el final">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 4v16m-7-7 7 7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
    <footer className="integration-policy__footer">
      {!readingOnly && <p aria-live="polite">{readToEnd ? 'Ya puedes confirmar tu aceptación.' : 'Desplázate hasta el final para habilitar la aceptación.'}</p>}
      <div className="integration-policy__buttons">
        {!readingOnly && <Button type="button" variant="ghost" onClick={onLogout}>Cerrar sesión</Button>}
        {readingOnly ? <Button type="button" onClick={onClose}>Cerrar</Button> : <Button type="button" disabled={!readToEnd || accepting} onClick={() => { if (readToEnd && !accepting) onAccept?.() }}>{accepting ? 'Guardando...' : 'He leído y acepto'}</Button>}
      </div>
    </footer>
  </Modal>
}
