import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './JarvisPdfViewer.css'

GlobalWorkerOptions.workerSrc = workerUrl

export default function JarvisPdfViewer({ url }: { url: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState<number | 'page' | 'width'>('page')
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [error, setError] = useState('')
  const [rendered, setRendered] = useState('')
  const [scaleLabel, setScaleLabel] = useState('')
  const [attempt, setAttempt] = useState(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const renderKey = `${page}:${zoom}:${size.width}:${size.height}:${attempt}`

  useEffect(() => {
    const task = getDocument({ url, useSystemFonts: true, isEvalSupported: false })
    let active = true
    task.promise.then(document => { if (active) { setPdf(document); setError('') } })
      .catch(() => { if (active) setError('No pudimos abrir el PDF. Puedes reintentar o descargarlo.') })
    return () => { active = false; void task.destroy() }
  }, [url, attempt])

  useEffect(() => {
    const container = viewportRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!pdf || !size.width || !size.height) return
    let active = true
    let task: RenderTask | undefined
    let textLayer: TextLayer | undefined
    async function render() {
      try {
        const documentPage = await pdf!.getPage(page)
        if (!active) return
        const original = documentPage.getViewport({ scale: 1 })
        const widthScale = Math.max(100, size.width - 32) / original.width
        const scale = zoom === 'page' ? Math.min(widthScale, Math.max(100, size.height - 32) / original.height)
          : zoom === 'width' ? widthScale : zoom
        const viewport = documentPage.getViewport({ scale })
        const density = Math.min(window.devicePixelRatio || 1, 2)
        // Each render owns its canvas, so rapid zoom/page changes cannot reuse a busy canvas.
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width * density)
        canvas.height = Math.ceil(viewport.height * density)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        canvas.setAttribute('aria-hidden', 'true')
        task = documentPage.render({ canvas, viewport, transform: [density, 0, 0, density, 0, 0] })
        await task.promise
        if (!active) return
        const text = document.createElement('div')
        text.className = 'jarvis-pdf__text'
        text.style.setProperty('--scale-factor', String(scale))
        text.style.setProperty('--total-scale-factor', String(scale))
        const textContent = await documentPage.getTextContent()
        if (!active) return
        textLayer = new TextLayer({ textContentSource: textContent, container: text, viewport })
        await textLayer.render()
        if (!active || !paperRef.current) return
        paperRef.current.replaceChildren(canvas, text)
        setRendered(renderKey)
        setScaleLabel(`${Math.round(scale * 100)}%`)
        setError('')
        viewportRef.current?.scrollTo({ top: 0, left: 0 })
      } catch (failure) {
        if (active && !(failure instanceof Error && failure.name === 'RenderingCancelledException')) setError('No pudimos mostrar esta página. Puedes reintentar o descargar el PDF.')
      }
    }
    void render()
    return () => { active = false; task?.cancel(); textLayer?.cancel() }
  }, [pdf, page, zoom, size, renderKey])

  const changeZoom = (delta: number) => {
    const current = typeof zoom === 'number' ? zoom : (parseInt(scaleLabel) || 100) / 100
    setZoom(Math.max(.25, Math.min(2.5, Math.round((current + delta) * 100) / 100)))
  }
  return <div className="jarvis-pdf">
    <div className="jarvis-pdf__toolbar" aria-label="Controles del documento">
      <div className="jarvis-pdf__pages">
        {pdf && pdf.numPages > 1 && <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>‹</button>}
        <span aria-live="polite">{pdf ? `Página ${page} de ${pdf.numPages}` : 'Cargando documento…'}</span>
        {pdf && pdf.numPages > 1 && <button type="button" aria-label="Página siguiente" disabled={page >= pdf.numPages} onClick={() => setPage(value => value + 1)}>›</button>}
      </div>
      <div className="jarvis-pdf__zoom">
        <button type="button" aria-label="Alejar" disabled={!pdf || zoom === .25} onClick={() => changeZoom(-.15)}>−</button>
        <span>{scaleLabel || '—'}</span>
        <button type="button" aria-label="Acercar" disabled={!pdf || zoom === 2.5} onClick={() => changeZoom(.15)}>+</button>
        <button type="button" className="jarvis-pdf__fit" aria-pressed={zoom === 'page'} disabled={!pdf} onClick={() => setZoom('page')}>Página completa</button>
        <button type="button" className="jarvis-pdf__fit" aria-pressed={zoom === 'width'} disabled={!pdf} onClick={() => setZoom('width')}>Ajustar ancho</button>
      </div>
    </div>
    <div ref={viewportRef} className="jarvis-pdf__viewport" tabIndex={0} aria-label="Contenido de la factura" aria-busy={!error && rendered !== renderKey}>
      {error ? <div className="jarvis-pdf__message" role="alert"><p>{error}</p><button type="button" onClick={() => { setError(''); setPdf(null); setRendered(''); setAttempt(value => value + 1) }}>Reintentar</button></div>
        : <>{rendered !== renderKey && <div className="jarvis-pdf__message" role="status">Preparando página…</div>}<div className="jarvis-pdf__paper" ref={paperRef} style={{ display: rendered === renderKey ? undefined : 'none' }} /></>}
    </div>
  </div>
}
