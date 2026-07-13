import AccountAutocomplete from './AccountAutocomplete'
import SupplierAutocomplete from './SupplierAutocomplete'
import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SupplierOption } from '../types/supplier'

interface DocumentAccountToolbarProps {
  suppliers: SupplierOption[]
  selectedSupplier: SupplierOption | null
  selectedAccount: SiigoAccountOption | null
  applyToAllFiltered: boolean
  saveAsDefault: boolean
  applyTargetsCount: number
  canApply: boolean
  isApplying: boolean
  disabled?: boolean
  feedbackMessage?: string | null
  errorMessage?: string | null
  onSupplierChange: (supplier: SupplierOption | null) => void
  onAccountChange: (account: SiigoAccountOption | null) => void
  onApplyToAllFilteredChange: (value: boolean) => void
  onSaveAsDefaultChange: (value: boolean) => void
  onApply: () => void
}

function DocumentAccountToolbar({
  suppliers,
  selectedSupplier,
  selectedAccount,
  applyToAllFiltered,
  saveAsDefault,
  applyTargetsCount,
  canApply,
  isApplying,
  disabled = false,
  feedbackMessage,
  errorMessage,
  onSupplierChange,
  onAccountChange,
  onApplyToAllFilteredChange,
  onSaveAsDefaultChange,
  onApply,
}: DocumentAccountToolbarProps) {
  const controlsDisabled = disabled || isApplying

  return (
    <section
      className="document-account-toolbar"
      aria-label="Asignación masiva de cuentas contables"
    >
      <div className="document-account-toolbar__row">
        <div className="document-account-toolbar__field document-account-toolbar__field--supplier">
          <label htmlFor="document-supplier-filter">Proveedor</label>
          <SupplierAutocomplete
            id="document-supplier-filter"
            options={suppliers}
            value={selectedSupplier}
            onChange={onSupplierChange}
            disabled={controlsDisabled}
          />
        </div>

        <div className="document-account-toolbar__field document-account-toolbar__field--account">
          <label htmlFor="document-account-select">Cuenta contable</label>
          <AccountAutocomplete
            id="document-account-select"
            value={selectedAccount}
            onChange={onAccountChange}
            disabled={controlsDisabled}
          />
        </div>

        <button
          type="button"
          className="document-account-toolbar__apply"
          onClick={onApply}
          disabled={controlsDisabled || !canApply}
        >
          {isApplying ? 'Aplicando...' : 'Aplicar cuenta'}
        </button>
      </div>

      <div className="document-account-toolbar__options">
        <label className="document-account-toolbar__checkbox">
          <input
            type="checkbox"
            checked={applyToAllFiltered}
            onChange={(event) => onApplyToAllFilteredChange(event.target.checked)}
            disabled={controlsDisabled}
          />
          <span>Aplicar esta cuenta a todos los documentos filtrados.</span>
        </label>

        <label className="document-account-toolbar__checkbox">
          <input
            type="checkbox"
            checked={saveAsDefault}
            onChange={(event) => onSaveAsDefaultChange(event.target.checked)}
            disabled={controlsDisabled}
          />
          <span>
            Guardar esta cuenta como predeterminada para estos proveedores.
          </span>
        </label>
      </div>

      <p className="document-account-toolbar__summary">
        Documentos pendientes de cuenta: <strong>{applyTargetsCount}</strong>
      </p>

      {feedbackMessage && (
        <p className="document-account-toolbar__feedback">{feedbackMessage}</p>
      )}

      {errorMessage && (
        <p className="document-account-toolbar__error">{errorMessage}</p>
      )}
    </section>
  )
}

export default DocumentAccountToolbar
