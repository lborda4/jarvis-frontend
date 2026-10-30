import { useState, type FormEvent } from 'react'
import Button from '../Button'
import ErrorMessage from '../ErrorMessage'
import Modal from '../Modal'
import { isValidCufe } from '../../utils/radianExcel'
import './PurchaseInvoiceImportModal.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelectExcel: () => void
  onImportCufe: (cufe: string) => void
}

export default function PurchaseInvoiceImportModal({
  isOpen,
  onClose,
  onSelectExcel,
  onImportCufe,
}: Props) {
  const [method, setMethod] = useState<'excel' | 'cufe'>('excel')
  const [cufe, setCufe] = useState('')
  const [error, setError] = useState<string | null>(null)
  function submit(event: FormEvent) {
    event.preventDefault()
    if (method === 'excel') {
      onSelectExcel()
      return
    }
    const value = cufe.trim().toLowerCase()
    if (!isValidCufe(value)) {
      setError('Ingresa un CUFE válido de 96 caracteres hexadecimales.')
      return
    }
    setError(null)
    onImportCufe(value)
  }
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="purchase-import-title"
      size="md"
    >
      <h2 id="purchase-import-title" className="modal-dialog__title">
        Importar facturas de compra
      </h2>
      <form onSubmit={submit} className="purchase-import">
        <fieldset className="purchase-import__methods">
          <legend>¿Cómo quieres importar?</legend>
          <label>
            <input
              type="radio"
              name="purchase-import-method"
              checked={method === 'excel'}
              onChange={() => {
                setMethod('excel')
                setError(null)
              }}
            />{' '}
            Excel: varias facturas
          </label>
          <label>
            <input
              type="radio"
              name="purchase-import-method"
              checked={method === 'cufe'}
              onChange={() => {
                setMethod('cufe')
                setError(null)
              }}
            />{' '}
            CUFE: una factura
          </label>
        </fieldset>
        {method === 'cufe' ? (
          <div className="purchase-import__field">
            <label htmlFor="purchase-import-cufe">CUFE de la factura</label>
            <textarea
              id="purchase-import-cufe"
              value={cufe}
              onChange={(event) => {
                setCufe(event.target.value)
                setError(null)
              }}
              placeholder="Pega aquí el CUFE completo"
              rows={3}
              required
              spellCheck={false}
              autoCapitalize="none"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'purchase-import-error' : undefined}
            />
          </div>
        ) : (
          <p>
            Selecciona el Excel descargado de la DIAN con las facturas recibidas
            que quieres importar.
          </p>
        )}
        <p>
          Las facturas se prepararán para que revises sus datos y las envíes a
          SIIGO.
        </p>
        {error && (
          <div id="purchase-import-error">
            <ErrorMessage inline message={error} />
          </div>
        )}
        <div className="modal-dialog__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">
            {method === 'excel' ? 'Seleccionar Excel' : 'Importar factura'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
