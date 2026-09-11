import { useEffect, useMemo, useState } from 'react'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import Modal from './Modal'
import { getApiErrorMessage } from '../services/apiClient'
import './CreateTercerosBulkModal.css'

/** Forma común de un proveedor pendiente, sea para el modal JARVIS (crea en
 * jarvis_terceros) o el modal SIIGO (crea directo en SIIGO) — ambos backends
 * devuelven exactamente estos campos (ver GET terceros/pending / GET
 * suppliers/pending), así que el modal no necesita saber para cuál de los
 * dos proveedores está trabajando. */
export interface PendingSupplierRow {
  document_id: string
  document_type: string
  document_number: string
  name: string | null
  email: string | null
}

export interface CreateTercerosBulkModalProps {
  isOpen: boolean
  onClose: () => void
  suppliers: PendingSupplierRow[]
  /** Hace la llamada real (bulk JARVIS o bulk SIIGO) y cualquier trabajo de
   * seguimiento (recargar documentos, avisar cuántos fallaron, etc.) — el
   * modal solo espera a que resuelva para cerrarse, o muestra el mensaje si
   * lanza. */
  onSubmit: (selected: PendingSupplierRow[]) => Promise<void>
  title?: string
  descriptionLines?: string[]
}

const DEFAULT_TITLE = 'Crear terceros pendientes'
const DEFAULT_DESCRIPTION_LINES = [
  'Estos terceros aparecen en los documentos recibidos y no existen todavía.',
  'Selecciona los que quieres crear.',
]

function CreateTercerosBulkModal({
  isOpen,
  onClose,
  suppliers,
  onSubmit,
  title = DEFAULT_TITLE,
  descriptionLines = DEFAULT_DESCRIPTION_LINES,
}: CreateTercerosBulkModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Todos vienen marcados por defecto — el usuario destilda los que no
      // quiere crear en este lote (ver captura del pedido original).
      setSelectedIds(new Set(suppliers.map((supplier) => supplier.document_id)))
      setErrorMessage(null)
    }
  }, [isOpen, suppliers])

  const allSelected =
    suppliers.length > 0 && selectedIds.size === suppliers.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const handleToggleAll = () => {
    setSelectedIds(
      allSelected
        ? new Set()
        : new Set(suppliers.map((supplier) => supplier.document_id)),
    )
  }

  const handleToggleOne = (documentId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(documentId)) {
        next.delete(documentId)
      } else {
        next.add(documentId)
      }
      return next
    })
  }

  const handleClose = () => {
    if (isSaving) return
    onClose()
  }

  const selectedSuppliers = useMemo(
    () => suppliers.filter((supplier) => selectedIds.has(supplier.document_id)),
    [suppliers, selectedIds],
  )

  const handleCreate = async () => {
    if (selectedSuppliers.length === 0) {
      setErrorMessage('Selecciona al menos un tercero para crear.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      await onSubmit(selectedSuppliers)
      onClose()
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudieron crear los terceros.'),
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      busy={isSaving}
      labelledBy="crear-terceros-pendientes-title"
      size="lg"
      className="terceros-bulk-modal"
    >
      <h2 id="crear-terceros-pendientes-title" className="modal-dialog__title">
        {title}
      </h2>

      {descriptionLines.map((line) => (
        <p className="terceros-bulk-modal__description" key={line}>
          {line}
        </p>
      ))}

      {errorMessage && <ErrorMessage message={errorMessage} />}

      <div className="terceros-bulk-modal__table-wrap">
        <table className="terceros-bulk-modal__table">
          <thead>
            <tr>
              <th className="terceros-bulk-modal__checkbox-col">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = someSelected
                    }
                  }}
                  onChange={handleToggleAll}
                  disabled={isSaving || suppliers.length === 0}
                  aria-label="Seleccionar todos los terceros"
                />
              </th>
              <th>Tipo de documento</th>
              <th>Número de documento</th>
              <th>Nombre / razón social</th>
              <th>Correo</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={5} className="terceros-bulk-modal__empty">
                  No hay proveedores pendientes por crear.
                </td>
              </tr>
            ) : (
              suppliers.map((supplier) => {
                const checked = selectedIds.has(supplier.document_id)
                return (
                  <tr
                    key={supplier.document_id}
                    className={
                      checked ? 'terceros-bulk-modal__row--selected' : undefined
                    }
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleOne(supplier.document_id)}
                        disabled={isSaving}
                        aria-label={`Seleccionar ${supplier.name ?? supplier.document_number}`}
                      />
                    </td>
                    <td>{supplier.document_type}</td>
                    <td>{supplier.document_number}</td>
                    <td>{supplier.name ?? '—'}</td>
                    <td>{supplier.email ?? '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="terceros-bulk-modal__count">
        {selectedIds.size} terceros seleccionados de {suppliers.length}
      </p>

      <div className="modal-dialog__actions">
        <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleCreate}
          disabled={isSaving || selectedSuppliers.length === 0}
        >
          {isSaving ? 'Creando...' : 'Crear'}
        </Button>
      </div>
    </Modal>
  )
}

export default CreateTercerosBulkModal
