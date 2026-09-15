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
   * lanza. Recibe los datos ya con las ediciones de nombre/correo aplicadas. */
  onSubmit: (selected: PendingSupplierRow[]) => Promise<void>
  title?: string
  descriptionLines?: string[]
}

const DEFAULT_TITLE = 'Crear terceros pendientes'
const DEFAULT_DESCRIPTION_LINES = [
  'Estos terceros aparecen en los documentos recibidos y no existen todavía.',
  'Selecciona los que quieres crear.',
]

function buildEditedMap(
  suppliers: PendingSupplierRow[],
): Record<string, PendingSupplierRow> {
  return Object.fromEntries(
    suppliers.map((supplier) => [supplier.document_id, supplier]),
  )
}

function CreateTercerosBulkModal({
  isOpen,
  onClose,
  suppliers,
  onSubmit,
  title = DEFAULT_TITLE,
  descriptionLines = DEFAULT_DESCRIPTION_LINES,
}: CreateTercerosBulkModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // Copia editable — el usuario puede corregir nombre/correo antes de crear
  // sin tocar lo que devolvió el backend (por si cancela y vuelve a abrir).
  const [editedSuppliers, setEditedSuppliers] = useState<
    Record<string, PendingSupplierRow>
  >({})
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Todos vienen marcados por defecto — el usuario destilda los que no
      // quiere crear en este lote (ver captura del pedido original).
      setSelectedIds(new Set(suppliers.map((supplier) => supplier.document_id)))
      setEditedSuppliers(buildEditedMap(suppliers))
      setErrorMessage(null)
    }
  }, [isOpen, suppliers])

  const rows = useMemo(
    () =>
      suppliers.map(
        (supplier) => editedSuppliers[supplier.document_id] ?? supplier,
      ),
    [suppliers, editedSuppliers],
  )

  const allSelected = rows.length > 0 && selectedIds.size === rows.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const handleToggleAll = () => {
    setSelectedIds(
      allSelected ? new Set() : new Set(rows.map((row) => row.document_id)),
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

  const handleFieldChange = (
    documentId: string,
    field: 'name' | 'email',
    value: string,
  ) => {
    setEditedSuppliers((current) => {
      const row = current[documentId]
      if (!row) return current
      return { ...current, [documentId]: { ...row, [field]: value } }
    })
  }

  const handleClose = () => {
    if (isSaving) return
    onClose()
  }

  const selectedSuppliers = useMemo(
    () => rows.filter((row) => selectedIds.has(row.document_id)),
    [rows, selectedIds],
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

      <div className="terceros-bulk-modal__description-group">
        {descriptionLines.map((line) => (
          <p className="terceros-bulk-modal__description" key={line}>
            {line}
          </p>
        ))}
      </div>

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
                  disabled={isSaving || rows.length === 0}
                  aria-label="Seleccionar todos los terceros"
                />
              </th>
              <th>Tipo</th>
              <th>Número de documento</th>
              <th>Nombre / razón social</th>
              <th>Correo</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="terceros-bulk-modal__empty">
                  No hay proveedores pendientes por crear.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const checked = selectedIds.has(row.document_id)
                return (
                  <tr
                    key={row.document_id}
                    className={
                      checked ? 'terceros-bulk-modal__row--selected' : undefined
                    }
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleOne(row.document_id)}
                        disabled={isSaving}
                        aria-label={`Seleccionar ${row.name ?? row.document_number}`}
                      />
                    </td>
                    <td>
                      <span className="terceros-bulk-modal__type-badge">
                        {row.document_type}
                      </span>
                    </td>
                    <td className="terceros-bulk-modal__mono">
                      {row.document_number}
                    </td>
                    <td>
                      <input
                        type="text"
                        className="terceros-bulk-modal__cell-input"
                        value={row.name ?? ''}
                        onChange={(event) =>
                          handleFieldChange(
                            row.document_id,
                            'name',
                            event.target.value,
                          )
                        }
                        disabled={isSaving}
                        placeholder="Nombre / razón social"
                        aria-label={`Nombre de ${row.document_number}`}
                      />
                    </td>
                    <td>
                      <input
                        type="email"
                        className="terceros-bulk-modal__cell-input"
                        value={row.email ?? ''}
                        onChange={(event) =>
                          handleFieldChange(
                            row.document_id,
                            'email',
                            event.target.value,
                          )
                        }
                        disabled={isSaving}
                        placeholder="Correo (opcional)"
                        aria-label={`Correo de ${row.document_number}`}
                      />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="terceros-bulk-modal__count">
        <strong>{selectedIds.size}</strong> tercero
        {selectedIds.size === 1 ? '' : 's'} seleccionado
        {selectedIds.size === 1 ? '' : 's'} de {rows.length}
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
