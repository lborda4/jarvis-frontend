import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiClient, getApiErrorMessage } from '../services/apiClient'
import Button from './Button'
import './CompanyLogoSettings.css'

export default function CompanyLogoSettings() {
  const { user } = useAuth()
  return user?.company?.id ? <LogoEditor key={user.company.id} /> : null
}

function LogoEditor() {
  const [logo, setLogo] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const endpoint = '/integrations/JARVIS/logo'
  useEffect(() => {
    const controller = new AbortController()
    apiClient.get<{ logoDataUrl: string | null }>(endpoint, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) { setLogo(data.logoDataUrl); setLoaded(true) } })
      .catch(err => { if (!controller.signal.aborted) setError(getApiErrorMessage(err, 'No se pudo cargar el logo.')) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [])

  async function save(file: File | null) {
    if (busy || !loaded) return
    setError(''); setSuccess('')
    if (file && file.size > 500 * 1024) { setError('El logo no puede superar 500 KB.'); return }
    if (file && !['image/png', 'image/jpeg'].includes(file.type)) { setError('Selecciona una imagen PNG o JPG.'); return }
    setBusy(true)
    try {
      if (file) {
        const bitmap = await createImageBitmap(file)
        const valid = bitmap.width <= 4096 && bitmap.height <= 4096 && bitmap.width * bitmap.height <= 4000000
        bitmap.close()
        if (!valid) throw new Error('El logo debe tener máximo 4096 píxeles por lado y 4 megapíxeles.')
        const body = new FormData(); body.append('file', file)
        const { data } = await apiClient.put<{ logoDataUrl: string }>(endpoint, body)
        setLogo(data.logoDataUrl)
      } else {
        await apiClient.delete(endpoint); setLogo(null)
      }
      setSuccess(file ? 'Logo guardado.' : 'Logo eliminado.')
    } catch (err) { setError(getApiErrorMessage(err, 'No se pudo guardar el logo. Verifica que la imagen sea válida.')) }
    finally { setBusy(false) }
  }

  return <section className="settings-card company-logo" aria-busy={busy} aria-labelledby="company-logo-title">
    <div className="company-logo__heading">
      <span className="company-logo__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></svg></span>
      <div><h2 id="company-logo-title">Logo de la empresa</h2><p>Dale tu identidad a las facturas de venta que generas en Jarvis.</p></div>
    </div>
    <div className="company-logo__layout">
      <div className="company-logo__preview">
        <div className="company-logo__image">{logo ? <img src={logo} alt="Logo actual de la empresa" /> : <span className="company-logo__placeholder" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M2 21h20M9 21v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1" strokeLinecap="round" /></svg></span>}</div>
        <span>{logo ? 'Tu logo actual' : 'Tu logo aparecerá aquí'}</span>
      </div>
      <div className={`company-logo__dropzone${dragging ? ' company-logo__dropzone--active' : ''}`} onDragEnter={event => {
        event.preventDefault(); dragDepth.current += 1; if (!busy && loaded) setDragging(true)
      }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = busy || !loaded ? 'none' : 'copy' }} onDragLeave={event => {
        event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false)
      }} onDrop={event => {
        event.preventDefault(); dragDepth.current = 0; setDragging(false)
        if (busy || !loaded) return
        if (event.dataTransfer.files.length > 1) { setSuccess(''); setError('Selecciona solo una imagen para el logo.'); return }
        const file = event.dataTransfer.files[0]; if (file) void save(file)
      }}>
        <svg className="company-logo__upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <strong>{dragging ? 'Suelta tu imagen aquí' : 'Arrastra aquí el logo de tu empresa'}</strong>
        <p id="company-logo-requirements">PNG o JPG · Hasta 500 KB y 4 megapíxeles</p>
        <div className="company-logo__actions">
          <Button disabled={busy || !loaded} onClick={() => inputRef.current?.click()} aria-describedby="company-logo-requirements">{busy ? (loaded ? 'Guardando…' : 'Cargando…') : logo ? 'Cambiar logo' : 'Seleccionar imagen'}</Button>
          {logo && <Button variant="ghost" disabled={busy} onClick={() => void save(null)}>Quitar logo</Button>}
        </div>
        <small>Se guarda automáticamente y aparecerá en el PDF de tus facturas.</small>
      </div>
    </div>
    <input ref={inputRef} hidden aria-label="Subir logo de la empresa" type="file" accept="image/png,image/jpeg" disabled={busy || !loaded} onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (file) void save(file)
    }} />
    {busy && <p className="company-logo__status" role="status">{loaded ? 'Actualizando tu logo…' : 'Cargando tu logo…'}</p>}
    {error && <p className="company-logo__status company-logo__status--error" role="alert">{error}</p>}
    {success && <p className="company-logo__status company-logo__status--success" role="status">{success}</p>}
  </section>
}
