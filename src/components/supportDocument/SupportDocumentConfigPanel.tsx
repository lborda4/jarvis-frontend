import { useState } from 'react'
import AccountAutocomplete from '../AccountAutocomplete'
import PaymentMethodAutocomplete from '../PaymentMethodAutocomplete'
import TaxMultiSelect from '../TaxMultiSelect'
import type { SiigoAccountOption } from '../../constants/siigoAccountCatalog'
import type { SiigoPaymentMethodOption } from '../../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../../constants/siigoTaxCatalog'

interface SupportDocumentConfigPanelProps {
  selectedCount: number
  sendableCount: number
  accountOptions: SiigoAccountOption[]
  paymentMethodOptions: SiigoPaymentMethodOption[]
  retentionOptions: SiigoTaxOption[]
  selectedAccount: SiigoAccountOption | null
  selectedPaymentMethod: SiigoPaymentMethodOption | null
  selectedRetentions: SiigoTaxOption[]
  canSend: boolean
  isSending: boolean
  disabled?: boolean
  onAccountChange: (account: SiigoAccountOption | null) => void
  onPaymentMethodChange: (paymentMethod: SiigoPaymentMethodOption | null) => void
  onRetentionsChange: (taxes: SiigoTaxOption[]) => void
  onSend: () => void
}

function SupportDocumentConfigPanel({
  selectedCount,
  sendableCount,
  accountOptions,
  paymentMethodOptions,
  retentionOptions,
  selectedAccount,
  selectedPaymentMethod,
  selectedRetentions,
  canSend,
  isSending,
  disabled = false,
  onAccountChange,
  onPaymentMethodChange,
  onRetentionsChange,
  onSend,
}: SupportDocumentConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const controlsDisabled = disabled || isSending

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
          {sendableCount > 0
            ? `${sendableCount} listo(s) para enviar`
            : 'Complete cuenta, medio de pago y retenciones'}
        </span>
        <span className="support-config-panel__chevron" aria-hidden="true">
          {isExpanded ? '▾' : '▸'}
        </span>
      </button>

      {isExpanded && (
        <div className="support-config-panel__body">
          <div className="support-config-panel__fields">
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

            <div className="support-config-panel__field">
              <label htmlFor="support-config-payment-method">Medio de pago</label>
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
              <label htmlFor="support-config-retentions">Retenciones</label>
              <TaxMultiSelect
                id="support-config-retentions"
                options={retentionOptions}
                selectedTaxes={selectedRetentions}
                onChange={onRetentionsChange}
                disabled={controlsDisabled}
                placeholder="Buscar ReteICA o Retefuente..."
              />
            </div>
          </div>

          <div className="support-config-panel__actions support-config-panel__actions--end">
            <button
              type="button"
              className="support-config-panel__send"
              onClick={onSend}
              disabled={controlsDisabled || !canSend}
            >
              {isSending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default SupportDocumentConfigPanel
