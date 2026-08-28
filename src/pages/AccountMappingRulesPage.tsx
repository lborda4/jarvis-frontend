import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import ErrorMessage from '../components/ErrorMessage'
import Button from '../components/Button'
import {
  listAccountMappingRules,
  updateAccountMappingRule,
} from '../services/siigoService'
import { getApiErrorMessage } from '../services/apiClient'
import type { AccountMappingRuleSupplier } from '../types/siigo'
import './AccountMappingRulesPage.css'

interface EditingItem {
  supplierDocument: string
  descripcion: string
  accountCode: string
  accountName: string
}

function AccountMappingRulesPage() {
  const [suppliers, setSuppliers] = useState<AccountMappingRuleSupplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(
    new Set(),
  )
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadRules = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await listAccountMappingRules()
      setSuppliers(response.suppliers)
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudieron cargar las reglas de mapeo.'),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const toggleSupplier = (supplierDocument: string) => {
    setExpandedSuppliers((current) => {
      const next = new Set(current)
      if (next.has(supplierDocument)) {
        next.delete(supplierDocument)
      } else {
        next.add(supplierDocument)
      }
      return next
    })
  }

  const handleSaveEdit = async () => {
    if (!editingItem) return

    if (!editingItem.accountCode.trim()) {
      setErrorMessage('El código de cuenta es obligatorio.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      await updateAccountMappingRule({
        supplierDocument: editingItem.supplierDocument,
        descripcion: editingItem.descripcion,
        accountCode: editingItem.accountCode.trim(),
        accountName: editingItem.accountName.trim() || undefined,
      })
      setEditingItem(null)
      await loadRules()
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo guardar la regla de mapeo.'),
      )
    } finally {
      setIsSaving(false)
    }
  }

  const totalRules = useMemo(
    () => suppliers.reduce((sum, supplier) => sum + supplier.items.length, 0),
    [suppliers],
  )

  return (
    <main className="account-mapping-rules-page">
      <PageHeader
        title="Reglas de mapeo de cuenta contable"
        description="Cuenta PUC sugerida por proveedor + descripción del ítem. Una descripción nueva de un proveedor con una única cuenta histórica se marca como sugerencia hasta que la confirmes."
      />

      {errorMessage && <ErrorMessage message={errorMessage} />}

      {isLoading ? (
        <p className="account-mapping-rules-page__status">Cargando reglas…</p>
      ) : suppliers.length === 0 ? (
        <p className="account-mapping-rules-page__status">
          Todavía no hay reglas de mapeo confirmadas. Se van creando a medida
          que confirmás cuentas al enviar documentos, o corriendo el backfill
          desde el historial ya sincronizado.
        </p>
      ) : (
        <>
          <p className="account-mapping-rules-page__summary">
            {suppliers.length} proveedor(es) — {totalRules} regla(s) en total.
          </p>

          <div className="account-mapping-rules-page__list">
            {suppliers.map((supplier) => (
              <div
                key={supplier.supplierDocument}
                className="account-mapping-rule-card"
              >
                {supplier.isSingleAccount ? (
                  <div className="account-mapping-rule-card__summary">
                    <div className="account-mapping-rule-card__supplier">
                      <strong>
                        {supplier.supplierName || supplier.supplierDocument}
                      </strong>
                      <span className="account-mapping-rule-card__nit">
                        NIT {supplier.supplierDocument}
                      </span>
                    </div>
                    <div className="account-mapping-rule-card__account">
                      {supplier.singleAccount?.code}
                      {supplier.singleAccount?.name
                        ? ` — ${supplier.singleAccount.name}`
                        : ''}
                    </div>
                    <button
                      type="button"
                      className="account-mapping-rule-card__toggle"
                      onClick={() => toggleSupplier(supplier.supplierDocument)}
                    >
                      Ver detalle ({supplier.items.length})
                    </button>
                  </div>
                ) : (
                  <div className="account-mapping-rule-card__summary">
                    <div className="account-mapping-rule-card__supplier">
                      <strong>
                        {supplier.supplierName || supplier.supplierDocument}
                      </strong>
                      <span className="account-mapping-rule-card__nit">
                        NIT {supplier.supplierDocument}
                      </span>
                    </div>
                    <span className="account-mapping-rule-card__badge">
                      {supplier.items.length} cuentas distintas
                    </span>
                    <button
                      type="button"
                      className="account-mapping-rule-card__toggle"
                      onClick={() => toggleSupplier(supplier.supplierDocument)}
                    >
                      {expandedSuppliers.has(supplier.supplierDocument)
                        ? 'Ocultar detalle'
                        : 'Ver detalle'}
                    </button>
                  </div>
                )}

                {expandedSuppliers.has(supplier.supplierDocument) && (
                    <table className="account-mapping-rule-card__table">
                      <thead>
                        <tr>
                          <th>Descripción</th>
                          <th>Cuenta</th>
                          <th>Usos</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplier.items.map((item) => {
                          const isEditing =
                            editingItem?.supplierDocument ===
                              supplier.supplierDocument &&
                            editingItem?.descripcion === item.descripcion

                          return (
                            <tr key={item.descripcion}>
                              <td>{item.descripcion}</td>
                              <td>
                                {isEditing ? (
                                  <div className="account-mapping-rule-card__edit-fields">
                                    <input
                                      value={editingItem.accountCode}
                                      onChange={(event) =>
                                        setEditingItem({
                                          ...editingItem,
                                          accountCode: event.target.value,
                                        })
                                      }
                                      placeholder="Código"
                                    />
                                    <input
                                      value={editingItem.accountName}
                                      onChange={(event) =>
                                        setEditingItem({
                                          ...editingItem,
                                          accountName: event.target.value,
                                        })
                                      }
                                      placeholder="Nombre (opcional)"
                                    />
                                  </div>
                                ) : (
                                  <>
                                    {item.accountCode}
                                    {item.accountName ? ` — ${item.accountName}` : ''}
                                  </>
                                )}
                              </td>
                              <td>{item.confirmationsCount}</td>
                              <td>
                                {isEditing ? (
                                  <div className="account-mapping-rule-card__edit-actions">
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      disabled={isSaving}
                                      onClick={() => void handleSaveEdit()}
                                    >
                                      Guardar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={isSaving}
                                      onClick={() => setEditingItem(null)}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setEditingItem({
                                        supplierDocument: supplier.supplierDocument,
                                        descripcion: item.descripcion,
                                        accountCode: item.accountCode,
                                        accountName: item.accountName ?? '',
                                      })
                                    }
                                  >
                                    Editar
                                  </Button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}

export default AccountMappingRulesPage
