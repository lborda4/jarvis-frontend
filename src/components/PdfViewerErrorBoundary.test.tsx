import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PdfViewerErrorBoundary from './PdfViewerErrorBoundary'
import { WHATSAPP_SUPPORT_HREF } from '../constants/contact'

describe('recuperación del visor PDF', () => {
  it('conserva el visor cuando no hay error', () => {
    const boundary = new PdfViewerErrorBoundary({ children: <p>Contenido del PDF</p> })
    expect(renderToStaticMarkup(boundary.render())).toContain('Contenido del PDF')
  })

  it('muestra ayuda y reintento cuando falla la carga del módulo o el renderizado', () => {
    const boundary = new PdfViewerErrorBoundary({ children: <p>Contenido del PDF</p> })
    boundary.state = PdfViewerErrorBoundary.getDerivedStateFromError()
    const html = renderToStaticMarkup(boundary.render())
    expect(html).toContain('role="alert"')
    expect(html).toContain('No pudimos visualizar el PDF')
    expect(html).toContain('más tarde')
    expect(html).toContain('Contactar a soporte')
    expect(html).toContain(WHATSAPP_SUPPORT_HREF)
    expect(html).not.toContain('Contenido del PDF')
  })

  it('recarga la página para recuperar módulos antiguos tras una actualización', () => {
    const reload = vi.fn()
    vi.stubGlobal('window', { location: { reload } })
    try {
      const boundary = new PdfViewerErrorBoundary({ children: null })
      boundary.state = PdfViewerErrorBoundary.getDerivedStateFromError()
      const fallback = boundary.render()
      if (!fallback || typeof fallback !== 'object' || !('props' in fallback)) throw new Error('No se mostró el error del visor')
      ;(fallback.props as { onRetry: () => void }).onRetry()
      expect(reload).toHaveBeenCalledOnce()
    } finally { vi.unstubAllGlobals() }
  })
})
