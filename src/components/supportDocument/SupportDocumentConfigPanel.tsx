import { useState } from 'react'
import AccountAutocomplete from '../AccountAutocomplete'
import Button from '../Button'
import CostCenterAutocomplete from '../CostCenterAutocomplete'
import { ChevronDownIcon, ChevronRightIcon } from '../icons/SidebarIcons'
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
  selectedAccount: SiigoAccountOption | null
  selectedPaymentMethod: SiigoPaymentMethodOption | null
  selectedCostCenter: SiigoCostCenterOption
  showAccountField?: boolean
  canSend: boolean
  canDelete: boolean
  isSending: boolean
  isDeleting: boolean
  progressLabel?: string | null
  disabled?: boolean
  onAccountChange: (account: SiigoAccountOption | null) => void
  onPaymentMethodChange: (paymentMethod: SiigoPaymentMethodOption | null) => void
  onCostCenterChange: (costCenter: SiigoCostCenterOption) => void
  onRetentionTypeChange: (taxType: string, tax: SiigoTaxOption | null) => void
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
  selectedAccount,
  selectedPaymentMethod,
  selectedCostCenter,
  showAccountField = true,
  canSend,
  canDelete,
  isSending,
  isDeleting,
  progressLabel = null,
  disabled = false,
  onAccountChange,
  onPaymentMethodChange,
  onCostCenterChange,
  onRetentionTypeChange,
  onSend,
  onDelete,
}: SupportDocumentConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const isBusy = isSending || isDeleting
  const controlsDisabled = disabled || isBusy
  const isDeleteMode = canDelete && !canSend

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
          {isDeleteMode
            ? `${deletableCount} listo(s) para eliminar`
            : sendableCount > 0
              ? `${sendableCount} listo(s) para enviar`
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
          {!isDeleteMode && (
            <div className="support-config-panel__fields">
              {showAccountField && (
                <div className="support-config-panel__field">
                  <label htmlFor="support-config-account">Cuenta contable</label>
                  <AccountAutocomplete
                    id="support-config-account"
                    value={selectedAccount}
                    onChange={onAccountChange}
                    options={accountOptions}
                    disabled={controlsDisabled}
                    placeholder="Buscar cuenta (código o nombre)..."
                  />
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
            <Button
              variant={isDeleteMode ? 'danger' : 'primary'}
              onClick={isDeleteMode ? onDelete : onSend}
              disabled={
                controlsDisabled || (isDeleteMode ? !canDelete : !canSend)
              }
            >
              {isDeleteMode
                ? isDeleting
                  ? progressLabel ?? 'Eliminando...'
                  : 'Eliminar'
                : isSending
                  ? progressLabel ?? 'Enviando...'
                  : 'Enviar'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

export default SupportDocumentConfigPanel
