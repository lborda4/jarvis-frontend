import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Autocomplete from '../components/Autocomplete'
import Button from '../components/Button'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import PageHeader from '../components/PageHeader'
import SuccessMessage from '../components/SuccessMessage'
import { useAuth } from '../context/AuthContext'
import {
  createAdminCompany,
  fetchAdminCities,
  fetchAdminCompanies,
  fetchAdminPlans,
  fetchBoldBindedTerminals,
  fetchBoldCashRegisters,
  lookupAdminCompanyName,
  parseAdminCompanyRut,
  regenerateCompanyInviteCode,
  saveBoldCashRegister,
  updateCompanyCity,
  updateCompanyNextPymeToken,
  updateIntegrationSubscription,
} from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import {
  COMPANY_PERSON_TYPE,
  ELECTRONIC_DOCUMENT_TYPE,
  INTEGRATION_PROVIDER,
  SUBSCRIPTION_STATUS,
  type AdminCityOption,
  type AdminCompanyListItem,
  type AdminIntegrationItem,
  type AdminPlan,
  type BoldCashRegister,
  type BoldTerminal,
  type CompanyPersonType,
  type ElectronicDocumentType,
  type IntegrationProvider,
  type JarvisCredentialsSeed,
  type SubscriptionStatus,
} from '../types/admin'
import { toJarvisCredentialsSeed } from '../utils/toJarvisCredentialsSeed'
import './AdminPage.css'

const AVAILABLE_DOCUMENT_TYPES: Array<{
  value: ElectronicDocumentType
  label: string
}> = [
  {
    value: ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT,
    label: 'Documento soporte',
  },
  {
    value: ELECTRONIC_DOCUMENT_TYPE.PURCHASE_INVOICE,
    label: 'Factura de compra',
  },
]

/** Borrador de la fila "nueva caja" al final de la tabla — texto libre
 * mientras se edita, se valida/convierte recién al guardar. */
interface BoldCashRegisterDraft {
  branchOfficeId: string
  cashRegisterId: string
  cashRegisterName: string
  boldTerminalId: string
}

const EMPTY_CASH_REGISTER_DRAFT: BoldCashRegisterDraft = {
  branchOfficeId: '',
  cashRegisterId: '',
  cashRegisterName: '',
  boldTerminalId: '',
}

function formatDocumentLimit(limit: number | null | undefined): string {
  if (limit == null) {
    return 'Sin límite'
  }

  return `${limit} docs`
}

function formatPlanName(plan: AdminPlan): string {
  return plan.name
}

function formatProviderLabel(provider: IntegrationProvider): string {
  if (provider === INTEGRATION_PROVIDER.SIIGO) return 'SIIGO'
  if (provider === INTEGRATION_PROVIDER.BOLD) return 'Bold'
  return 'Jarvis'
}

function formatPersonType(personType: CompanyPersonType | null): string {
  if (personType === COMPANY_PERSON_TYPE.NATURAL_PERSON) {
    return 'Persona natural'
  }

  if (personType === COMPANY_PERSON_TYPE.LEGAL_ENTITY) {
    return 'Persona jurídica'
  }

  return '—'
}

function formatIntegrations(company: AdminCompanyListItem): string {
  if (company.integrations.length === 0) {
    return '—'
  }

  return company.integrations
    .map((integration) => formatProviderLabel(integration.provider))
    .join(' · ')
}

function formatResponsible(
  responsible: AdminCompanyListItem['responsible'],
): string {
  if (!responsible) {
    return '—'
  }

  return `${responsible.name} · ${responsible.phone} · ${responsible.email}`
}

function AdminPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<AdminCompanyListItem[]>([])
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [cities, setCities] = useState<AdminCityOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isParsingRut, setIsParsingRut] = useState(false)
  const [updatingIntegrationId, setUpdatingIntegrationId] = useState<
    string | null
  >(null)
  const [regeneratingCompanyId, setRegeneratingCompanyId] = useState<
    string | null
  >(null)
  const [copiedCompanyId, setCopiedCompanyId] = useState<string | null>(null)
  const [editingTokenCompanyId, setEditingTokenCompanyId] = useState<
    string | null
  >(null)
  const [tokenDraft, setTokenDraft] = useState('')
  const [savingTokenCompanyId, setSavingTokenCompanyId] = useState<
    string | null
  >(null)
  const [editingCityCompanyId, setEditingCityCompanyId] = useState<
    string | null
  >(null)
  const [cityDraft, setCityDraft] = useState<AdminCityOption | null>(null)
  const [savingCityCompanyId, setSavingCityCompanyId] = useState<
    string | null
  >(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  // Panel de Bold (caja/datáfonos) por empresa — la llave de identidad no se
  // persiste todavía (ver ensureBoldIntegration en el backend), así que vive
  // solo en memoria del navegador mientras dura la sesión del admin.
  const [expandedBoldCompanyId, setExpandedBoldCompanyId] = useState<
    string | null
  >(null)
  const [boldApiKeyByCompanyId, setBoldApiKeyByCompanyId] = useState<
    Record<string, string>
  >({})
  const [boldTerminalsByCompanyId, setBoldTerminalsByCompanyId] = useState<
    Record<string, BoldTerminal[]>
  >({})
  const [loadingBoldTerminalsCompanyId, setLoadingBoldTerminalsCompanyId] =
    useState<string | null>(null)
  const [boldTerminalsErrorByCompanyId, setBoldTerminalsErrorByCompanyId] =
    useState<Record<string, string | null>>({})
  const [boldCashRegistersByCompanyId, setBoldCashRegistersByCompanyId] =
    useState<Record<string, BoldCashRegister[]>>({})
  const [
    loadingBoldCashRegistersCompanyId,
    setLoadingBoldCashRegistersCompanyId,
  ] = useState<string | null>(null)
  const [
    boldCashRegistersErrorByCompanyId,
    setBoldCashRegistersErrorByCompanyId,
  ] = useState<Record<string, string | null>>({})
  const [newCashRegisterDraftByCompanyId, setNewCashRegisterDraftByCompanyId] =
    useState<Record<string, BoldCashRegisterDraft>>({})
  const [savingCashRegisterCompanyId, setSavingCashRegisterCompanyId] =
    useState<string | null>(null)
  const [nit, setNit] = useState('')
  const [name, setName] = useState('')
  const [isLookingUpName, setIsLookingUpName] = useState(false)
  const [personType, setPersonType] = useState<CompanyPersonType | ''>('')
  const [responsibleName, setResponsibleName] = useState('')
  const [responsiblePhone, setResponsiblePhone] = useState('')
  const [responsibleEmail, setResponsibleEmail] = useState('')
  const [rutFileName, setRutFileName] = useState('')
  const [rutAddress, setRutAddress] = useState<string | null>(null)
  const [rutWarnings, setRutWarnings] = useState<string[]>([])
  const [jarvisCredentials, setJarvisCredentials] =
    useState<JarvisCredentialsSeed | undefined>()
  const [idSoftware, setIdSoftware] = useState('')
  const [tokenNextPyme, setTokenNextPyme] = useState('')
  const [selectedCity, setSelectedCity] = useState<AdminCityOption | null>(
    null,
  )
  // Token NextPyme de la empresa (independiente de jarvisCredentials.tokenNextPyme
  // de arriba) — el que usa la consulta de Factura de compra por CUFE, para
  // cualquier proveedor (SIIGO o Jarvis). Antes solo se podía configurar
  // después de crear la empresa, desde la columna de la tabla.
  const [companyNextPymeToken, setCompanyNextPymeToken] = useState('')
  // Llave de identidad (x-api-key) de Bold para esta empresa — igual que el
  // resto del panel de Bold, no se persiste en BD todavía (ver
  // ensureBoldIntegration en el backend); al crear la empresa solo queda
  // precargada en memoria (boldApiKeyByCompanyId) para no tener que
  // volver a escribirla al abrir su panel de cajas/datáfonos.
  const [companyBoldApiKey, setCompanyBoldApiKey] = useState('')
  const [siigoPlanId, setSiigoPlanId] = useState('')
  const [jarvisPlanId, setJarvisPlanId] = useState('')
  const [selectedDocumentTypes, setSelectedDocumentTypes] = useState<
    ElectronicDocumentType[]
  >([ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT])
  const [selectedIntegrations, setSelectedIntegrations] = useState<
    IntegrationProvider[]
  >([INTEGRATION_PROVIDER.SIIGO])

  const siigoPlans = useMemo(
    () => plans.filter((plan) => plan.provider === INTEGRATION_PROVIDER.SIIGO),
    [plans],
  )
  const jarvisPlans = useMemo(
    () => plans.filter((plan) => plan.provider === INTEGRATION_PROVIDER.JARVIS),
    [plans],
  )

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [companiesResponse, plansResponse, citiesResponse] =
        await Promise.all([
          fetchAdminCompanies(),
          fetchAdminPlans(),
          fetchAdminCities(),
        ])

      setCompanies(companiesResponse.items)
      setPlans(plansResponse.items)
      setCities(citiesResponse.items)

      const firstSiigoPlan = plansResponse.items.find(
        (plan) => plan.provider === INTEGRATION_PROVIDER.SIIGO,
      )
      const firstJarvisPlan = plansResponse.items.find(
        (plan) => plan.provider === INTEGRATION_PROVIDER.JARVIS,
      )

      if (firstSiigoPlan) {
        setSiigoPlanId((current) => current || firstSiigoPlan.id)
      }
      if (firstJarvisPlan) {
        setJarvisPlanId((current) => current || firstJarvisPlan.id)
      }
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudieron cargar los datos del panel.'),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const toggleIntegration = (provider: IntegrationProvider) => {
    setSelectedIntegrations((current) => {
      if (current.includes(provider)) {
        return current.filter((item) => item !== provider)
      }

      return [...current, provider]
    })
  }

  const toggleCreateDocumentType = (documentType: ElectronicDocumentType) => {
    setSelectedDocumentTypes((current) => {
      if (current.includes(documentType)) {
        return current.filter((item) => item !== documentType)
      }

      return [...current, documentType]
    })
  }

  /** Al salir del campo NIT, busca la razón social en el RUT/RUES de la DIAN
   * y precarga "Nombre" — solo si el admin todavía no escribió nada ahí a
   * mano (no le pisa una edición manual) y no encontró nada, se queda en
   * blanco para llenarlo como siempre. */
  const handleNitBlur = async () => {
    const trimmedNit = nit.trim()

    if (!trimmedNit || name.trim()) {
      return
    }

    setIsLookingUpName(true)

    try {
      const response = await lookupAdminCompanyName(trimmedNit)

      if (response.name && !name.trim()) {
        setName(response.name)
      }
    } catch {
      // Silencioso: el admin puede llenar el nombre a mano igual que hoy.
    } finally {
      setIsLookingUpName(false)
    }
  }

  const handleRutUpload = async (file?: File) => {
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
      const response = await parseAdminCompanyRut(file)
      const rut = response.data

      setNit(rut.nit)
      setName(rut.name)
      setPersonType(rut.personType)
      setResponsibleName(rut.responsibleName ?? '')
      setResponsiblePhone(rut.phone ?? '')
      setResponsibleEmail(rut.email ?? '')
      setRutAddress(rut.address)
      setRutWarnings(rut.warnings)
      setJarvisCredentials(toJarvisCredentialsSeed(rut.jarvisCredentials))
      setSuccessMessage(
        'Datos extraídos del RUT. Revise la información antes de crear la empresa.',
      )
    } catch (error) {
      setRutFileName('')
      setRutAddress(null)
      setJarvisCredentials(undefined)
      setErrorMessage(
        getApiErrorMessage(
          error,
          'No se pudieron extraer los datos del RUT.',
        ),
      )
    } finally {
      setIsParsingRut(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      const includesSiigo = selectedIntegrations.includes(
        INTEGRATION_PROVIDER.SIIGO,
      )
      const includesJarvis = selectedIntegrations.includes(
        INTEGRATION_PROVIDER.JARVIS,
      )
      const trimmedIdSoftware = idSoftware.trim()
      const trimmedTokenNextPyme = tokenNextPyme.trim()
      const mergedJarvisCredentials: JarvisCredentialsSeed | undefined =
        includesJarvis
          ? {
              ...(jarvisCredentials ?? {}),
              ...(trimmedIdSoftware ? { idSoftware: trimmedIdSoftware } : {}),
              ...(trimmedTokenNextPyme
                ? { tokenNextPyme: trimmedTokenNextPyme }
                : {}),
            }
          : undefined
      const hasJarvisCredentials =
        Boolean(mergedJarvisCredentials) &&
        Object.values(mergedJarvisCredentials ?? {}).some(
          (value) => typeof value === 'string' && value.trim().length > 0,
        )

      const response = await createAdminCompany({
        nit: nit.trim(),
        name: name.trim(),
        personType: personType as CompanyPersonType,
        ...(responsibleName.trim() ||
        responsiblePhone.trim() ||
        responsibleEmail.trim()
          ? {
              responsible: {
                name: responsibleName.trim(),
                phone: responsiblePhone.trim(),
                email: responsibleEmail.trim(),
              },
            }
          : {}),
        integrations: selectedIntegrations,
        ...(includesSiigo
          ? {
              siigoPlanId,
            }
          : {}),
        ...(includesJarvis
          ? {
              jarvisPlanId,
            }
          : {}),
        ...((includesSiigo || includesJarvis) && selectedDocumentTypes.length > 0
          ? { includedDocumentTypes: selectedDocumentTypes }
          : {}),
        ...(hasJarvisCredentials
          ? { jarvisCredentials: mergedJarvisCredentials }
          : {}),
        ...(selectedCity
          ? { cityCode: selectedCity.code, cityName: selectedCity.name }
          : {}),
        ...(companyNextPymeToken.trim()
          ? { nextPymeToken: companyNextPymeToken.trim() }
          : {}),
      })

      setCompanies((current) => [response.company, ...current])
      setSuccessMessage(`Empresa ${response.company.name} creada correctamente.`)

      if (selectedIntegrations.includes(INTEGRATION_PROVIDER.BOLD)) {
        const trimmedBoldApiKey = companyBoldApiKey.trim()

        if (trimmedBoldApiKey) {
          setBoldApiKeyByCompanyId((current) => ({
            ...current,
            [response.company.id]: trimmedBoldApiKey,
          }))
        }
      }

      setNit('')
      setName('')
      setPersonType('')
      setResponsibleName('')
      setResponsiblePhone('')
      setResponsibleEmail('')
      setRutFileName('')
      setRutAddress(null)
      setRutWarnings([])
      setJarvisCredentials(undefined)
      setIdSoftware('')
      setTokenNextPyme('')
      setCompanyNextPymeToken('')
      setCompanyBoldApiKey('')
      setSelectedCity(null)
      setSelectedIntegrations([INTEGRATION_PROVIDER.SIIGO])
      setSelectedDocumentTypes([ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT])
      setSiigoPlanId(siigoPlans[0]?.id ?? '')
      setJarvisPlanId(jarvisPlans[0]?.id ?? '')
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo crear la empresa.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const applyIntegrationUpdate = (
    companyId: string,
    integrationId: string,
    updatedIntegration: AdminIntegrationItem,
  ) => {
    setCompanies((current) =>
      current.map((item) => {
        if (item.id !== companyId) {
          return item
        }

        return {
          ...item,
          integrations: item.integrations.map((currentIntegration) =>
            currentIntegration.id === integrationId
              ? updatedIntegration
              : currentIntegration,
          ),
        }
      }),
    )
  }

  const handleSubscriptionStatusChange = async (
    company: AdminCompanyListItem,
    integration: AdminIntegrationItem,
    subscriptionStatus: SubscriptionStatus,
  ) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setUpdatingIntegrationId(integration.id)

    try {
      const response = await updateIntegrationSubscription(
        company.id,
        integration.provider,
        { subscriptionStatus },
      )

      applyIntegrationUpdate(company.id, integration.id, response.integration)
      setSuccessMessage(
        `Suscripción ${formatProviderLabel(integration.provider)} actualizada a ${subscriptionStatus}.`,
      )
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo actualizar la suscripción.'),
      )
    } finally {
      setUpdatingIntegrationId(null)
    }
  }

  const handlePlanChange = async (
    company: AdminCompanyListItem,
    integration: AdminIntegrationItem,
    planId: string,
  ) => {
    if (!planId || planId === integration.plan?.id) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setUpdatingIntegrationId(integration.id)

    try {
      const response = await updateIntegrationSubscription(
        company.id,
        integration.provider,
        { planId },
      )

      applyIntegrationUpdate(company.id, integration.id, response.integration)
      setSuccessMessage(
        `Plan ${formatProviderLabel(integration.provider)} actualizado para ${company.name}.`,
      )
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo actualizar el plan.'),
      )
    } finally {
      setUpdatingIntegrationId(null)
    }
  }

  const handleCopyInviteCode = async (company: AdminCompanyListItem) => {
    try {
      await navigator.clipboard.writeText(company.inviteCode)
      setCopiedCompanyId(company.id)
      window.setTimeout(() => {
        setCopiedCompanyId((current) =>
          current === company.id ? null : current,
        )
      }, 2000)
    } catch {
      setErrorMessage('No se pudo copiar el código. Cópialo manualmente.')
    }
  }

  const handleRegenerateInviteCode = async (company: AdminCompanyListItem) => {
    const confirmed = window.confirm(
      `¿Regenerar el código de invitación de ${company.name}? El código actual dejará de funcionar.`,
    )

    if (!confirmed) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setRegeneratingCompanyId(company.id)

    try {
      const response = await regenerateCompanyInviteCode(company.id)

      setCompanies((current) =>
        current.map((item) =>
          item.id === company.id
            ? { ...item, inviteCode: response.company.inviteCode }
            : item,
        ),
      )
      setSuccessMessage(`Código de invitación regenerado para ${company.name}.`)
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo regenerar el código.'),
      )
    } finally {
      setRegeneratingCompanyId(null)
    }
  }

  const handleStartEditToken = (company: AdminCompanyListItem) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setEditingTokenCompanyId(company.id)
    setTokenDraft(company.nextPymeToken ?? '')
  }

  const handleCancelEditToken = () => {
    setEditingTokenCompanyId(null)
    setTokenDraft('')
  }

  const handleSaveToken = async (company: AdminCompanyListItem) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setSavingTokenCompanyId(company.id)

    try {
      const response = await updateCompanyNextPymeToken(company.id, {
        nextPymeToken: tokenDraft.trim() || null,
      })

      setCompanies((current) =>
        current.map((item) =>
          item.id === company.id
            ? { ...item, nextPymeToken: response.company.nextPymeToken }
            : item,
        ),
      )
      setSuccessMessage(`Token de NextPyme actualizado para ${company.name}.`)
      setEditingTokenCompanyId(null)
      setTokenDraft('')
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo actualizar el token de NextPyme.'),
      )
    } finally {
      setSavingTokenCompanyId(null)
    }
  }

  const handleLoadBoldCashRegisters = async (
    company: AdminCompanyListItem,
  ) => {
    setLoadingBoldCashRegistersCompanyId(company.id)
    setBoldCashRegistersErrorByCompanyId((current) => ({
      ...current,
      [company.id]: null,
    }))

    try {
      const response = await fetchBoldCashRegisters(company.id)
      setBoldCashRegistersByCompanyId((current) => ({
        ...current,
        [company.id]: response.items,
      }))
    } catch (error) {
      setBoldCashRegistersErrorByCompanyId((current) => ({
        ...current,
        [company.id]: getApiErrorMessage(
          error,
          'No se pudieron cargar las cajas de esta empresa.',
        ),
      }))
    } finally {
      setLoadingBoldCashRegistersCompanyId(null)
    }
  }

  const handleToggleBoldPanel = (company: AdminCompanyListItem) => {
    const isOpening = expandedBoldCompanyId !== company.id

    setExpandedBoldCompanyId(isOpening ? company.id : null)

    // Trae las cajas ya guardadas apenas se despliega el panel — así se ve
    // la misma tabla persistida cada vez que se abre, no solo justo después
    // de guardar una nueva en esta misma sesión.
    if (isOpening && !boldCashRegistersByCompanyId[company.id]) {
      void handleLoadBoldCashRegisters(company)
    }
  }

  const handleBoldApiKeyChange = (companyId: string, value: string) => {
    setBoldApiKeyByCompanyId((current) => ({ ...current, [companyId]: value }))
  }

  const handleCashRegisterDraftChange = (
    companyId: string,
    patch: Partial<BoldCashRegisterDraft>,
  ) => {
    setNewCashRegisterDraftByCompanyId((current) => ({
      ...current,
      [companyId]: {
        ...(current[companyId] ?? EMPTY_CASH_REGISTER_DRAFT),
        ...patch,
      },
    }))
  }

  const handleSaveCashRegister = async (company: AdminCompanyListItem) => {
    const draft =
      newCashRegisterDraftByCompanyId[company.id] ?? EMPTY_CASH_REGISTER_DRAFT
    const branchOfficeId = Number(draft.branchOfficeId)

    if (!draft.branchOfficeId.trim() || !Number.isFinite(branchOfficeId)) {
      setBoldCashRegistersErrorByCompanyId((current) => ({
        ...current,
        [company.id]: 'La sucursal debe ser un número válido.',
      }))
      return
    }

    if (!draft.cashRegisterId.trim() || !draft.cashRegisterName.trim()) {
      setBoldCashRegistersErrorByCompanyId((current) => ({
        ...current,
        [company.id]: 'El id y el nombre de la caja son obligatorios.',
      }))
      return
    }

    if (!draft.boldTerminalId) {
      setBoldCashRegistersErrorByCompanyId((current) => ({
        ...current,
        [company.id]: 'Seleccione un datáfono.',
      }))
      return
    }

    setSavingCashRegisterCompanyId(company.id)
    setBoldCashRegistersErrorByCompanyId((current) => ({
      ...current,
      [company.id]: null,
    }))

    try {
      const response = await saveBoldCashRegister({
        companyId: company.id,
        branchOfficeId,
        cashRegisterId: draft.cashRegisterId.trim(),
        cashRegisterName: draft.cashRegisterName.trim(),
        boldTerminalId: draft.boldTerminalId,
      })

      setBoldCashRegistersByCompanyId((current) => {
        const existing = current[company.id] ?? []
        const withoutOldVersion = existing.filter(
          (item) => item.id !== response.item.id,
        )

        return {
          ...current,
          [company.id]: [...withoutOldVersion, response.item],
        }
      })
      setNewCashRegisterDraftByCompanyId((current) => ({
        ...current,
        [company.id]: EMPTY_CASH_REGISTER_DRAFT,
      }))
    } catch (error) {
      setBoldCashRegistersErrorByCompanyId((current) => ({
        ...current,
        [company.id]: getApiErrorMessage(
          error,
          'No se pudo guardar la caja.',
        ),
      }))
    } finally {
      setSavingCashRegisterCompanyId(null)
    }
  }

  const handleLoadBoldTerminals = async (company: AdminCompanyListItem) => {
    // No se exige la llave acá — mientras Bold no esté configurado de
    // verdad en el backend (BOLD_API_KEY/BOLD_API_BASE_URL), el endpoint
    // devuelve un mock sin importar qué se haya escrito; una vez sí esté
    // configurado, el backend rechaza la llave faltante y ese error llega
    // igual al catch de abajo con el mismo mensaje.
    const apiKey = boldApiKeyByCompanyId[company.id]?.trim() ?? ''

    setLoadingBoldTerminalsCompanyId(company.id)
    setBoldTerminalsErrorByCompanyId((current) => ({
      ...current,
      [company.id]: null,
    }))

    try {
      const response = await fetchBoldBindedTerminals(apiKey)
      setBoldTerminalsByCompanyId((current) => ({
        ...current,
        [company.id]: response.payload.available_terminals,
      }))
    } catch (error) {
      setBoldTerminalsErrorByCompanyId((current) => ({
        ...current,
        [company.id]: getApiErrorMessage(
          error,
          'No se pudieron consultar los datáfonos de Bold.',
        ),
      }))
    } finally {
      setLoadingBoldTerminalsCompanyId(null)
    }
  }

  const handleStartEditCity = (company: AdminCompanyListItem) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setEditingCityCompanyId(company.id)
    setCityDraft(
      company.cityCode
        ? { code: company.cityCode, name: company.cityName ?? company.cityCode }
        : null,
    )
  }

  const handleCancelEditCity = () => {
    setEditingCityCompanyId(null)
    setCityDraft(null)
  }

  const handleSaveCity = async (company: AdminCompanyListItem) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setSavingCityCompanyId(company.id)

    try {
      const response = await updateCompanyCity(company.id, {
        cityCode: cityDraft?.code ?? null,
        cityName: cityDraft?.name ?? null,
      })

      setCompanies((current) =>
        current.map((item) =>
          item.id === company.id
            ? {
                ...item,
                cityCode: response.company.cityCode,
                cityName: response.company.cityName,
              }
            : item,
        ),
      )
      setSuccessMessage(`Ciudad actualizada para ${company.name}.`)
      setEditingCityCompanyId(null)
      setCityDraft(null)
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo actualizar la ciudad.'),
      )
    } finally {
      setSavingCityCompanyId(null)
    }
  }

  const handleDocumentTypesChange = async (
    company: AdminCompanyListItem,
    integration: AdminIntegrationItem,
    documentType: ElectronicDocumentType,
    checked: boolean,
  ) => {
    const currentTypes = integration.includedDocumentTypes ?? []
    const nextTypes = checked
      ? [...new Set([...currentTypes, documentType])]
      : currentTypes.filter((type) => type !== documentType)

    if (nextTypes.length === 0) {
      setErrorMessage('Debe dejar al menos un tipo de documento habilitado.')
      return
    }

    const unchanged =
      nextTypes.length === currentTypes.length &&
      nextTypes.every((type) => currentTypes.includes(type))

    if (unchanged) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setUpdatingIntegrationId(integration.id)

    try {
      const response = await updateIntegrationSubscription(
        company.id,
        integration.provider,
        { includedDocumentTypes: nextTypes },
      )

      applyIntegrationUpdate(company.id, integration.id, response.integration)
      setSuccessMessage(
        `Documentos actualizados para ${company.name}.`,
      )
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudieron actualizar los documentos.'),
      )
    } finally {
      setUpdatingIntegrationId(null)
    }
  }

  const includesSiigo = selectedIntegrations.includes(INTEGRATION_PROVIDER.SIIGO)
  const includesJarvis = selectedIntegrations.includes(
    INTEGRATION_PROVIDER.JARVIS,
  )
  const includesBold = selectedIntegrations.includes(INTEGRATION_PROVIDER.BOLD)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Panel interno"
        title="Administración de empresas"
        description="Gestione empresas, integraciones, planes y suscripciones."
        actions={
          <div className="admin-page__header-actions">
            <Link to="/inicio" className="admin-page__back-link">
              Volver a la aplicación
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </div>
        }
      />

      <section className="admin-card">
        <div className="admin-card__header">
          <h2>Crear empresa</h2>
          <p>
            Registre una empresa por NIT, asigne un plan por integración y
            seleccione las integraciones habilitadas.
          </p>
        </div>

        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="admin-form__grid">
            <div className="admin-form__field">
              <label htmlFor="admin-company-nit">NIT</label>
              <input
                id="admin-company-nit"
                type="text"
                inputMode="numeric"
                value={nit}
                onChange={(event) => setNit(event.target.value)}
                onBlur={() => void handleNitBlur()}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="admin-form__field">
              <label htmlFor="admin-company-name">Nombre de la empresa</label>
              <input
                id="admin-company-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                disabled={isSubmitting}
                placeholder={
                  isLookingUpName ? 'Buscando en el RUT/RUES...' : undefined
                }
              />
            </div>

            <div className="admin-form__field">
              <label htmlFor="admin-company-person-type">
                Tipo de persona
              </label>
              <select
                id="admin-company-person-type"
                value={personType}
                onChange={(event) =>
                  setPersonType(event.target.value as CompanyPersonType | '')
                }
                required
                disabled={isSubmitting || isParsingRut}
              >
                <option value="">Seleccione una opción</option>
                <option value={COMPANY_PERSON_TYPE.NATURAL_PERSON}>
                  Persona natural
                </option>
                <option value={COMPANY_PERSON_TYPE.LEGAL_ENTITY}>
                  Persona jurídica
                </option>
              </select>
            </div>

            <div className="admin-form__field">
              <label htmlFor="admin-company-city">Ciudad</label>
              <Autocomplete<AdminCityOption>
                id="admin-company-city"
                value={selectedCity}
                onChange={setSelectedCity}
                options={cities}
                disabled={isSubmitting}
                placeholder="Buscar ciudad..."
                emptyMessage="No se encontraron ciudades"
                getOptionKey={(city) => city.code}
                getOptionLabel={(city) => `${city.name} (${city.code})`}
              />
            </div>
          </div>

          <fieldset className="admin-form__responsible">
            <legend>Persona a cargo (opcional)</legend>
            <div className="admin-form__grid">
              <div className="admin-form__field">
                <label htmlFor="admin-responsible-name">Nombre</label>
                <input
                  id="admin-responsible-name"
                  type="text"
                  value={responsibleName}
                  onChange={(event) => setResponsibleName(event.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="admin-form__field">
                <label htmlFor="admin-responsible-phone">Teléfono</label>
                <input
                  id="admin-responsible-phone"
                  type="tel"
                  inputMode="tel"
                  value={responsiblePhone}
                  onChange={(event) => setResponsiblePhone(event.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="admin-form__field">
                <label htmlFor="admin-responsible-email">Correo</label>
                <input
                  id="admin-responsible-email"
                  type="email"
                  autoComplete="email"
                  value={responsibleEmail}
                  onChange={(event) => setResponsibleEmail(event.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="admin-form__integrations">
            <legend>Integraciones</legend>
            <label className="admin-form__checkbox">
              <input
                type="checkbox"
                checked={selectedIntegrations.includes(INTEGRATION_PROVIDER.SIIGO)}
                onChange={() => toggleIntegration(INTEGRATION_PROVIDER.SIIGO)}
                disabled={isSubmitting}
              />
              SIIGO
            </label>
            <label className="admin-form__checkbox">
              <input
                type="checkbox"
                checked={selectedIntegrations.includes(INTEGRATION_PROVIDER.JARVIS)}
                onChange={() => toggleIntegration(INTEGRATION_PROVIDER.JARVIS)}
                disabled={isSubmitting}
              />
              Jarvis
            </label>
            <label className="admin-form__checkbox">
              <input
                type="checkbox"
                checked={selectedIntegrations.includes(INTEGRATION_PROVIDER.BOLD)}
                onChange={() => toggleIntegration(INTEGRATION_PROVIDER.BOLD)}
                disabled={isSubmitting}
              />
              Bold
            </label>
          </fieldset>

          {(includesSiigo || includesJarvis || includesBold) && (
            <div className="admin-form__grid">
              {includesSiigo && (
                <div className="admin-form__field">
                  <label htmlFor="admin-company-plan-siigo">Plan SIIGO</label>
                  <select
                    id="admin-company-plan-siigo"
                    value={siigoPlanId}
                    onChange={(event) => setSiigoPlanId(event.target.value)}
                    required
                    disabled={isSubmitting || siigoPlans.length === 0}
                  >
                    {siigoPlans.length === 0 ? (
                      <option value="">Sin planes SIIGO disponibles</option>
                    ) : (
                      siigoPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {formatPlanName(plan)} · {formatDocumentLimit(plan.documentLimit)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {includesJarvis && (
                <div className="admin-form__field">
                  <label htmlFor="admin-company-plan-jarvis">Plan Jarvis</label>
                  <select
                    id="admin-company-plan-jarvis"
                    value={jarvisPlanId}
                    onChange={(event) => setJarvisPlanId(event.target.value)}
                    required
                    disabled={isSubmitting || jarvisPlans.length === 0}
                  >
                    {jarvisPlans.length === 0 ? (
                      <option value="">Sin planes Jarvis disponibles</option>
                    ) : (
                      jarvisPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {formatPlanName(plan)} · {formatDocumentLimit(plan.documentLimit)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {includesJarvis && (
                <>
                  <div className="admin-form__field">
                    <label htmlFor="admin-company-id-software">IDSoftware</label>
                    <input
                      id="admin-company-id-software"
                      type="text"
                      value={idSoftware}
                      onChange={(event) => setIdSoftware(event.target.value)}
                      placeholder="Identificador de software NextPyme/DIAN"
                      disabled={isSubmitting}
                      autoComplete="off"
                    />
                  </div>

                  <div className="admin-form__field">
                    <label htmlFor="admin-company-token-nextpyme">
                      tokenNextPyme
                    </label>
                    <input
                      id="admin-company-token-nextpyme"
                      type="password"
                      value={tokenNextPyme}
                      onChange={(event) => setTokenNextPyme(event.target.value)}
                      placeholder="Token de autenticación NextPyme"
                      disabled={isSubmitting}
                      autoComplete="new-password"
                    />
                  </div>
                </>
              )}

              {(includesSiigo || includesJarvis) && (
                <div className="admin-form__field">
                  <label htmlFor="admin-company-nextpyme-token">
                    Token NextPyme (opcional)
                  </label>
                  <input
                    id="admin-company-nextpyme-token"
                    type="password"
                    value={companyNextPymeToken}
                    onChange={(event) =>
                      setCompanyNextPymeToken(event.target.value)
                    }
                    placeholder="Deja en blanco para usar el token global"
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                </div>
              )}

              {includesBold && (
                <div className="admin-form__field">
                  <label htmlFor="admin-company-bold-token">
                    Token Bold (opcional)
                  </label>
                  <input
                    id="admin-company-bold-token"
                    type="password"
                    value={companyBoldApiKey}
                    onChange={(event) =>
                      setCompanyBoldApiKey(event.target.value)
                    }
                    placeholder="Llave de identidad (x-api-key) de la cuenta Bold"
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                </div>
              )}
            </div>
          )}

          {(includesSiigo || includesJarvis) && (
            <fieldset className="admin-form__integrations">
              <legend>Documentos incluidos</legend>
              {AVAILABLE_DOCUMENT_TYPES.map((documentType) => (
                <label
                  key={documentType.value}
                  className="admin-form__checkbox"
                >
                  <input
                    type="checkbox"
                    checked={selectedDocumentTypes.includes(documentType.value)}
                    onChange={() => toggleCreateDocumentType(documentType.value)}
                    disabled={isSubmitting}
                  />
                  {documentType.label}
                </label>
              ))}
            </fieldset>
          )}

          {includesJarvis && (
            <section className="admin-rut-upload" aria-labelledby="admin-rut-title">
              <div>
                <h3 id="admin-rut-title">Autocompletar con el RUT</h3>
                <p>
                  Adjunte el PDF de la DIAN. Extraeremos los datos para que los
                  revise antes de crear la empresa.
                </p>
              </div>

              <label className="admin-rut-upload__button">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    void handleRutUpload(file)
                    event.target.value = ''
                  }}
                  disabled={isSubmitting || isParsingRut}
                />
                {isParsingRut ? 'Leyendo RUT...' : 'Seleccionar RUT (PDF)'}
              </label>

              {rutFileName && (
                <p className="admin-rut-upload__file">
                  Archivo: <strong>{rutFileName}</strong>
                </p>
              )}

              {rutAddress && (
                <p className="admin-rut-upload__detected">
                  Dirección detectada: <strong>{rutAddress}</strong>
                </p>
              )}

              {rutWarnings.length > 0 && (
                <ul className="admin-rut-upload__warnings">
                  {rutWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <button
            type="submit"
            className="admin-form__submit"
            disabled={
              isSubmitting ||
              selectedIntegrations.length === 0 ||
              !nit.trim() ||
              !name.trim() ||
              !personType ||
              isParsingRut ||
              (includesSiigo &&
                (!siigoPlanId || selectedDocumentTypes.length === 0)) ||
              (includesJarvis &&
                (!jarvisPlanId || selectedDocumentTypes.length === 0))
            }
          >
            {isSubmitting ? 'Creando empresa...' : 'Crear empresa'}
          </button>
        </form>

        {successMessage && <SuccessMessage message={successMessage} />}
      </section>

      <section className="admin-card">
        <div className="admin-card__header">
          <h2>Empresas vinculadas</h2>
        </div>

        {isLoading ? (
          <LoadingIndicator message="Cargando empresas..." />
        ) : companies.length === 0 ? (
          <p className="admin-empty">No hay empresas vinculadas a su cuenta.</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th aria-label="Expandir" />
                  <th>Código de invitación</th>
                  <th>NIT</th>
                  <th>Empresa</th>
                  <th>Tipo</th>
                  <th>Persona a cargo</th>
                  <th>Integraciones</th>
                  <th>Plan</th>
                  <th>Documentos</th>
                  <th>Límite</th>
                  <th>Suscripción</th>
                  <th>Creada</th>
                  <th>Token NextPyme</th>
                  <th>Ciudad</th>
                </tr>
              </thead>
              <tbody>
                {companies.flatMap((company) => {
                  const plansByProvider = {
                    [INTEGRATION_PROVIDER.SIIGO]: siigoPlans,
                    [INTEGRATION_PROVIDER.JARVIS]: jarvisPlans,
                  }
                  const hasBold = company.integrations.some(
                    (integration) =>
                      integration.provider === INTEGRATION_PROVIDER.BOLD,
                  )
                  const isBoldPanelOpen =
                    hasBold && expandedBoldCompanyId === company.id

                  return [
                    <tr key={company.id}>
                      <td>
                        {hasBold && (
                          <button
                            type="button"
                            className="admin-table__expand-button"
                            aria-expanded={isBoldPanelOpen}
                            aria-label={
                              isBoldPanelOpen
                                ? `Ocultar Bold de ${company.name}`
                                : `Ver Bold de ${company.name}`
                            }
                            onClick={() => handleToggleBoldPanel(company)}
                          >
                            {isBoldPanelOpen ? '▾' : '▸'}
                          </button>
                        )}
                      </td>
                      <td>
                        <div className="admin-invite-code">
                          <code>{company.inviteCode}</code>
                          <button
                            type="button"
                            onClick={() => void handleCopyInviteCode(company)}
                          >
                            {copiedCompanyId === company.id
                              ? 'Copiado'
                              : 'Copiar'}
                          </button>
                          <button
                            type="button"
                            disabled={regeneratingCompanyId === company.id}
                            onClick={() =>
                              void handleRegenerateInviteCode(company)
                            }
                          >
                            {regeneratingCompanyId === company.id
                              ? 'Regenerando...'
                              : 'Regenerar'}
                          </button>
                        </div>
                      </td>
                      <td>{company.nit}</td>
                      <td>{company.name}</td>
                      <td>{formatPersonType(company.personType)}</td>
                      <td>{formatResponsible(company.responsible)}</td>
                      <td>{formatIntegrations(company)}</td>
                      <td>
                        {company.integrations.length === 0 ? (
                          '—'
                        ) : (
                          <div className="admin-integration-stack">
                            {company.integrations.map((integration) => {
                              const providerPlans =
                                plansByProvider[integration.provider] ?? []

                              return (
                                <div
                                  key={integration.id}
                                  className="admin-integration-stack__item"
                                >
                                  <span className="admin-integration-stack__label">
                                    {formatProviderLabel(integration.provider)}
                                  </span>
                                  <select
                                    className="admin-plan-select"
                                    aria-label={`Plan ${formatProviderLabel(integration.provider)} de ${company.name}`}
                                    value={integration.plan?.id ?? ''}
                                    disabled={
                                      updatingIntegrationId ===
                                        integration.id ||
                                      providerPlans.length === 0
                                    }
                                    onChange={(event) =>
                                      void handlePlanChange(
                                        company,
                                        integration,
                                        event.target.value,
                                      )
                                    }
                                  >
                                    {!integration.plan && (
                                      <option value="">Seleccione un plan</option>
                                    )}
                                    {providerPlans.map((plan) => (
                                      <option key={plan.id} value={plan.id}>
                                        {formatPlanName(plan)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>
                      <td>
                        {company.integrations.length === 0 ? (
                          '—'
                        ) : (
                          <div className="admin-integration-stack">
                            {company.integrations.map((integration) => (
                              <div
                                key={integration.id}
                                className="admin-integration-stack__item"
                              >
                                <span className="admin-integration-stack__label">
                                  {formatProviderLabel(integration.provider)}
                                </span>
                                <div className="admin-document-types">
                                  {AVAILABLE_DOCUMENT_TYPES.map(
                                    (documentType) => {
                                      const checked = (
                                        integration.includedDocumentTypes ?? []
                                      ).includes(documentType.value)

                                      return (
                                        <label
                                          key={documentType.value}
                                          className="admin-form__checkbox"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={
                                              updatingIntegrationId ===
                                              integration.id
                                            }
                                            onChange={(event) =>
                                              void handleDocumentTypesChange(
                                                company,
                                                integration,
                                                documentType.value,
                                                event.target.checked,
                                              )
                                            }
                                          />
                                          {documentType.label}
                                        </label>
                                      )
                                    },
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {company.integrations.length === 0 ? (
                          '—'
                        ) : (
                          <div className="admin-integration-stack">
                            {company.integrations.map((integration) => (
                              <div
                                key={integration.id}
                                className="admin-integration-stack__item"
                              >
                                <span className="admin-integration-stack__label">
                                  {formatProviderLabel(integration.provider)}
                                </span>
                                <span>
                                  {formatDocumentLimit(
                                    integration.plan?.documentLimit,
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {company.integrations.length === 0 ? (
                          '—'
                        ) : (
                          <div className="admin-integration-stack">
                            {company.integrations.map((integration) => (
                              <div
                                key={integration.id}
                                className="admin-integration-stack__item"
                              >
                                <span className="admin-integration-stack__label">
                                  {formatProviderLabel(integration.provider)}
                                </span>
                                <div className="admin-subscription-actions">
                                  <span className="admin-subscription-status">
                                    {integration.subscriptionStatus ??
                                      'sin estado'}
                                    {integration.subscriptionStartedAt
                                      ? ` · desde ${new Date(
                                          integration.subscriptionStartedAt,
                                        ).toLocaleDateString('es-CO')}`
                                      : ''}
                                  </span>
                                  <div>
                                    <button
                                      type="button"
                                      disabled={
                                        updatingIntegrationId ===
                                          integration.id ||
                                        integration.subscriptionStatus ===
                                          SUBSCRIPTION_STATUS.ACTIVE
                                      }
                                      onClick={() =>
                                        void handleSubscriptionStatusChange(
                                          company,
                                          integration,
                                          SUBSCRIPTION_STATUS.ACTIVE,
                                        )
                                      }
                                    >
                                      Activar
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        updatingIntegrationId ===
                                          integration.id ||
                                        integration.subscriptionStatus ===
                                          SUBSCRIPTION_STATUS.SUSPENDED
                                      }
                                      onClick={() =>
                                        void handleSubscriptionStatusChange(
                                          company,
                                          integration,
                                          SUBSCRIPTION_STATUS.SUSPENDED,
                                        )
                                      }
                                    >
                                      Suspender
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {new Date(company.createdAt).toLocaleDateString('es-CO')}
                      </td>
                      <td>
                        {editingTokenCompanyId === company.id ? (
                          <div className="admin-nextpyme-token admin-nextpyme-token--editing">
                            <input
                              type="text"
                              value={tokenDraft}
                              onChange={(event) =>
                                setTokenDraft(event.target.value)
                              }
                              placeholder="Token Bearer de NextPyme"
                              disabled={savingTokenCompanyId === company.id}
                              autoFocus
                            />
                            <div className="admin-nextpyme-token__actions">
                              <button
                                type="button"
                                disabled={savingTokenCompanyId === company.id}
                                onClick={() => void handleSaveToken(company)}
                              >
                                {savingTokenCompanyId === company.id
                                  ? 'Guardando...'
                                  : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                disabled={savingTokenCompanyId === company.id}
                                onClick={handleCancelEditToken}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="admin-nextpyme-token">
                            <span className="admin-nextpyme-token__value">
                              {company.nextPymeToken
                                ? `•••• ${company.nextPymeToken.slice(-4)}`
                                : 'Usa el token global'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartEditToken(company)}
                            >
                              {company.nextPymeToken ? 'Editar' : 'Configurar'}
                            </button>
                          </div>
                        )}
                      </td>
                      <td>
                        {editingCityCompanyId === company.id ? (
                          <div className="admin-nextpyme-token admin-nextpyme-token--editing">
                            <Autocomplete<AdminCityOption>
                              value={cityDraft}
                              onChange={setCityDraft}
                              options={cities}
                              disabled={savingCityCompanyId === company.id}
                              placeholder="Buscar ciudad..."
                              emptyMessage="No se encontraron ciudades"
                              getOptionKey={(city) => city.code}
                              getOptionLabel={(city) =>
                                `${city.name} (${city.code})`
                              }
                            />
                            <div className="admin-nextpyme-token__actions">
                              <button
                                type="button"
                                disabled={savingCityCompanyId === company.id}
                                onClick={() => void handleSaveCity(company)}
                              >
                                {savingCityCompanyId === company.id
                                  ? 'Guardando...'
                                  : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                disabled={savingCityCompanyId === company.id}
                                onClick={handleCancelEditCity}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="admin-nextpyme-token">
                            <span className="admin-nextpyme-token__value">
                              {company.cityName ?? 'Sin ciudad (usa Bogotá)'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartEditCity(company)}
                            >
                              {company.cityCode ? 'Editar' : 'Configurar'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>,
                    isBoldPanelOpen ? (
                      <tr key={`${company.id}-bold`} className="admin-bold-panel-row">
                        <td colSpan={14}>
                          <div className="admin-bold-panel">
                            <h3 className="admin-bold-panel__title">
                              Bold — Cajas y datáfonos de {company.name}
                            </h3>

                            <div className="admin-bold-panel__key-row">
                              <label htmlFor={`bold-api-key-${company.id}`}>
                                Llave de identidad (x-api-key)
                              </label>
                              <input
                                id={`bold-api-key-${company.id}`}
                                type="text"
                                value={boldApiKeyByCompanyId[company.id] ?? ''}
                                onChange={(event) =>
                                  handleBoldApiKeyChange(
                                    company.id,
                                    event.target.value,
                                  )
                                }
                                placeholder="Llave de la cuenta Bold de esta empresa"
                                disabled={
                                  loadingBoldTerminalsCompanyId === company.id
                                }
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  void handleLoadBoldTerminals(company)
                                }
                                disabled={
                                  loadingBoldTerminalsCompanyId === company.id
                                }
                              >
                                {loadingBoldTerminalsCompanyId === company.id
                                  ? 'Consultando...'
                                  : 'Consultar datáfonos'}
                              </button>
                            </div>

                            {boldTerminalsErrorByCompanyId[company.id] && (
                              <p className="admin-bold-panel__error">
                                {boldTerminalsErrorByCompanyId[company.id]}
                              </p>
                            )}

                            {boldCashRegistersErrorByCompanyId[
                              company.id
                            ] && (
                              <p className="admin-bold-panel__error">
                                {boldCashRegistersErrorByCompanyId[company.id]}
                              </p>
                            )}

                            <table className="admin-table admin-bold-panel__table">
                              <thead>
                                <tr>
                                  <th>Caja</th>
                                  <th>Datáfonos</th>
                                </tr>
                              </thead>
                              <tbody>
                                {loadingBoldCashRegistersCompanyId ===
                                  company.id && (
                                  <tr>
                                    <td colSpan={2} className="admin-empty">
                                      Cargando cajas...
                                    </td>
                                  </tr>
                                )}

                                {(
                                  boldCashRegistersByCompanyId[company.id] ??
                                  []
                                ).map((cashRegister) => {
                                  const terminal = (
                                    boldTerminalsByCompanyId[company.id] ?? []
                                  ).find(
                                    (item) =>
                                      item.terminal_serial ===
                                      cashRegister.boldTerminalId,
                                  )

                                  return (
                                    <tr key={cashRegister.id}>
                                      <td>
                                        <div className="admin-bold-panel__caja-name">
                                          {cashRegister.cashRegisterName}
                                        </div>
                                        <div className="admin-bold-panel__caja-meta">
                                          Sucursal {cashRegister.branchOfficeId}{' '}
                                          · Caja {cashRegister.cashRegisterId}
                                        </div>
                                      </td>
                                      <td>
                                        {terminal
                                          ? `${terminal.name} (${terminal.terminal_model})`
                                          : cashRegister.boldTerminalId}
                                      </td>
                                    </tr>
                                  )
                                })}

                                <tr>
                                  <td>
                                    <div className="admin-bold-panel__new-caja">
                                      <input
                                        type="number"
                                        min={1}
                                        placeholder="Sucursal"
                                        value={
                                          newCashRegisterDraftByCompanyId[
                                            company.id
                                          ]?.branchOfficeId ?? ''
                                        }
                                        onChange={(event) =>
                                          handleCashRegisterDraftChange(
                                            company.id,
                                            {
                                              branchOfficeId:
                                                event.target.value,
                                            },
                                          )
                                        }
                                        disabled={
                                          savingCashRegisterCompanyId ===
                                          company.id
                                        }
                                      />
                                      <input
                                        type="text"
                                        placeholder="Id de caja (SIIGO POS)"
                                        value={
                                          newCashRegisterDraftByCompanyId[
                                            company.id
                                          ]?.cashRegisterId ?? ''
                                        }
                                        onChange={(event) =>
                                          handleCashRegisterDraftChange(
                                            company.id,
                                            { cashRegisterId: event.target.value },
                                          )
                                        }
                                        disabled={
                                          savingCashRegisterCompanyId ===
                                          company.id
                                        }
                                      />
                                      <input
                                        type="text"
                                        placeholder="Nombre (ej. Caja 1)"
                                        value={
                                          newCashRegisterDraftByCompanyId[
                                            company.id
                                          ]?.cashRegisterName ?? ''
                                        }
                                        onChange={(event) =>
                                          handleCashRegisterDraftChange(
                                            company.id,
                                            {
                                              cashRegisterName:
                                                event.target.value,
                                            },
                                          )
                                        }
                                        disabled={
                                          savingCashRegisterCompanyId ===
                                          company.id
                                        }
                                      />
                                    </div>
                                  </td>
                                  <td>
                                    <div className="admin-bold-panel__new-caja-datafono">
                                      <select
                                        value={
                                          newCashRegisterDraftByCompanyId[
                                            company.id
                                          ]?.boldTerminalId ?? ''
                                        }
                                        onChange={(event) =>
                                          handleCashRegisterDraftChange(
                                            company.id,
                                            {
                                              boldTerminalId:
                                                event.target.value,
                                            },
                                          )
                                        }
                                        disabled={
                                          !(
                                            boldTerminalsByCompanyId[
                                              company.id
                                            ]?.length
                                          ) ||
                                          savingCashRegisterCompanyId ===
                                            company.id
                                        }
                                      >
                                        <option value="">
                                          {boldTerminalsByCompanyId[company.id]
                                            ?.length
                                            ? 'Seleccione un datáfono...'
                                            : 'Consulte los datáfonos primero'}
                                        </option>
                                        {(
                                          boldTerminalsByCompanyId[
                                            company.id
                                          ] ?? []
                                        ).map((terminal) => (
                                          <option
                                            key={terminal.terminal_serial}
                                            value={terminal.terminal_serial}
                                          >
                                            {terminal.name} (
                                            {terminal.terminal_model}) —{' '}
                                            {terminal.status}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleSaveCashRegister(company)
                                        }
                                        disabled={
                                          savingCashRegisterCompanyId ===
                                          company.id
                                        }
                                      >
                                        {savingCashRegisterCompanyId ===
                                        company.id
                                          ? 'Guardando...'
                                          : 'Guardar'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ]
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {errorMessage && <ErrorMessage message={errorMessage} />}
    </main>
  )
}

export default AdminPage
