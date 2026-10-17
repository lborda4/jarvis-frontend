import { useRef, useState } from 'react'

export default function DocumentCodeCopy({ value, label }: { value: string; label: string }) {
  const code = value.replace(/\s+/g, '')
  const input = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle')
  const [copying, setCopying] = useState(false)
  if (!code) return null

  async function copy() {
    setCopying(true)
    try {
      await navigator.clipboard.writeText(code)
      setStatus('copied')
    } catch {
      input.current?.focus()
      input.current?.select()
      setStatus('manual')
    } finally { setCopying(false) }
  }
  return <div className="invoice-pdf__code">
    <label><span>{label}</span><input ref={input} aria-label={`${label} completo`} readOnly value={code} onFocus={event => event.currentTarget.select()} spellCheck={false} /></label>
    <button type="button" className="invoice-pdf__action" disabled={copying} onClick={() => void copy()}>{status === 'copied' ? 'Copiado' : `Copiar ${label}`}</button>
    <span className="invoice-pdf__copy-status" role="status">{status === 'copied' ? `${label} copiado completo.` : status === 'manual' ? 'Código seleccionado. Usa Ctrl+C o la opción Copiar de tu dispositivo.' : ''}</span>
  </div>
}
