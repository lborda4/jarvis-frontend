import { useCallback, useEffect, useState } from 'react'
import {
  payrollService,
  type PayrollWorkerCatalogs,
} from '../../services/payrollService'
import { getApiErrorMessage } from '../../services/apiClient'
export default function usePayrollCatalogs() {
  const [catalogs, setCatalogs] = useState<PayrollWorkerCatalogs | null>(null),
    [error, setError] = useState('')
  const reload = useCallback(async () => {
    try {
      const value = await payrollService.workerCatalogs()
      setCatalogs(value)
      setError('')
    } catch (e) {
      setError(
        getApiErrorMessage(e, 'No se pudieron cargar los catálogos de nómina.'),
      )
    }
  }, [])
  useEffect(() => {
    let active = true
    void payrollService
      .workerCatalogs()
      .then((value) => {
        if (active) {
          setCatalogs(value)
          setError('')
        }
      })
      .catch(() => {
        if (active) setError('No se pudieron cargar los catálogos de nómina.')
      })
    return () => {
      active = false
    }
  }, [])
  return { catalogs, error, reload }
}
