import Button from './Button'
import Modal from './Modal'
import type { CreatedSiigoSupplier, SiigoSupplierPersonType } from '../types/siigo'
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
  personType: SiigoSupplierPersonType | ''
  errorMessage: string | null
  createdSupplier: CreatedSiigoSupplier | null
  onCancel: () => void
  onPersonTypeChange: (personType: SiigoSupplierPersonType) => void
  onCreateSupplier: () => void
  onContinue: () => void
  onRetry: () => void
}

function SupplierCreateModal({
  isOpen,
  view,
  supplierName,
  supplierDocument,
  personType,
  errorMessage,
  createdSupplier,
  onCancel,
  onPersonTypeChange,
  onCreateSupplier,
  onContinue,
  onRetry,
}: SupplierCreateModalProps) {
  const isLoading = view === 'loading'
  const canCreate = Boolean(personType) && !isLoading
  // Dismissing (X, Escape, overlay click) always maps to the action equivalent
  // to that view's primary "leave" button, so no side effect is ever skipped.
  const dismissHandler = view === 'success' ? onContinue : onCancel

  return (
    <Modal
      isOpen={isOpen}
      onClose={dismissHandler}
      busy={isLoading}
      labelledBy="supplier-modal-title"
    >
      {view === 'confirm' && (
        <>
          <h2 id="supplier-modal-title" className="modal-dialog__title">
            Tercero no encontrado
          </h2>
          <div className="modal-dialog__content">
            <p>El tercero no existe en SIIGO ni en Jarvis.</p>
            <p>¿Desea crearlo en SIIGO con el NIT del Excel?</p>
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

            <fieldset className="modal-dialog__fieldset">
              <legend>
                Tipo de persona <span aria-hidden="true">*</span>
              </legend>
              <label className="modal-dialog__radio">
                <input
                  type="radio"
                  name="supplier-person-type"
                  value="person"
                  checked={personType === 'person'}
                  onChange={() => onPersonTypeChange('person')}
                  disabled={isLoading}
                  required
                />
                Persona natural
              </label>
              <label className="modal-dialog__radio">
                <input
                  type="radio"
                  name="supplier-person-type"
                  value="company"
                  checked={personType === 'company'}
                  onChange={() => onPersonTypeChange('company')}
                  disabled={isLoading}
                  required
                />
                Persona jurídica
              </label>
            </fieldset>

            {errorMessage && (
              <p className="modal-dialog__error-message" role="alert">
                {errorMessage}
              </p>
            )}
          </div>
          <div className="modal-dialog__actions">
            <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={onCreateSupplier} disabled={!canCreate}>
              Crear proveedor
            </Button>
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
            <Button variant="secondary" disabled>
              Cancelar
            </Button>
            <Button variant="primary" disabled>
              Crear proveedor
            </Button>
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
            <Button variant="primary" onClick={onContinue}>
              Continuar
            </Button>
          </div>
        </>
      )}

      {view === 'error' && (
        <>
          <h2 id="supplier-modal-title" className="modal-dialog__title">
            Error al crear proveedor
          </h2>
          <div className="modal-dialog__content">
            <p className="modal-dialog__error-message" role="alert">
              {errorMessage}
            </p>
          </div>
          <div className="modal-dialog__actions">
            <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={onRetry} disabled={isLoading}>
              Reintentar
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}

export default SupplierCreateModal
