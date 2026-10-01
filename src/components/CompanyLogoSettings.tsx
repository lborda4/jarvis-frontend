import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiClient, getApiErrorMessage } from '../services/apiClient'

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

  return <section className="settings-card" aria-busy={busy}>
    <h2>Logo de la empresa</h2>
    <p>Aparecerá en el PDF de las facturas de venta generado en Jarvis. PNG o JPG, máximo 500 KB y 4 megapíxeles.</p>
    {logo && <img src={logo} alt="Logo actual de la empresa" style={{ display: 'block', maxWidth: 240, maxHeight: 120, objectFit: 'contain', marginBottom: 16 }} />}
    <label>Subir o reemplazar logo <input aria-label="Subir logo de la empresa" type="file" accept="image/png,image/jpeg" disabled={busy || !loaded} onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (file) void save(file)
    }} /></label>
    {logo && <button type="button" disabled={busy} onClick={() => void save(null)}>Quitar logo</button>}
    {busy && <p role="status">Procesando logo…</p>}
    {error && <p role="alert">{error}</p>}
    {success && <p role="status">{success}</p>}
  </section>
}
