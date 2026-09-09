import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AUTO_DISMISS_TRANSIENT_ERROR_MS,
  useAutoDismissMessage,
} from './useAutoDismissMessage'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { getApiErrorMessage } from '../services/apiClient'
import { parseRegistrationRut } from '../services/authService'
import {
  fetchJarvisAvailableResolutions,
  fetchJarvisCredentialsStatus,
  parseJarvisResolution,
  saveJarvisCredentials,
  saveJarvisResolution,
} from '../services/jarvisService'
import {
  JARVIS_TAX_REGIME,
  JARVIS_TAX_RESPONSIBILITY,
  JARVIS_RESOLUTION_DOCUMENT_TYPES,
  isResolutionOfDocumentType,
  JARVIS_VAT_REGIME,
  type JarvisAvailableResolution,
  type JarvisDianResolution,
  type JarvisTaxRegime,
  type JarvisTaxResponsibility,
  type JarvisVatRegime,
} from '../types/jarvis'

/** Las dos resoluciones (factura y documento soporte) van en UN solo paso:
 * salen de la misma consulta a la DIAN y se eligen de la misma lista, así
 * que separarlas obligaba a pasar dos veces por lo mismo. */
export type JarvisSetupStepId = 'company' | 'resolutions'

export interface JarvisSetupStep {
  id: JarvisSetupStepId
  label: string
  description: string
}

type ResolutionDraft = {
  formNumber: string
  nit: string
  checkDigit: string
  businessName: string
  documentTypeLabel: string
  modalityCode: string
  prefix: string
  fromNumber: string
  toNumber: string
  requestType: string
  year: string
  authorizedAt: string
  technicalKey: string
  dateFrom: string
  dateTo: string
}

const EMPTY_RESOLUTION: ResolutionDraft = {
  formNumber: '',
  nit: '',
  checkDigit: '',
  businessName: '',
  documentTypeLabel: '',
  modalityCode: '',
  prefix: '',
  fromNumber: '',
  toNumber: '',
  requestType: '',
  year: '',
  authorizedAt: '',
  technicalKey: '',
  dateFrom: '',
  dateTo: '',
}

function isJarvisTaxRegime(value: string | null | undefined): value is JarvisTaxRegime {
  return Object.values(JARVIS_TAX_REGIME).includes(value as JarvisTaxRegime)
}

function isJarvisVatRegime(value: string | null | undefined): value is JarvisVatRegime {
  return Object.values(JARVIS_VAT_REGIME).includes(value as JarvisVatRegime)
}

function isJarvisTaxResponsibility(
  value: string | null | undefined,
): value is JarvisTaxResponsibility {
  return Object.values(JARVIS_TAX_RESPONSIBILITY).includes(
    value as JarvisTaxResponsibility,
  )
}

function resolutionToDraft(
  resolution?: JarvisDianResolution | null,
  fallbackLabel = '',
): ResolutionDraft {
  if (!resolution) {
    return {
      ...EMPTY_RESOLUTION,
      documentTypeLabel: fallbackLabel,
    }
  }

  return {
    formNumber: resolution.formNumber ?? '',
    nit: resolution.nit ?? '',
    checkDigit: resolution.checkDigit ?? '',
    businessName: resolution.businessName ?? '',
    documentTypeLabel: resolution.documentTypeLabel || fallbackLabel,
    modalityCode: resolution.modalityCode ?? '',
    prefix: resolution.prefix ?? '',
    fromNumber:
      resolution.nextConsecutive != null
        ? String(resolution.nextConsecutive)
        : resolution.fromNumber != null
          ? String(resolution.fromNumber)
          : '',
    toNumber: resolution.toNumber != null ? String(resolution.toNumber) : '',
    requestType: resolution.requestType ?? '',
    year: resolution.year ?? '',
    authorizedAt: resolution.authorizedAt ?? '',
    technicalKey: resolution.technicalKey ?? '',
    dateFrom: resolution.dateFrom ?? resolution.authorizedAt ?? '',
    dateTo: resolution.dateTo ?? '',
  }
}

