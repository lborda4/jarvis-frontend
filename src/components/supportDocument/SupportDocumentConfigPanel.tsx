import { useState } from 'react'
import AccountAutocomplete from '../AccountAutocomplete'
import Button from '../Button'
import CostCenterAutocomplete from '../CostCenterAutocomplete'
import DatePicker from '../DatePicker'
import { ChevronDownIcon, ChevronRightIcon, InfoIcon } from '../icons/SidebarIcons'
import PaymentMethodAutocomplete from '../PaymentMethodAutocomplete'
import TaxAutocomplete from '../TaxAutocomplete'
import type { SiigoAccountOption } from '../../constants/siigoAccountCatalog'
import type { SiigoCostCenterOption } from '../../constants/siigoCostCenterCatalog'
import type { SiigoPaymentMethodOption } from '../../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../../constants/siigoTaxCatalog'

interface SupportDocumentConfigPanelProps {
  selectedCount: number
  sendableCount: number
  deletableCount: number
  accountOptions: SiigoAccountOption[]
  paymentMethodOptions: SiigoPaymentMethodOption[]
  costCenterOptions: SiigoCostCenterOption[]
  retentionCatalogTypes: readonly string[]
  retentionOptionsByType: Record<string, SiigoTaxOption[]>
  selectedRetentionsByType: Record<string, SiigoTaxOption | null>
  /** Solo aplica a Factura de compra SIIGO. */
  showIvaField?: boolean
  ivaOptions: SiigoTaxOption[]
  selectedIva: SiigoTaxOption | null
  selectedAccount: SiigoAccountOption | null
  selectedPaymentMethod: SiigoPaymentMethodOption | null
  selectedCostCenter: SiigoCostCenterOption
  isCreditSelected: boolean
  selectedPlazoDays: number | null
  selectedDueDate: string
  showAccountField?: boolean
  /** Cuando es true, solo muestra el encabezado y los botones Enviar/
   * Eliminar, sin los campos de configuración — la configuración se hace
   * por documento (Factura de compra ya tiene su propio editor por fila). */
  actionsOnly?: boolean
  canSend: boolean
  canDelete: boolean
  /** true si al menos un documento seleccionado todavía no queda en LISTA
   * (incluye ERROR: un fallo puede necesitar reconfigurarse) y por lo tanto
   * se puede configurar. */
  hasConfigurableSelection: boolean
  /** true si todos los documentos que se van a enviar quedaron en ERROR. */
  isRetry?: boolean
  /** true si hay exactamente un documento seleccionado (la IA sugiere por documento). */
  canSuggestAi?: boolean
  isSuggestingAi?: boolean
  onSuggestAi?: () => void
  isSending: boolean
  isDeleting: boolean
  progressLabel?: string | null
  disabled?: boolean
  onAccountChange: (account: SiigoAccountOption | null) => void
  onPaymentMethodChange: (paymentMethod: SiigoPaymentMethodOption | null) => void
  onCostCenterChange: (costCenter: SiigoCostCenterOption) => void
  onRetentionTypeChange: (taxType: string, tax: SiigoTaxOption | null) => void
  onIvaChange: (tax: SiigoTaxOption | null) => void
  onPlazoChange: (days: number | null) => void
  onDueDateChange: (date: string) => void
  onSend: () => void
  onDelete: () => void
}

function formatRetentionTypeLabel(taxType: string): string {
  if (taxType === 'Retefuente') {
    return 'Retefuente'
  }

  if (taxType === 'ReteICA') {
    return 'ReteICA'
  }

  return taxType
}

