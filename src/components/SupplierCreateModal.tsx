import type { CreatedSiigoSupplier } from '../types/siigo'
import type { SupplierModalView } from '../hooks/useSupplierCreateModal'
import {
  formatSiigoDisplayValue,
  formatSiigoDocumentType,
} from '../utils/formatSiigoSupplier'

interface SupplierCreateModalProps {
  isOpen: boolean
  view: SupplierModalView
  supplierName: string | null
  supplierDocument: string
  errorMessage: string | null
  createdSupplier: CreatedSiigoSupplier | null
  onCancel: () => void
  onCreateSupplier: () => void
  onContinue: () => void
  onRetry: () => void
}

function SupplierCreateModal({
  isOpen,
  view,
  supplierName,
  supplierDocument,
  errorMessage,
  createdSupplier,
  onCancel,
  onCreateSupplier,
  onContinue,
  onRetry,
}: SupplierCreateModalProps) {
  if (!isOpen) return null

  const isLoading = view === 'loading'
  const buttonsDisabled = isLoading
  const canDismissOverlay = view === 'confirm' || view === 'error'

  const handleOverlayClick = () => {
    if (canDismissOverlay) {
      onCancel()
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={handleOverlayClick}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        {view === 'confirm' && (
          <>
            <h2 id="supplier-modal-title" className="modal-dialog__title">
              Proveedor no encontrado
            </h2>
            <div className="modal-dialog__content">
              <p>El proveedor no existe en Siigo.</p>
              <p>¿Desea crearlo utilizando la información de la factura electrónica?</p>
              {(supplierName || supplierDocument) && (
                <div className="modal-dialog__summary">
                  {supplierName && (
                    <p>
                      <strong>Razón social:</strong> {supplierName}
                    </p>
                  )}
                  {supplierDocument && (
                    <p>
                      <strong>Documento:</strong> {supplierDocument}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="modal-dialog__actions">
              <button
                type="button"
                className="modal-dialog__button modal-dialog__button--secondary"
                onClick={onCancel}
                disabled={buttonsDisabled}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="modal-dialog__button modal-dialog__button--primary"
                onClick={onCreateSupplier}
                disabled={buttonsDisabled}
              >
                Crear proveedor
              </button>
            </div>
          </>
        )}

        {view === 'loading' && (
          <>
            <h2 id="supplier-modal-title" className="modal-dialog__title">
              Creando proveedor
            </h2>
            <div className="modal-dialog__content modal-dialog__content--center">
              <span className="loading-indicator__spinner" aria-hidden="true" />
              <p>Creando proveedor en SIIGO...</p>
            </div>
            <div className="modal-dialog__actions">
              <button
                type="button"
                className="modal-dialog__button modal-dialog__button--secondary"
                disabled
              >
                Cancelar
              </button>
              <button
                type="button"
                className="modal-dialog__button modal-dialog__button--primary"
                disabled
              >
                Crear proveedor
              </button>
            </div>
          </>
        )}

        {view === 'success' && createdSupplier && (
          <>
            <h2 id="supplier-modal-title" className="modal-dialog__title">
              Proveedor creado
            </h2>
            <div className="modal-dialog__content">
              <p className="modal-dialog__success-message">
                El proveedor fue creado exitosamente en SIIGO.
              </p>
              <dl className="supplier-details">
                <div className="supplier-details__row">
                  <dt>Razón social</dt>
                  <dd>{formatSiigoDisplayValue(createdSupplier.name) || '—'}</dd>
                </div>
                <div className="supplier-details__row">
                  <dt>Tipo y número de documento</dt>
                  <dd>
                    {[formatSiigoDocumentType(createdSupplier.documentType), createdSupplier.documentNumber]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </dd>
                </div>
                <div className="supplier-details__row">
                  <dt>Correo electrónico</dt>
                  <dd>{formatSiigoDisplayValue(createdSupplier.email) || '—'}</dd>
                </div>
                <div className="supplier-details__row">
                  <dt>Teléfono</dt>
                  <dd>{formatSiigoDisplayValue(createdSupplier.phone) || '—'}</dd>
                </div>
                <div className="supplier-details__row">
                  <dt>Dirección</dt>
                  <dd>{formatSiigoDisplayValue(createdSupplier.address) || '—'}</dd>
                </div>
                <div className="supplier-details__row">
                  <dt>Identificador SIIGO</dt>
                  <dd>{formatSiigoDisplayValue(createdSupplier.id) || '—'}</dd>
                </div>
              </dl>
            </div>
            <div className="modal-dialog__actions">
              <button
                type="button"
                className="modal-dialog__button modal-dialog__button--primary"
                onClick={onContinue}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {view === 'error' && (
          <>
            <h2 id="supplier-modal-title" className="modal-dialog__title">
              Error al crear proveedor
            </h2>
            <div className="modal-dialog__content">
              <p className="modal-dialog__error-message">{errorMessage}</p>
            </div>
            <div className="modal-dialog__actions">
              <button
                type="button"
                className="modal-dialog__button modal-dialog__button--secondary"
                onClick={onCancel}
                disabled={buttonsDisabled}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="modal-dialog__button modal-dialog__button--primary"
                onClick={onRetry}
                disabled={buttonsDisabled}
              >
                Reintentar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default SupplierCreateModal
