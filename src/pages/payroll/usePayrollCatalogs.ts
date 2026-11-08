import { useCallback, useEffect, useState } from 'react'
import {
  payrollService,
  type PayrollWorkerCatalogs,
} from '../../services/payrollService'
import { getApiErrorMessage } from '../../services/apiClient'
import { fetchJarvisMunicipalities } from '../../services/jarvisService'
import type { JarvisMunicipality } from '../../types/jarvis'
export default function usePayrollCatalogs() {
  const [catalogs, setCatalogs] = useState<PayrollWorkerCatalogs | null>(null),
    [error, setError] = useState('')
  const [municipalities, setMunicipalities] = useState<JarvisMunicipality[]>([])
  const [municipalitiesError, setMunicipalitiesError] = useState('')
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(true)
  const [municipalitiesAttempt, setMunicipalitiesAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void fetchJarvisMunicipalities().then(response => {
      if (!active) return
      setMunicipalities(response.items)
      setMunicipalitiesError('')
    }).catch(error => {
      if (active) setMunicipalitiesError(getApiErrorMessage(error, 'No se pudieron cargar las ciudades.'))
    }).finally(() => { if (active) setMunicipalitiesLoading(false) })
    return () => { active = false }
  }, [municipalitiesAttempt])
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
  return { catalogs, error, reload, municipalities, municipalitiesError, municipalitiesLoading, reloadMunicipalities }
}
