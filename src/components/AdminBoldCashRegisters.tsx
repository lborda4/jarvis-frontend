import { useEffect, useState, type FormEvent } from 'react'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import SuccessMessage from './SuccessMessage'
import LoadingIndicator from './LoadingIndicator'
import {
  fetchBoldBindedTerminals,
  fetchBoldCashRegisters,
  saveBoldCashRegister,
} from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import type { BoldCashRegister, BoldTerminal } from '../types/admin'

const emptyDraft = {
  id: '',
  cashRegisterName: '',
  boldTerminalId: '',
}

export default function AdminBoldCashRegisters({
  companyId,
  credentialsVersion,
}: {
  companyId: string
  credentialsVersion: number
}) {
  const [items, setItems] = useState<BoldCashRegister[]>([])
  const [terminals, setTerminals] = useState<BoldTerminal[]>([])
  const [draft, setDraft] = useState(emptyDraft)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingTerminals, setLoadingTerminals] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [terminalError, setTerminalError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    void fetchBoldCashRegisters(companyId)
      .then((response) => {
        if (!cancelled) setItems(response.items)
      })
      .catch((err) => {
        if (!cancelled)
          setError(getApiErrorMessage(err, 'No se pudieron cargar las cajas.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [companyId, retry])

  useEffect(() => {
    let cancelled = false
    void fetchBoldBindedTerminals(companyId)
      .then((response) => {
        if (!cancelled)
          setTerminals(
            response.payload.available_terminals.filter(
              (terminal) => terminal.status === 'BINDED',
            ),
          )
      })
      .catch((err) => {
        if (!cancelled)
          setTerminalError(
            getApiErrorMessage(err, 'No se pudieron consultar los datáfonos.'),
          )
      })
      .finally(() => {
        if (!cancelled) setLoadingTerminals(false)
      })
    return () => {
      cancelled = true
    }
  }, [companyId, credentialsVersion, retry])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    setError(null)
    setSuccess(null)
    if (!draft.cashRegisterName.trim()) {
      setError('Ingrese el nombre de la caja.')
      return
    }
    if (
      !terminals.some(
        (terminal) => terminal.terminal_serial === draft.boldTerminalId,
      )
    ) {
      setError('Seleccione un datáfono de la lista.')
      return
    }
    setSaving(true)
    try {
      const { item } = await saveBoldCashRegister({
        companyId,
        ...(draft.id ? { id: draft.id } : {}),
        cashRegisterName: draft.cashRegisterName.trim(),
        boldTerminalId: draft.boldTerminalId,
      })
      setItems((current) => [
        ...current.filter((existing) => existing.id !== item.id),
        item,
      ])
      setDraft(emptyDraft)
      setEditing(false)
      setSuccess('Caja y datáfono vinculados correctamente.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo guardar la caja.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-bold-panel">
      <h3>Cajas y datáfonos</h3>
      <p>
        Consulte los datáfonos con la llave de identidad guardada y vincule cada
        caja de Siigo.
      </p>
      <Button
        variant="secondary"
        disabled={saving || loading || loadingTerminals}
        onClick={() => {
          setLoading(true)
          setLoadingTerminals(true)
          setTerminalError(null)
          setError(null)
          setRetry((value) => value + 1)
        }}
      >
        Actualizar cajas y datáfonos
      </Button>
      {loadingTerminals && (
        <LoadingIndicator message="Consultando datáfonos de Bold..." />
      )}
      {terminalError && <ErrorMessage message={terminalError} />}
      {!loadingTerminals && !terminalError && terminals.length === 0 && (
        <p>No hay datáfonos vinculados a esta cuenta Bold.</p>
      )}
      {loading ? (
        <LoadingIndicator message="Cargando cajas..." />
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Caja</th>
                <th>Datáfono</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.cashRegisterName}</td>
                  <td>
                    {terminals.find(
                      (terminal) =>
                        terminal.terminal_serial === item.boldTerminalId,
                    )?.name ?? item.boldTerminalId}
                  </td>
                  <td>
                    <Button
                      variant="secondary"
                      disabled={saving}
                      onClick={() => {
                        setDraft({
                          id: item.id,
                          cashRegisterName: item.cashRegisterName,
                          boldTerminalId: item.boldTerminalId,
                        })
                        setEditing(true)
                        setSuccess(null)
                      }}
                    >
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={3}>No hay cajas configuradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <h4>{editing ? 'Editar caja' : 'Agregar caja'}</h4>
      <form className="admin-form" onSubmit={(event) => void save(event)}>
        <div className="admin-form__grid">
          <div className="admin-form__field">
            <label htmlFor="bold-register-name">Nombre de la caja</label>
            <input
              id="bold-register-name"
              required
              disabled={saving}
              value={draft.cashRegisterName}
              onChange={(event) =>
                setDraft({ ...draft, cashRegisterName: event.target.value })
              }
            />
          </div>
          <div className="admin-form__field">
            <label htmlFor="bold-terminal">Datáfono</label>
            <select
              id="bold-terminal"
              required
              disabled={saving || loadingTerminals || !!terminalError}
              value={draft.boldTerminalId}
              onChange={(event) =>
                setDraft({ ...draft, boldTerminalId: event.target.value })
              }
            >
              <option value="">Seleccione un datáfono</option>
              {draft.boldTerminalId &&
                !terminals.some(
                  (terminal) =>
                    terminal.terminal_serial === draft.boldTerminalId,
                ) && (
                  <option value={draft.boldTerminalId} disabled>
                    Datáfono no disponible ({draft.boldTerminalId})
                  </option>
                )}
              {terminals.map((terminal) => (
                <option
                  key={terminal.terminal_serial}
                  value={terminal.terminal_serial}
                >
                  {terminal.name || terminal.terminal_serial}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="admin-form__actions">
          <Button
            type="submit"
            disabled={
              saving ||
              loading ||
              loadingTerminals ||
              !!terminalError ||
              terminals.length === 0
            }
          >
            {saving ? 'Guardando...' : 'Guardar caja'}
          </Button>
          {editing && (
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setDraft(emptyDraft)
                setEditing(false)
              }}
            >
              Cancelar edición
            </Button>
          )}
        </div>
      </form>
      {error && <ErrorMessage message={error} />}
      {success && <SuccessMessage message={success} />}
    </section>
  )
}
