import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import CategorySelect from '../../components/CategorySelect'
import { getApiErrorMessage } from '../../services/apiClient'
import { payrollService, peekPayrollPaymentMethods, type PayrollPaymentMethod } from '../../services/payrollService'

export default function PayrollPaymentMethodSelect({ value, savedId, savedName, onChange, required = false, readOnly = false }: {
  value: number
  savedId?: string
  savedName?: string
  onChange?: (method: PayrollPaymentMethod | null) => void
  required?: boolean
  readOnly?: boolean
}) {
  const { user } = useAuth()
  const companyId = user?.company?.id
  const currentCompany = useRef(companyId)
  useLayoutEffect(() => { currentCompany.current = companyId; return () => { currentCompany.current = undefined } }, [companyId])
  const [entry, setEntry] = useState<{ companyId: string | undefined; items: PayrollPaymentMethod[]; error: string } | null>(() => {
    const cached = peekPayrollPaymentMethods()
    return cached ? { companyId, items: cached.items, error: '' } : null
  })
  const [attempt, setAttempt] = useState(0)
  const [base, setBase] = useState<'cash' | 'transfer'>('transfer')
  const createdMethod = useRef<PayrollPaymentMethod | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const [selectionError, setSelectionError] = useState(false)
  useEffect(() => {
    let active = true
    createdMethod.current = null
    void payrollService.paymentMethods({ force: attempt > 0 })
      .then(result => { if (active) setEntry({ companyId, items: (peekPayrollPaymentMethods() ?? result).items, error: '' }) })
      .catch(error => {
        if (active) setEntry({ companyId, items: peekPayrollPaymentMethods()?.items ?? [], error: getApiErrorMessage(error, 'No se pudieron cargar las formas de pago.') })
      })
    return () => { active = false }
  }, [companyId, attempt])
  const loaded = entry?.companyId === companyId ? entry : null
  const methods = loaded?.items ?? []
  // Los registros anteriores guardaban el ID del catálogo de facturas; se conserva el código compatible.
  const selected = methods.find(method => method.id === savedId) ?? methods.find(method => method.nextpymeMethodId === value && method.systemKey !== null)
  useEffect(() => {
    if (!readOnly && loaded && !loaded.error && value && !selected) onChange?.(null)
  }, [readOnly, loaded, value, selected, onChange])
  if (readOnly) return <input readOnly value={savedName || selected?.name || (value ? 'Forma de pago no disponible' : 'Sin configurar')} />
  return <div className="payroll__payment-select" ref={root}>
    {required && <input className="payroll__payment-validation" type="text" aria-hidden="true" tabIndex={-1} required value={selected?.id ?? ''} onChange={() => {}} onInvalid={event => {
      event.preventDefault()
      setSelectionError(true)
      root.current?.querySelector<HTMLButtonElement>('.category-select__control')?.focus()
    }} />}
    <CategorySelect
      value={selected?.id ?? ''}
      categories={methods}
      itemLabel="forma de pago"
      placeholder={!loaded ? 'Cargando formas de pago…' : 'Seleccionar'}
      disabled={!loaded || Boolean(loaded.error && !methods.length)}
      invalid={selectionError && !selected}
      onChange={id => onChange?.(methods.find(method => method.id === id) ?? (createdMethod.current?.id === id ? createdMethod.current : null))}
      onCreate={async name => {
        try {
          const created = await payrollService.createPaymentMethod({ name, base })
          if (currentCompany.current !== companyId) throw new Error('La empresa activa cambió. Vuelve a abrir el selector.')
          createdMethod.current = created
          setEntry(previous => previous && previous.companyId === companyId ? { ...previous, items: [...previous.items, created], error: '' } : previous)
          return created
        } catch (error) {
          throw new Error(getApiErrorMessage(error, 'No se pudo crear la forma de pago.'), { cause: error })
        }
      }}
      createFields={<label className="category-select__editor-field"><span>Medio de pago</span><select value={base} onChange={event => setBase(event.target.value as 'cash' | 'transfer')}><option value="cash">Efectivo</option><option value="transfer">Transferencia bancaria</option></select></label>}
    />
    {selectionError && !selected && <span role="alert">Selecciona una forma de pago de nómina.</span>}
    {loaded?.error && <span role="alert">{methods.length ? 'No se pudo actualizar la lista. Se muestran las formas de pago guardadas.' : loaded.error} <button type="button" className="payroll__link" onClick={() => setAttempt(count => count + 1)}>Reintentar</button></span>}
  </div>
}
