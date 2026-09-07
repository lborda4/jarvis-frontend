import { AlertIcon, CheckIcon, CloseIcon } from '../icons/SidebarIcons'
import type { SupportDocumentSendNotice } from '../../types/supportDocumentPage'

interface SendSuccessBannerProps {
  notice: SupportDocumentSendNotice
  showSendOnly: boolean
  onShowSendOnly: () => void
  onShowAll: () => void
  onDismiss: () => void
}

/** Aviso tras enviar un lote a SIIGO — mismo patrón que ImportSuccessBanner
 * (mismas clases, mismo mecanismo "solo esta tanda"/"ver todos"), pero con
 * el desglose de éxito/error del envío en vez de solo el total importado.
 * Cambia a tono de advertencia si algo quedó en error, en vez del verde fijo
 * del de importación (ahí un "error" es una fila que ni se intentó, se
 * reporta aparte). */
function SendSuccessBanner({
  notice,
  showSendOnly,
  onShowSendOnly,
  onShowAll,
  onDismiss,
}: SendSuccessBannerProps) {
  const total = notice.documentIds.length
  const hasErrors = notice.errorCount > 0

  return (
    <div
      className={`support-import-banner${hasErrors ? ' support-import-banner--warning' : ''}`}
      role="status"
    >
      <div className="support-import-banner__content">
        <span className="support-import-banner__icon" aria-hidden="true">
          {hasErrors ? <AlertIcon /> : <CheckIcon />}
        </span>
        <div>
          <p className="support-import-banner__title">
            Se enviaron a crear {total} factura{total === 1 ? '' : 's'}
          </p>
          <p className="support-import-banner__meta">
            {notice.successCount} creada{notice.successCount === 1 ? '' : 's'}
            {hasErrors
              ? `, ${notice.errorCount} con error`
              : ''}
          </p>
        </div>
      </div>

      <div className="support-import-banner__actions">
        <button
          type="button"
          className={`support-import-banner__filter${
            showSendOnly ? ' support-import-banner__filter--active' : ''
          }`}
          onClick={onShowSendOnly}
        >
          Mostrar solo este envío
        </button>
        <button
          type="button"
          className={`support-import-banner__link${
            !showSendOnly ? ' support-import-banner__link--active' : ''
          }`}
          onClick={onShowAll}
        >
          Ver todos
        </button>
        <button
          type="button"
          className="support-import-banner__close"
          aria-label="Cerrar aviso"
          onClick={onDismiss}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}

export default SendSuccessBanner
