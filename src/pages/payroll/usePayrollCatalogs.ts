import { useCallback, useEffect, useState } from 'react'
import {
  payrollService,
  type PayrollWorkerCatalogs,
} from '../../services/payrollService'
import { fetchJarvisMunicipalities } from '../../services/jarvisService'
import type { JarvisMunicipality } from '../../types/jarvis'
const OPTIONS_ERROR = 'No pudimos cargar las opciones para registrar el empleado. Inténtalo de nuevo. Si el problema continúa, comunícate con soporte.'
export default function usePayrollCatalogs(enabled: boolean, onLoaded?: (value: PayrollWorkerCatalogs) => void) {
  const [catalogs, setCatalogs] = useState<PayrollWorkerCatalogs | null>(null),
    [error, setError] = useState('')
  const [municipalities, setMunicipalities] = useState<JarvisMunicipality[]>([])
  const [municipalitiesError, setMunicipalitiesError] = useState('')
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(true)
  const [municipalitiesAttempt, setMunicipalitiesAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let active = true
    void fetchJarvisMunicipalities().then(response => {
      if (!active) return
      setMunicipalities(response.items)
      setMunicipalitiesError('')
    }).catch(() => {
      if (active) setMunicipalitiesError('No pudimos cargar las ciudades. Inténtalo de nuevo. Si el problema continúa, comunícate con soporte.')
    }).finally(() => { if (active) setMunicipalitiesLoading(false) })
    return () => { active = false }
  }, [enabled, municipalitiesAttempt])
  const reloadMunicipalities = () => {
    setMunicipalitiesLoading(true)
    setMunicipalitiesError('')
    setMunicipalitiesAttempt(attempt => attempt + 1)
  }
  const reload = useCallback(async () => {
    try {
      const value = await payrollService.workerCatalogs()
      setCatalogs(value)
      setError('')
      onLoaded?.(value)
      return value
    } catch {
      setError(OPTIONS_ERROR)
    }
  }, [onLoaded])
  useEffect(() => {
    if (!enabled) return
    let active = true
    void payrollService
      .workerCatalogs()
      .then((value) => {
        if (active) {
          setCatalogs(value)
          setError('')
          onLoaded?.(value)
        }
      })
      .catch(() => {
        if (active) setError(OPTIONS_ERROR)
      })
    return () => {
      active = false
    }
  }, [enabled, onLoaded])
  return { catalogs, error, reload, municipalities, municipalitiesError, municipalitiesLoading, reloadMunicipalities }
}
