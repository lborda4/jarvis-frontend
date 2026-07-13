import SupplierMultiSelect from '../SupplierMultiSelect'
import type { SupplierOption } from '../../types/supplier'

interface SupportDocumentToolbarProps {
  suppliers: SupplierOption[]
  selectedSupplierNits: string[]
  disabled?: boolean
  onSupplierNitsChange: (nits: string[]) => void
}

function SupportDocumentToolbar({
  suppliers,
  selectedSupplierNits,
  disabled = false,
  onSupplierNitsChange,
}: SupportDocumentToolbarProps) {
  return (
    <section className="support-toolbar support-toolbar--filter-only" aria-label="Filtros">
      <div className="support-toolbar__fields">
        <div className="support-toolbar__field">
          <label htmlFor="support-supplier-filter">Filtro proveedor</label>
          <SupplierMultiSelect
            id="support-supplier-filter"
            options={suppliers}
            selectedNits={selectedSupplierNits}
            onChange={onSupplierNitsChange}
            disabled={disabled}
            placeholder="Buscar proveedor..."
          />
        </div>
      </div>
    </section>
  )
}

export default SupportDocumentToolbar
