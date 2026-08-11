import { CheckIcon, CloseIcon } from '../icons/SidebarIcons'
import type { SupportDocumentImportNotice } from '../../types/supportDocumentPage'

interface ImportSuccessBannerProps {
  notice: SupportDocumentImportNotice
  showImportOnly: boolean
  onShowImportOnly: () => void
  onShowAll: () => void
  onDismiss: () => void
}

function ImportSuccessBanner({
  notice,
  showImportOnly,
  onShowImportOnly,
  onShowAll,
  onDismiss,
}: ImportSuccessBannerProps) {
  return (
    <div className="support-import-banner" role="status">
      <div className="support-import-banner__content">
        <span className="support-import-banner__icon" aria-hidden="true">
          <CheckIcon />
        </span>
        <p className="support-import-banner__title">
          Se importaron {notice.documentCount} documentos correctamente
        </p>
      </div>

      <div className="support-import-banner__actions">
        <button
          type="button"
          className={`support-import-banner__filter${
            showImportOnly ? ' support-import-banner__filter--active' : ''
          }`}
          onClick={onShowImportOnly}
        >
          Mostrar solo esta importación
        </button>
        <button
          type="button"
          className={`support-import-banner__link${
            !showImportOnly ? ' support-import-banner__link--active' : ''
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

export default ImportSuccessBanner
