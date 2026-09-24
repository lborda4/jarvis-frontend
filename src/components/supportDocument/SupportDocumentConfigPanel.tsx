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
  /** true si entre los documentos seleccionados hay alguno en "Requiere
   * proveedor" — habilita "Crear terceros" junto a Enviar/Eliminar. */
  canCreateTerceros?: boolean
  /** Proveedores distintos por crear entre los seleccionados. */
  pendingTercerosCount?: number
  isCreatingTerceros?: boolean
  /** true si al menos un documento seleccionado todavía no queda en LISTA
   * (incluye ERROR: un fallo puede necesitar reconfigurarse) y por lo tanto
   * se puede configurar. */
  hasConfigurableSelection: boolean
  /** true si todos los documentos que se van a enviar quedaron en ERROR. */
  isRetry?: boolean
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
  onCreateTerceros?: () => void
  /** Solo se usa en modo actionsOnly (Factura de compra) — deselecciona
   * todos los documentos de una vez ("Quitar selección"). */
  onClearSelection?: () => void
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
  canCreateTerceros = false,
  pendingTercerosCount = 0,
  isCreatingTerceros = false,
  hasConfigurableSelection,
  isRetry = false,
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
  onCreateTerceros,
  onClearSelection,
}: SupportDocumentConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const isBusy = isSending || isDeleting
  const controlsDisabled = disabled || isBusy
  const isDeleteMode = canDelete && !hasConfigurableSelection
  const showCreateTerceros = canCreateTerceros && onCreateTerceros != null
  const createTercerosButton = showCreateTerceros ? (
    <Button
      variant="secondary"
      onClick={onCreateTerceros}
      disabled={controlsDisabled || isCreatingTerceros}
    >
      {isCreatingTerceros ? 'Buscando proveedores...' : 'Crear terceros'}
    </Button>
  ) : null

  if (selectedCount === 0) {
    return null
  }

  // Factura de compra: la configuración es por documento (cada fila tiene su
  // propio editor), así que acá no hay campos que ocultar/expandir — una
  // barra compacta de una sola línea alcanza, sin el chevron de
  // colapsar/expandir que en este modo no tenía nada que hacer (los botones
  // Enviar/Eliminar quedaban escondidos si el usuario lo colapsaba).
  if (actionsOnly) {
    const metaParts = [
      sendableCount > 0 ? `${sendableCount} listo(s) para enviar` : null,
      canDelete ? `${deletableCount} para eliminar` : null,
      showCreateTerceros
        ? `${pendingTercerosCount} sin tercero creado`
        : null,
    ].filter(Boolean)
    const metaText = metaParts.length > 0 ? metaParts.join(' · ') : null

    return (
      <section
        className="support-config-panel support-config-panel--compact"
        aria-label="Documentos seleccionados"
      >
        <span className="support-config-panel__title">
          Documentos seleccionados: {selectedCount}
        </span>

        {metaText && (
          <span className="support-config-panel__meta">{metaText}</span>
        )}

        {onClearSelection && (
          <button
            type="button"
            className="support-config-panel__clear-link"
            onClick={onClearSelection}
            disabled={controlsDisabled}
          >
            Quitar selección
          </button>
        )}

        <div className="support-config-panel__compact-actions">
          {canDelete && (
            <Button
              variant="danger"
              onClick={onDelete}
              disabled={controlsDisabled || !canDelete}
            >
              {isDeleting ? (progressLabel ?? 'Eliminando...') : 'Eliminar'}
            </Button>
          )}
          {createTercerosButton}
          {canSend && (
            <Button
              variant="primary"
              onClick={onSend}
              disabled={controlsDisabled || !canSend}
            >
              {isSending
                ? (progressLabel ?? (isRetry ? 'Reintentando...' : 'Enviando...'))
                : isRetry
                  ? 'Reintentar'
                  : `Enviar ${sendableCount} documento${sendableCount === 1 ? '' : 's'}`}
            </Button>
          )}
        </div>
      </section>
    )
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
                  {/* Ya no hay botón manual "Sugerir con IA": la cuenta se
                      autocompleta sola (historial del proveedor, o IA en
                      segundo plano si no hay historial — ver
                      SiigoPurchaseAiClassificationService /
                      classifyItemTypeAndAccount en el backend), así que este
                      campo ya llega con un valor cuando hay uno disponible. */}
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
            {createTercerosButton}
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
