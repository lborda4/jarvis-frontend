import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoiceNoteBlockReason } from '../services/invoiceNoteEligibility'
import DocumentNotice from './DocumentNotice'

export default function InvoiceNoteAction({ invoiceId, kind, className, children }: {
  invoiceId: string
  kind: 'debit' | 'credit'
  className?: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  const checkingRef = useRef(false)
  const [checking, setChecking] = useState(false)
  const [notice, setNotice] = useState('')

  const openNote = async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    setChecking(true)
    setNotice('')
    try {
      const reason = await invoiceNoteBlockReason(invoiceId)
      if (reason) setNotice(reason)
      else navigate(`/nota-${kind === 'debit' ? 'debito' : 'credito'}/nueva?factura=${encodeURIComponent(invoiceId)}`)
    } catch {
      setNotice('No se pudo verificar la aceptación en RADIAN de esta factura. Intenta nuevamente antes de crear la nota.')
    } finally {
      checkingRef.current = false
      setChecking(false)
    }
  }

  return <>
    <button type="button" className={className} disabled={checking} aria-busy={checking} onClick={() => void openNote()}>
      {children}{checking && <small role="status">Verificando RADIAN…</small>}
    </button>
    {notice && <DocumentNotice variant="error" title="No se puede crear la nota" message={notice} onDismiss={() => setNotice('')} />}
  </>
}