function SupportDocumentConfigPanel({
  selectedCount,
  sendableCount,
  deletableCount,
  accountOptions,
  paymentMethodOptions,
  costCenterOptions,
  retentionCatalogTypes,
  retentionOptionsByType,
  selectedRetentionsByType,
  showIvaField = false,
  ivaOptions,
  selectedIva,
  selectedAccount,
  selectedPaymentMethod,
  selectedCostCenter,
  isCreditSelected,
  selectedPlazoDays,
  selectedDueDate,
  showAccountField = true,
  actionsOnly = false,
  canSend,
  canDelete,
  hasConfigurableSelection,
  isRetry = false,
  canSuggestAi = false,
  isSuggestingAi = false,
  onSuggestAi,
  isSending,
  isDeleting,
  progressLabel = null,
  disabled = false,
  onAccountChange,
  onPaymentMethodChange,
  onCostCenterChange,
  onRetentionTypeChange,
  onIvaChange,
  onPlazoChange,
  onDueDateChange,
  onSend,
  onDelete,
}: SupportDocumentConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const isBusy = isSending || isDeleting
  const controlsDisabled = disabled || isBusy
  const isDeleteMode = canDelete && !hasConfigurableSelection

  if (selectedCount === 0) {
    return null
  }

  return (
    <section
      className="support-config-panel"
      aria-label="Configuración de documentos seleccionados"
    >
      <button
        type="button"
        className="support-config-panel__header"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
      >
        <span className="support-config-panel__title">
          Documentos seleccionados: {selectedCount}
        </span>
        <span className="support-config-panel__meta">
          {canDelete && canSend
            ? `${sendableCount} listo(s) para enviar · ${deletableCount} para eliminar`
            : canDelete
              ? `${deletableCount} listo(s) para eliminar`
              : sendableCount > 0
                ? `${sendableCount} listo(s) para enviar`
                : actionsOnly
                  ? 'Configura cuenta contable y medio de pago desde cada documento'
                  : showAccountField
                    ? 'Complete cuenta contable y medio de pago'
                    : 'Revise medio de pago y retenciones (opcionales)'}
        </span>
        <span className="support-config-panel__chevron" aria-hidden="true">
          {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </span>
      </button>

      {isExpanded && (
        <div className="support-config-panel__body">
          {!isDeleteMode && !actionsOnly && (
            <div className="support-config-panel__fields">
              {showAccountField && (
                <div className="support-config-panel__field">
                  <label htmlFor="support-config-account">Cuenta contable</label>
                  <div className="support-config-panel__account-row">
                    <AccountAutocomplete
                      id="support-config-account"
                      value={selectedAccount}
                      onChange={onAccountChange}
                      options={accountOptions}
                      disabled={controlsDisabled}
                      placeholder="Buscar cuenta (código o nombre)..."
                    />
                    {onSuggestAi && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={onSuggestAi}
                        disabled={controlsDisabled || !canSuggestAi || isSuggestingAi}
                        title={
                          canSuggestAi
                            ? 'Sugerir cuenta contable e IVA con IA para el documento seleccionado'
                            : 'Selecciona exactamente un documento para pedir una sugerencia de IA'
                        }
                      >
                        {isSuggestingAi ? 'Sugiriendo...' : 'Sugerir con IA'}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="support-config-panel__field">
                <label htmlFor="support-config-payment-method">
                  Medio de pago
                </label>
                <PaymentMethodAutocomplete
                  id="support-config-payment-method"
                  value={selectedPaymentMethod}
                  onChange={onPaymentMethodChange}
                  options={paymentMethodOptions}
                  disabled={controlsDisabled}
                  placeholder="Buscar medio de pago..."
                />
              </div>

              <div className="support-config-panel__field">
                <label htmlFor="support-config-plazo">
                  Plazo
                  <span
                    className="support-config-panel__info"
                    title="Días de crédito para el pago. Al escribirlo se calcula la fecha de vencimiento."
                  >
                    <InfoIcon />
                  </span>
                </label>
                <div
                  className={`support-config-panel__term${
                    isCreditSelected ? '' : ' support-config-panel__term--disabled'
                  }`}
                >
                  <input
                    id="support-config-plazo"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={selectedPlazoDays ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value
                      onPlazoChange(raw === '' ? null : Math.max(0, Number(raw)))
                    }}
                    disabled={controlsDisabled || !isCreditSelected}
                    placeholder="0"
                  />
                  <span className="support-config-panel__term-suffix">días</span>
                </div>
              </div>

              <div className="support-config-panel__field">
                <label htmlFor="support-config-due-date">
                  Fecha de vencimiento
                  <span
                    className="support-config-panel__info"
                    title="Fecha en la que vence el pago. Al elegirla se calcula el plazo en días."
                  >
                    <InfoIcon />
                  </span>
                </label>
                <DatePicker
                  id="support-config-due-date"
                  value={selectedDueDate}
                  onChange={onDueDateChange}
                  disabled={controlsDisabled || !isCreditSelected}
                />
              </div>

              <div className="support-config-panel__field">
                <label htmlFor="support-config-cost-center">
                  Centros de costo (opcional)
                </label>
                <CostCenterAutocomplete
                  id="support-config-cost-center"
                  value={selectedCostCenter}
                  onChange={onCostCenterChange}
                  options={costCenterOptions}
                  disabled={controlsDisabled}
                  placeholder="Ninguno"
                />
              </div>

              {showIvaField && (
                <div className="support-config-panel__field">
                  <label htmlFor="support-config-iva">IVA (opcional)</label>
                  <TaxAutocomplete
                    id="support-config-iva"
                    options={ivaOptions}
                    value={selectedIva}
                    onChange={onIvaChange}
                    disabled={controlsDisabled}
                    placeholder="Buscar IVA..."
                  />
                </div>
              )}

              {retentionCatalogTypes.map((taxType) => (
                <div key={taxType} className="support-config-panel__field">
                  <label htmlFor={`support-config-retention-${taxType}`}>
                    {formatRetentionTypeLabel(taxType)} (opcional)
                  </label>
                  <TaxAutocomplete
                    id={`support-config-retention-${taxType}`}
                    options={retentionOptionsByType[taxType] ?? []}
                    value={selectedRetentionsByType[taxType] ?? null}
                    onChange={(tax) => onRetentionTypeChange(taxType, tax)}
                    disabled={controlsDisabled}
                    placeholder={`Buscar ${formatRetentionTypeLabel(taxType)}...`}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="support-config-panel__actions support-config-panel__actions--end">
            {canDelete && (
              <Button
                variant="danger"
                onClick={onDelete}
                disabled={controlsDisabled || !canDelete}
              >
                {isDeleting
                  ? progressLabel ?? 'Eliminando...'
                  : 'Eliminar'}
              </Button>
            )}
            {canSend && (
              <Button
                variant="primary"
                onClick={onSend}
                disabled={controlsDisabled || !canSend}
              >
                {isSending
                  ? progressLabel ?? (isRetry ? 'Reintentando...' : 'Enviando...')
                  : isRetry
                    ? 'Reintentar'
                    : 'Enviar'}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export default SupportDocumentConfigPanel