function patchResolutionDraft(
  current: ResolutionDraft,
  resolution: JarvisDianResolution,
): ResolutionDraft {
  return {
    formNumber: resolution.formNumber ?? current.formNumber,
    nit: resolution.nit ?? current.nit,
    checkDigit: resolution.checkDigit ?? current.checkDigit,
    businessName: resolution.businessName ?? current.businessName,
    documentTypeLabel:
      resolution.documentTypeLabel || current.documentTypeLabel,
    modalityCode: resolution.modalityCode ?? current.modalityCode,
    prefix: resolution.prefix || current.prefix,
    fromNumber:
      resolution.fromNumber != null
        ? String(resolution.fromNumber)
        : current.fromNumber,
    toNumber:
      resolution.toNumber != null
        ? String(resolution.toNumber)
        : current.toNumber,
    requestType: resolution.requestType ?? current.requestType,
    year: resolution.year ?? current.year,
    authorizedAt: resolution.authorizedAt ?? current.authorizedAt,
    technicalKey: resolution.technicalKey ?? current.technicalKey,
    dateFrom:
      resolution.dateFrom ??
      resolution.authorizedAt ??
      current.dateFrom,
    dateTo: resolution.dateTo ?? current.dateTo,
  }
}

export function useJarvisIntegrationSettings() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const {
    markConfigured,
    refreshSetupStatus,
    isCheckingSetup,
    isJarvisCompanyConfigured,
    isSupportDocumentResolutionConfigured,
    isElectronicInvoiceResolutionConfigured,
    includedDocumentTypes,
    hasSupportDocumentAccess,
    hasPurchaseInvoiceAccess,
    requiresSetup,
  } = useIntegrationSetup()
  const showSetupRequiredNotice = !isCheckingSetup && requiresSetup

  const [businessName, setBusinessName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [economicActivity, setEconomicActivity] = useState('')
  const [taxRegime, setTaxRegime] = useState<JarvisTaxRegime>(
    JARVIS_TAX_REGIME.COMMON,
  )
  const [vatRegime, setVatRegime] = useState<JarvisVatRegime>(
    JARVIS_VAT_REGIME.RESPONSIBLE,
  )
  const [taxResponsibility, setTaxResponsibility] =
    useState<JarvisTaxResponsibility>(JARVIS_TAX_RESPONSIBILITY.NOT_APPLICABLE)
  const [country, setCountry] = useState('Colombia')
  const [department, setDepartment] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [city, setCity] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isParsingRut, setIsParsingRut] = useState(false)
  const [rutFileName, setRutFileName] = useState('')
  const [rutWarnings, setRutWarnings] = useState<string[]>([])
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [activeStepId, setActiveStepId] = useState<JarvisSetupStepId | null>(
    'company',
  )
  const [invoiceResolution, setInvoiceResolution] =
    useState<ResolutionDraft>(EMPTY_RESOLUTION)
  const [supportResolution, setSupportResolution] =
    useState<ResolutionDraft>(EMPTY_RESOLUTION)
  const [invoiceConfigured, setInvoiceConfigured] = useState(false)
  const [supportConfigured, setSupportConfigured] = useState(false)
  const [isParsingResolution, setIsParsingResolution] = useState(false)
  const [isSavingResolution, setIsSavingResolution] = useState(false)
  const [resolutionFileName, setResolutionFileName] = useState('')
  const [resolutionWarnings, setResolutionWarnings] = useState<string[]>([])
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [availableResolutions, setAvailableResolutions] = useState<
    JarvisAvailableResolution[]
  >([])
  const [isLoadingResolutions, setIsLoadingResolutions] = useState(false)
  const [resolutionsError, setResolutionsError] = useAutoDismissMessage(
    AUTO_DISMISS_TRANSIENT_ERROR_MS,
  )
  const [selectedInvoiceResolutionId, setSelectedInvoiceResolutionId] =
    useState('')
  const [selectedSupportResolutionId, setSelectedSupportResolutionId] =
    useState('')

  const steps = useMemo<JarvisSetupStep[]>(() => {
    const nextSteps: JarvisSetupStep[] = [
      {
        id: 'company',
        label: 'Empresa',
        description: 'Datos tributarios iniciales',
      },
    ]

    if (hasPurchaseInvoiceAccess || hasSupportDocumentAccess) {
      nextSteps.push({
        id: 'resolutions',
        label: 'Resoluciones DIAN',
        description: 'Numeración autorizada por tipo de documento',
      })
    }

    return nextSteps
  }, [hasPurchaseInvoiceAccess, hasSupportDocumentAccess])

  const isInvoiceResolutionReady =
    invoiceConfigured || isElectronicInvoiceResolutionConfigured
  const isSupportResolutionReady =
    supportConfigured || isSupportDocumentResolutionConfigured

  const isStepComplete = useCallback(
    (stepId: JarvisSetupStepId) => {
      if (stepId === 'company') return isJarvisCompanyConfigured

      // Solo cuentan los tipos que el plan incluye: con un plan de solo
      // documento soporte, exigir también la de factura dejaría el paso
      // eternamente incompleto.
      return (
        (!hasPurchaseInvoiceAccess || isInvoiceResolutionReady) &&
        (!hasSupportDocumentAccess || isSupportResolutionReady)
      )
    },
    [
      hasPurchaseInvoiceAccess,
      hasSupportDocumentAccess,
      isInvoiceResolutionReady,
      isJarvisCompanyConfigured,
      isSupportResolutionReady,
    ],
  )

  const isStepUnlocked = useCallback(
    (stepId: JarvisSetupStepId) => {
      const index = steps.findIndex((step) => step.id === stepId)
      if (index <= 0) return true

      return steps.slice(0, index).every((step) => isStepComplete(step.id))
    },
    [isStepComplete, steps],
  )

  useEffect(() => {
    if (!user?.company?.id) {
      return
    }

    void (async () => {
      try {
        const status = await fetchJarvisCredentialsStatus()

        if (status.configured) {
          markConfigured()
        }

        if (status.business_name) setBusinessName(status.business_name)
        if (status.trade_name) setTradeName(status.trade_name)
        if (status.economic_activity) setEconomicActivity(status.economic_activity)
        if (status.tax_regime) setTaxRegime(status.tax_regime)
        if (status.vat_regime) setVatRegime(status.vat_regime)
        if (status.tax_responsibility) {
          setTaxResponsibility(status.tax_responsibility)
        }
        if (status.country) setCountry(status.country)
        if (status.department) setDepartment(status.department)
        if (status.municipality) setMunicipality(status.municipality)
        if (status.city) setCity(status.city)
        if (status.email) setEmail(status.email)
        if (status.address) setAddress(status.address)
        if (status.phone) setPhone(status.phone)

        setInvoiceResolution(
          resolutionToDraft(
            status.electronicInvoiceResolution,
            'FACTURA ELECTRÓNICA DE VENTA',
          ),
        )
        setSupportResolution(
          resolutionToDraft(
            status.supportDocumentResolution,
            'DOCUMENTO SOPORTE',
          ),
        )
        setInvoiceConfigured(
          Boolean(status.electronicInvoiceResolutionConfigured),
        )
        setSupportConfigured(
          Boolean(status.supportDocumentResolutionConfigured),
        )
      } catch {
        // El estado global lo resuelve IntegrationSetupContext.
      } finally {
        setStatusLoaded(true)
      }
    })()
  }, [markConfigured, user?.company?.id])

  useEffect(() => {
    if (!statusLoaded || steps.length === 0) {
      return
    }

    const allComplete = steps.every((step) => isStepComplete(step.id))
    if (allComplete) {
      setActiveStepId(null)
      return
    }

    const firstIncomplete = steps.find(
      (step) => !isStepComplete(step.id) && isStepUnlocked(step.id),
    )

    if (firstIncomplete) {
      setActiveStepId(firstIncomplete.id)
    }
    // Solo al cargar estado / cambiar el plan visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot after status/plan
  }, [statusLoaded, steps])

  const handleRutUpload = useCallback(async (file?: File) => {
    if (!file) return

    setErrorMessage(null)
    setSuccessMessage(null)
    setRutWarnings([])

    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setErrorMessage('El RUT debe ser un archivo PDF.')
      return
    }

    setIsParsingRut(true)
    setRutFileName(file.name)

    try {
      const response = await parseRegistrationRut(file)
      const credentials = response.data.jarvisCredentials

      if (credentials.business_name) setBusinessName(credentials.business_name)
      if (credentials.trade_name) setTradeName(credentials.trade_name)
      if (credentials.economic_activity) {
        setEconomicActivity(credentials.economic_activity)
      }
      if (isJarvisTaxRegime(credentials.tax_regime)) {
        setTaxRegime(credentials.tax_regime)
      }
      if (isJarvisVatRegime(credentials.vat_regime)) {
        setVatRegime(credentials.vat_regime)
      }
      if (isJarvisTaxResponsibility(credentials.tax_responsibility)) {
        setTaxResponsibility(credentials.tax_responsibility)
      }
      if (credentials.country) setCountry(credentials.country)
      if (credentials.department) setDepartment(credentials.department)
      if (credentials.municipality) setMunicipality(credentials.municipality)
      if (credentials.city) setCity(credentials.city)
      if (credentials.email) setEmail(credentials.email)
      if (credentials.address) setAddress(credentials.address)
      if (credentials.phone) setPhone(credentials.phone)

      setRutWarnings(response.data.warnings)
      setSuccessMessage(
        'Datos extraídos del RUT. Revise la información antes de guardar.',
      )
    } catch (error) {
      setRutFileName('')
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudieron extraer los datos del RUT.'),
      )
    } finally {
      setIsParsingRut(false)
    }
  }, [])

  const handleResolutionUpload = useCallback(
    async (kind: 'ELECTRONIC_INVOICE' | 'SUPPORT_DOCUMENT', file?: File) => {
      if (!file) return

      setErrorMessage(null)
      setSuccessMessage(null)
      setResolutionWarnings([])

      if (
        file.type !== 'application/pdf' &&
        !file.name.toLowerCase().endsWith('.pdf')
      ) {
        setErrorMessage('La resolución debe ser un archivo PDF.')
        return
      }

      setIsParsingResolution(true)
      setResolutionFileName(file.name)

      try {
        const response = await parseJarvisResolution(file)

        if (response.resolution.kind !== kind) {
          setErrorMessage(
            kind === 'SUPPORT_DOCUMENT'
              ? 'El PDF no corresponde a una resolución de Documento soporte.'
              : 'El PDF no corresponde a una resolución de Factura electrónica.',
          )
          return
        }

        if (kind === 'SUPPORT_DOCUMENT') {
          setSupportResolution((current) =>
            patchResolutionDraft(current, response.resolution),
          )
        } else {
          setInvoiceResolution((current) =>
            patchResolutionDraft(current, response.resolution),
          )
        }

        setResolutionWarnings(response.warnings)
        setSuccessMessage(
          'Datos extraídos de la resolución. Revise la información antes de guardar.',
        )
      } catch (error) {
        setResolutionFileName('')
        setErrorMessage(
          getApiErrorMessage(
            error,
            'No se pudieron extraer los datos de la resolución.',
          ),
        )
      } finally {
        setIsParsingResolution(false)
      }
    },
    [],
  )

  const goToNextStep = useCallback(
    (fromStepId: JarvisSetupStepId) => {
      const currentIndex = steps.findIndex((step) => step.id === fromStepId)
      const nextStep = steps[currentIndex + 1]
      setActiveStepId(nextStep?.id ?? null)
    },
    [steps],
  )

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (isSaving) {
        return
      }

      if (!user?.company) {
        setErrorMessage('No se encontró la empresa asociada a la sesión.')
        setSuccessMessage(null)
        return
      }

      setIsSaving(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      try {
        const response = await saveJarvisCredentials({
          business_name: businessName.trim(),
          ...(tradeName.trim() ? { trade_name: tradeName.trim() } : {}),
          tax_regime: taxRegime,
          vat_regime: vatRegime,
          tax_responsibility: taxResponsibility,
          economic_activity: economicActivity.trim(),
          country: country.trim(),
          department: department.trim(),
          municipality: municipality.trim(),
          city: city.trim(),
          email: email.trim(),
          address: address.trim(),
          phone: phone.trim(),
        })

        markConfigured()
        setSuccessMessage(
          `Configuración de empresa guardada para ${response.business_name}.`,
        )
        await refreshSetupStatus()
        goToNextStep('company')
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'No se pudo guardar la configuración inicial.',
          ),
        )
      } finally {
        setIsSaving(false)
      }
    },
    [
      address,
      businessName,
      city,
      country,
      department,
      economicActivity,
      email,
      goToNextStep,
      isSaving,
      markConfigured,
      municipality,
      phone,
      refreshSetupStatus,
      taxRegime,
      taxResponsibility,
      tradeName,
      user?.company,
      vatRegime,
    ],
  )

  // Cada selector lista SOLO las resoluciones de su tipo de documento. La
  // consulta trae todos los tipos de la empresa (nómina, notas, POS,
  // exportación...), y ofrecerlos para facturar llevaría a emitir contra una
  // numeración que no corresponde.
  const invoiceResolutionOptions = useMemo(
    () =>
      availableResolutions.filter((resolution) =>
        isResolutionOfDocumentType(
          resolution,
          JARVIS_RESOLUTION_DOCUMENT_TYPES.ELECTRONIC_INVOICE,
        ),
      ),
    [availableResolutions],
  )
  const supportResolutionOptions = useMemo(
    () =>
      availableResolutions.filter((resolution) =>
        isResolutionOfDocumentType(
          resolution,
          JARVIS_RESOLUTION_DOCUMENT_TYPES.SUPPORT_DOCUMENT,
        ),
      ),
    [availableResolutions],
  )

  const loadAvailableResolutions = useCallback(async () => {
    setIsLoadingResolutions(true)
    setResolutionsError(null)

    try {
      const response = await fetchJarvisAvailableResolutions()
      setAvailableResolutions(response.resolutions)
    } catch {
      // Mensaje fijo a propósito: el detalle del error (ruta, estado HTTP,
      // cuerpo del proxy) no le sirve al contador y solo expone plomería.
      setAvailableResolutions([])
      setResolutionsError(
        'No se pudieron consultar las resoluciones. Intenta de nuevo.',
      )
    } finally {
      setIsLoadingResolutions(false)
    }
  }, [])

  // Se consultan una vez que la empresa ya está guardada: antes de eso
  // NextPyme todavía no tiene con qué responder por esta empresa.
  useEffect(() => {
    if (!isJarvisCompanyConfigured) {
      return
    }

    void loadAvailableResolutions()
  }, [isJarvisCompanyConfigured, loadAvailableResolutions])

  /** Vuelca la resolución elegida sobre el borrador que ya usa el guardado,
   * en vez de duplicar la lógica de envío: el paso queda igual que antes,
   * solo cambia de dónde salen los datos (antes, del PDF transcrito). */
  const handleSelectResolution = useCallback(
    (kind: 'ELECTRONIC_INVOICE' | 'SUPPORT_DOCUMENT', resolutionId: string) => {
      const setSelectedId =
        kind === 'SUPPORT_DOCUMENT'
          ? setSelectedSupportResolutionId
          : setSelectedInvoiceResolutionId
      const setDraft =
        kind === 'SUPPORT_DOCUMENT' ? setSupportResolution : setInvoiceResolution

      setSelectedId(resolutionId)

      const resolution = availableResolutions.find(
        (item) => item.id === resolutionId,
      )

      if (!resolution) {
        return
      }

      setDraft((current) => ({
        ...current,
        formNumber: resolution.formNumber ?? '',
        documentTypeLabel:
          resolution.documentTypeLabel?.trim() ||
          (kind === 'SUPPORT_DOCUMENT'
            ? 'DOCUMENTO SOPORTE'
            : 'FACTURA ELECTRÓNICA DE VENTA'),
        prefix: resolution.prefix,
        // El borrador guarda en fromNumber el PRÓXIMO consecutivo a emitir,
        // no el inicio del rango autorizado (ver resolutionToDraft).
        fromNumber: String(resolution.nextConsecutive ?? resolution.fromNumber),
        toNumber: String(resolution.toNumber),
        authorizedAt: resolution.authorizedAt ?? '',
        year: (resolution.authorizedAt ?? resolution.dateFrom)?.slice(0, 4) ?? '',
        technicalKey: resolution.technicalKey ?? '',
        dateFrom: resolution.dateFrom ?? resolution.authorizedAt ?? '',
        dateTo: resolution.dateTo ?? '',
      }))
    },
    [availableResolutions],
  )

  /** Valida y envía UNA resolución. Devuelve el mensaje de error si algo
   * falta, o null si quedó guardada. */
  const saveResolutionDraft = useCallback(
    async (
      kind: 'ELECTRONIC_INVOICE' | 'SUPPORT_DOCUMENT',
      draft: ResolutionDraft,
    ): Promise<string | null> => {
      const label =
        kind === 'SUPPORT_DOCUMENT'
          ? 'documento soporte'
          : 'factura electrónica'
      const fromNumber = Number(draft.fromNumber)
      const toNumber = Number(draft.toNumber)

      if (!draft.prefix.trim() || !draft.formNumber.trim()) {
        return `Elige la resolución de ${label}.`
      }

      // Documento soporte no lleva clave técnica: la DIAN solo se la asigna
      // a las resoluciones de factura electrónica.
      if (kind === 'ELECTRONIC_INVOICE' && !draft.technicalKey.trim()) {
        return 'La resolución de factura electrónica debe traer clave técnica.'
      }

      if (!draft.dateFrom.trim() || !draft.dateTo.trim()) {
        return `La resolución de ${label} no trae fechas de vigencia.`
      }

      if (
        !Number.isFinite(fromNumber) ||
        fromNumber < 1 ||
        !Number.isFinite(toNumber) ||
        toNumber < fromNumber
      ) {
        return `El rango de numeración de ${label} es inválido.`
      }

      const response = await saveJarvisResolution({
        kind,
        formNumber: draft.formNumber.trim(),
        nit: draft.nit.trim() || undefined,
        checkDigit: draft.checkDigit.trim() || undefined,
        businessName: draft.businessName.trim() || undefined,
        documentTypeLabel:
          draft.documentTypeLabel.trim() ||
          (kind === 'SUPPORT_DOCUMENT'
            ? 'DOCUMENTO SOPORTE'
            : 'FACTURA ELECTRÓNICA DE VENTA'),
        modalityCode: draft.modalityCode.trim() || undefined,
        prefix: draft.prefix.trim().toUpperCase(),
        fromNumber,
        toNumber,
        requestType: draft.requestType.trim() || undefined,
        year: draft.year.trim() || undefined,
        authorizedAt:
          draft.authorizedAt.trim() || draft.dateFrom.trim() || undefined,
        technicalKey: draft.technicalKey.trim() || undefined,
        dateFrom: draft.dateFrom.trim(),
        dateTo: draft.dateTo.trim(),
      })

      if (kind === 'SUPPORT_DOCUMENT') {
        setSupportConfigured(true)
        setSupportResolution(resolutionToDraft(response.resolution))
      } else {
        setInvoiceConfigured(true)
        setInvoiceResolution(resolutionToDraft(response.resolution))
      }

      return null
    },
    [],
  )

  /** Guarda las dos resoluciones del paso en un solo envío. Se manda una por
   * una porque el backend persiste cada tipo por separado; si la primera
   * falla se corta ahí, para no dejar media configuración guardada sin que
   * el usuario se entere. */
  const handleResolutionsSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (isSavingResolution) {
        return
      }

      // Solo se envía lo que el usuario haya elegido: puede guardar una
      // resolución hoy y la otra después, sin quedar bloqueado por la que
      // todavía no tiene a mano.
      const pending: Array<
        ['ELECTRONIC_INVOICE' | 'SUPPORT_DOCUMENT', ResolutionDraft]
      > = []

      if (hasPurchaseInvoiceAccess && selectedInvoiceResolutionId) {
        pending.push(['ELECTRONIC_INVOICE', invoiceResolution])
      }

      if (hasSupportDocumentAccess && selectedSupportResolutionId) {
        pending.push(['SUPPORT_DOCUMENT', supportResolution])
      }

      if (pending.length === 0) {
        setErrorMessage('Elige al menos una resolución para guardar.')
        return
      }

      setIsSavingResolution(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      try {
        for (const [kind, draft] of pending) {
          const validationError = await saveResolutionDraft(kind, draft)

          if (validationError) {
            setErrorMessage(validationError)
            return
          }
        }

        setSuccessMessage(
          pending.length > 1
            ? 'Resoluciones guardadas correctamente.'
            : 'Resolución guardada correctamente.',
        )
        await refreshSetupStatus()

        // Se cierra el paso solo si ya quedaron TODAS las que el plan pide.
        // Guardando una sola, colapsar la sección dejaría al usuario buscando
        // cómo volver para configurar la que falta.
        const invoiceReady =
          !hasPurchaseInvoiceAccess ||
          isInvoiceResolutionReady ||
          pending.some(([kind]) => kind === 'ELECTRONIC_INVOICE')
        const supportReady =
          !hasSupportDocumentAccess ||
          isSupportResolutionReady ||
          pending.some(([kind]) => kind === 'SUPPORT_DOCUMENT')

        if (invoiceReady && supportReady) {
          goToNextStep('resolutions')
        }
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'No se pudo guardar la resolución. Intenta nuevamente.',
          ),
        )
      } finally {
        setIsSavingResolution(false)
      }
    },
    [
      goToNextStep,
      hasPurchaseInvoiceAccess,
      hasSupportDocumentAccess,
      invoiceResolution,
      isInvoiceResolutionReady,
      isSavingResolution,
      isSupportResolutionReady,
      refreshSetupStatus,
      saveResolutionDraft,
      selectedInvoiceResolutionId,
      selectedSupportResolutionId,
      supportResolution,
    ],
  )

  const isBusy =
    isAuthLoading ||
    isSaving ||
    isParsingRut ||
    isParsingResolution ||
    isSavingResolution

  const allRequiredStepsComplete = steps.every((step) =>
    isStepComplete(step.id),
  )

  return {
    isAuthLoading,
    hasCompany: Boolean(user?.company),
    businessName,
    tradeName,
    economicActivity,
    taxRegime,
    vatRegime,
    taxResponsibility,
    country,
    department,
    municipality,
    city,
    email,
    address,
    phone,
    isSaving,
    isParsingRut,
    rutFileName,
    rutWarnings,
    isBusy,
    successMessage,
    showSetupRequiredNotice,
    isJarvisConfigured: isJarvisCompanyConfigured,
    isJarvisCompanyConfigured,
    errorMessage,
    includedDocumentTypes,
    hasSupportDocumentAccess,
    hasPurchaseInvoiceAccess,
    steps,
    activeStepId,
    setActiveStepId,
    isStepComplete,
    isStepUnlocked,
    invoiceResolution,
    supportResolution,
    setInvoiceResolution,
    setSupportResolution,
    invoiceConfigured,
    supportConfigured,
    isParsingResolution,
    isSavingResolution,
    resolutionFileName,
    resolutionWarnings,
    availableResolutions,
    invoiceResolutionOptions,
    supportResolutionOptions,
    isLoadingResolutions,
    resolutionsError,
    selectedInvoiceResolutionId,
    selectedSupportResolutionId,
    handleSelectResolution,
    reloadAvailableResolutions: loadAvailableResolutions,
    allRequiredStepsComplete,
    setBusinessName,
    setTradeName,
    setEconomicActivity,
    setTaxRegime,
    setVatRegime,
    setTaxResponsibility,
    setCountry,
    setDepartment,
    setMunicipality,
    setCity,
    setEmail,
    setAddress,
    setPhone,
    handleRutUpload,
    handleResolutionUpload,
    handleSubmit,
    handleResolutionsSubmit,
  }
}
