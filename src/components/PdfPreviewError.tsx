import Button from './Button'
import { WHATSAPP_SUPPORT_HREF } from '../constants/contact'
import './PdfPreviewError.css'

export default function PdfPreviewError({ onRetry }: { onRetry: () => void }) {
  return <div className="pdf-preview-error" role="alert">
    <h2>No pudimos visualizar el PDF</h2>
    <p>Inténtalo de nuevo más tarde. Si el problema continúa, comunícate con soporte.</p>
    <p>El documento sigue emitido. No es necesario volver a enviarlo a la DIAN.</p>
    <div className="pdf-preview-error__actions">
      <Button type="button" onClick={onRetry}>Reintentar</Button>
      <a href={WHATSAPP_SUPPORT_HREF} target="_blank" rel="noopener noreferrer">Contactar a soporte</a>
    </div>
  </div>
}
