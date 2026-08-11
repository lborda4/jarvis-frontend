import AccountAutocomplete from './AccountAutocomplete'
import Button from './Button'
import Modal from './Modal'
import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type {
  AccountMappingErrorPhase,
  AccountMappingModalView,
} from '../hooks/useAccountMappingModal'
import type { SiigoCreatedPurchase } from '../types/siigo'
import { formatCurrency, formatDate } from '../utils/formatters'

interface AccountMappingModalProps {
  isOpen: boolean
  view: AccountMappingModalView
  selectedAccount: SiigoAccountOption | null
  createdPurchase: SiigoCreatedPurchase | null
  errorMessage: string | null
  errorPhase: AccountMappingErrorPhase | null
  onCancel: () => void
  onSelectAccount: (account: SiigoAccountOption | null) => void
  onSave: () => void
  onAccept: () => void
  onRetry: () => void
}

function formatPurchaseNumber(purchase: SiigoCreatedPurchase): string {
  if (purchase.providerInvoicePrefix && purchase.providerInvoiceNumber) {
    return `${purchase.providerInvoicePrefix}-${purchase.providerInvoiceNumber}`
  }

  return String(purchase.number)
}

function AccountMappingModal({
  isOpen,
  view,
  selectedAccount,
  createdPurchase,
  errorMessage,
  errorPhase,
  onCancel,
  onSelectAccount,
  onSave,
  onAccept,
  onRetry,
}: AccountMappingModalProps) {
  const isBusy = view === 'saving_account' || view === 'creating_purchase'
  // Dismissing (X, Escape, overlay click) always maps to the action equivalent
  // to that view's primary "leave" button, so no side effect is ever skipped.
  const dismissHandler = view === 'purchase_success' ? onAccept : onCancel

  return (
    <Modal
      isOpen={isOpen}
      onClose={dismissHandler}
      busy={isBusy}
      labelledBy="account-mapping-modal-title"
    >
      {view === 'select' && (
        <>
          <h2 id="account-mapping-modal-title" className="modal-dialog__title">
            Cuenta contable requerida
          </h2>
          <div className="modal-dialog__content">
            <p>Este proveedor aún no tiene una cuenta contable asociada.</p>
            <p>Seleccione la cuenta que desea utilizar para esta factura.</p>
            <div className="account-mapping-form">
              <label htmlFor="account-mapping-select" className="account-mapping-form__label">
                Cuenta contable
              </label>
              <AccountAutocomplete
                id="account-mapping-select"
                value={selectedAccount}
                onChange={onSelectAccount}
                disabled={isBusy}
              />
              {errorMessage && (
                <p className="modal-dialog__error-message" role="alert">
                  {errorMessage}
                </p>
              )}
            </div>
          </div>
          <div className="modal-dialog__actions">
            <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={onSave}
              disabled={isBusy || !selectedAccount}
            >
              Guardar
            </Button>
          </div>
        </>
      )}

      {view === 'saving_account' && (
        <>
          <h2 id="account-mapping-modal-title" className="modal-dialog__title">
            Guardando cuenta
          </h2>
          <div className="modal-dialog__content modal-dialog__content--center">
            <span className="loading-indicator__spinner" aria-hidden="true" />
            <p>Asociando cuenta contable al proveedor...</p>
          </div>
        </>
      )}

      {view === 'creating_purchase' && (
        <>
          <h2 id="account-mapping-modal-title" className="modal-dialog__title">
            Creando factura
          </h2>
          <div className="modal-dialog__content modal-dialog__content--center">
            <span className="loading-indicator__spinner" aria-hidden="true" />
            <p>Creando la factura de compra en Siigo...</p>
          </div>
        </>
      )}

      {view === 'purchase_success' && createdPurchase && (
        <>
          <h2 id="account-mapping-modal-title" className="modal-dialog__title">
            Factura creada
          </h2>
          <div className="modal-dialog__content">
            <p className="modal-dialog__success-message">
              La factura de compra fue creada correctamente en Siigo.
            </p>
            <dl className="supplier-details">
              <div className="supplier-details__row">
                <dt>Número de factura</dt>
                <dd>{formatPurchaseNumber(createdPurchase)}</dd>
              </div>
              <div className="supplier-details__row">
                <dt>Identificador SIIGO</dt>
                <dd>{createdPurchase.id || '—'}</dd>
              </div>
              <div className="supplier-details__row">
                <dt>Fecha de creación</dt>
                <dd>{formatDate(createdPurchase.date)}</dd>
              </div>
              <div className="supplier-details__row">
                <dt>Total</dt>
                <dd>{formatCurrency(createdPurchase.total)}</dd>
              </div>
            </dl>
          </div>
          <div className="modal-dialog__actions">
            <Button variant="primary" onClick={onAccept}>
              Aceptar
            </Button>
          </div>
        </>
      )}

      {view === 'error' && (
        <>
          <h2 id="account-mapping-modal-title" className="modal-dialog__title">
            {errorPhase === 'purchase'
              ? 'Error al crear factura'
              : 'Error al guardar cuenta'}
          </h2>
          <div className="modal-dialog__content">
            <p className="modal-dialog__error-message" role="alert">
              {errorMessage}
            </p>
          </div>
          <div className="modal-dialog__actions">
            <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={onRetry} disabled={isBusy}>
              Reintentar
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}

export default AccountMappingModal
