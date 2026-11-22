import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import Autocomplete from './Autocomplete'
import CompanyPlanCards from './CompanyPlanCards'
import Button from './Button'
import JarvisTopUpSelect from './JarvisTopUpSelect'
import JarvisCommercialSummary from './JarvisCommercialSummary'
import ErrorMessage from './ErrorMessage'
import SuccessMessage from './SuccessMessage'
import { formatMunicipalityLabel } from '../utils/jarvisMunicipality'
import { compatibleTopUpCodes, isTopUpCompatible, isJarvisPortfolioPlan, jarvisPlanAssignment } from '../utils/adminPlan'
import { JARVIS_MODULES, type JarvisModule } from '../types/companyModules'
import { getApiErrorMessage } from '../services/apiClient'
import { COMPANY_PERSON_TYPE, ELECTRONIC_DOCUMENT_TYPE, INTEGRATION_PROVIDER, type AdminCityOption, type AdminPlan, type AdminJarvisTopUp, type CompanyPersonType, type ElectronicDocumentType, type IntegrationProvider, type JarvisCredentialsSeed, type CreateAdminCompanyRequest, type CreateAdminCompanyResponse } from '../types/admin'

const AVAILABLE_DOCUMENT_TYPES = [{ value: ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT, label: 'Documento soporte' }, { value: ELECTRONIC_DOCUMENT_TYPE.PURCHASE_INVOICE, label: 'Factura de compra' }]
import './CreateCompanyForm.css'

interface Props {
 plans: AdminPlan[]; cities: AdminCityOption[]; topUpCatalog: AdminJarvisTopUp[];
 createCompany: (request: CreateAdminCompanyRequest) => Promise<CreateAdminCompanyResponse>;
 lookupName: (nit: string) => Promise<{ name: string | null }>;
 onCreated: (response: CreateAdminCompanyResponse) => void;
 advisor?: boolean;
 onCancel?: () => void;
 selectionSummary?: (plans: AdminPlan[], topUps: AdminJarvisTopUp[]) => ReactNode;
}
export default function CreateCompanyForm({ plans, cities, topUpCatalog, createCompany, lookupName, onCreated, advisor = false, selectionSummary, onCancel }: Props) {
 const [errorMessage, setErrorMessage] = useState<string | null>(null)
 const [successMessage, setSuccessMessage] = useState<string | null>(null)
const [commercial, setCommercial] = useState('')
const [billingMonths, setBillingMonths] = useState('1')
const [jarvisModules, setJarvisModules] = useState<JarvisModule[]>([...JARVIS_MODULES])
const [jarvisTopUpCodes, setJarvisTopUpCodes] = useState<string[]>([])
const [hasTopUps, setHasTopUps] = useState(false)
const [isSubmitting, setIsSubmitting] = useState(false)
const [registrationEmail, setRegistrationEmail] = useState('')
const [nit, setNit] = useState('')
const [name, setName] = useState('')
const [description, setDescription] = useState('')
const [isLookingUpName, setIsLookingUpName] = useState(false)
const [personType, setPersonType] = useState<CompanyPersonType | ''>('')
const [responsibleName, setResponsibleName] = useState('')
const [responsiblePhone, setResponsiblePhone] = useState('')
const [idSoftware, setIdSoftware] = useState('')
const [selectedCity, setSelectedCity] = useState<AdminCityOption | null>(
    null,
  )
const [companyNextPymeToken, setCompanyNextPymeToken] = useState('')
const [siigoPlanId, setSiigoPlanId] = useState('')
const [jarvisPlanId, setJarvisPlanId] = useState('')
const [selectedDocumentTypes, setSelectedDocumentTypes] = useState<
    ElectronicDocumentType[]
  >([ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT])
const [selectedIntegrations, setSelectedIntegrations] = useState<
    IntegrationProvider[]
  >([])
const siigoPlans = useMemo(
    () => plans.filter((plan) => plan.provider === INTEGRATION_PROVIDER.SIIGO),
    [plans],
  )
const jarvisPlans = useMemo(
    () => plans.filter((plan) => plan.provider === INTEGRATION_PROVIDER.JARVIS),
    [plans],
  )
const selectedJarvisPlan = jarvisPlans.find(plan => plan.id === jarvisPlanId && isJarvisPortfolioPlan(plan))
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
const handleNitBlur = async () => {
    const trimmedNit = nit.trim()

    if (!trimmedNit || name.trim()) {
      return
    }

    setIsLookingUpName(true)

    try {
      const response = await lookupName(trimmedNit)

      if (response.name && !name.trim()) {
        setName(response.name)
      }
    } catch {
      // Silencioso: el admin puede llenar el nombre a mano igual que hoy.
    } finally {
      setIsLookingUpName(false)
    }
  }
const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
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
      if (!selectedIntegrations.length) throw new Error('Selecciona una integración.')
      const trimmedIdSoftware = idSoftware.trim()
      if (includesJarvis && !selectedJarvisPlan) throw new Error('Selecciona un plan Jarvis del portafolio.')
      if (includesJarvis && !jarvisModules.length) throw new Error('Selecciona al menos un módulo de Jarvis.')
      const trimmedTokenNextPyme = companyNextPymeToken.trim()
      const mergedJarvisCredentials: JarvisCredentialsSeed | undefined =
        includesJarvis
          ? {
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

      const assignment = includesJarvis ? jarvisPlanAssignment(selectedJarvisPlan!) : undefined
      const months = includesSiigo ? Number(billingMonths) : assignment?.billingMonths ?? Number(billingMonths)
      if (!Number.isInteger(months) || months < 1 || months > 1200) throw new Error('Indica una cantidad entera de meses entre 1 y 1200.')
      const response = await createCompany({
        ...(!advisor ? { commercial: commercial.trim() } : {}),
        billingMonths: months,
        nit: nit.trim(),
        registrationEmail: registrationEmail.trim(),
        name: name.trim(),
        ...(includesSiigo && description.trim()
          ? { description: description.trim() }
          : {}),
        personType: personType as CompanyPersonType,
        ...(responsibleName.trim() ||
        responsiblePhone.trim()
          ? {
        responsible: {
          name: responsibleName.trim(),
          phone: responsiblePhone.trim(),
          email: '',
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
              ...assignment,
              billingMonths: months,
              jarvisTopUpCodes: compatibleTopUpCodes(selectedJarvisPlan, jarvisTopUpCodes, topUpCatalog),
            }
          : {}),
        ...(includesSiigo && selectedDocumentTypes.length > 0
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

      onCreated(response)
      setSuccessMessage(`Empresa ${response.company.name} creada correctamente.${response.welcome?.status === 'SENT' ? ' Se envió el correo de bienvenida.' : ''}`)
      if (response.welcome?.status === 'FAILED') setErrorMessage(response.welcome.message)

      setNit('')
      setRegistrationEmail('')
      setCommercial('')
      setBillingMonths('1')
      setName('')
      setDescription('')
      setPersonType('')
      setResponsibleName('')
      setResponsiblePhone('')
      setIdSoftware('')
      setCompanyNextPymeToken('')
      setSelectedCity(null)
      setSelectedIntegrations([])
      setJarvisModules([...JARVIS_MODULES])
      setSelectedDocumentTypes([ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT])
      setSiigoPlanId('')
      setJarvisPlanId('')
      setJarvisTopUpCodes([])
      setHasTopUps(false)
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo crear la empresa.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }
const includesSiigo = selectedIntegrations.includes(INTEGRATION_PROVIDER.SIIGO)
const includesJarvis = selectedIntegrations.includes(
    INTEGRATION_PROVIDER.JARVIS,
  )
const includesBold = selectedIntegrations.includes(INTEGRATION_PROVIDER.BOLD)

const selectedTopUps = includesJarvis ? topUpCatalog.filter(item => compatibleTopUpCodes(selectedJarvisPlan, jarvisTopUpCodes, topUpCatalog).includes(item.code)) : []

return <form className="admin-form company-create" onSubmit={handleSubmit}>
  <fieldset className="admin-card company-create__integrations">
    <legend>Integraciones</legend>
    <div className="company-create__integration-options">{([INTEGRATION_PROVIDER.SIIGO, INTEGRATION_PROVIDER.JARVIS, ...(!advisor ? [INTEGRATION_PROVIDER.BOLD] : [])]).map(provider => <label key={provider} className={`company-create__integration${selectedIntegrations.includes(provider) ? ' company-create__integration--selected' : ''}`}>
      <input type="checkbox" checked={selectedIntegrations.includes(provider)} onChange={() => toggleIntegration(provider)} disabled={isSubmitting} />{provider === 'JARVIS' ? 'Jarvis' : provider === 'BOLD' ? 'Bold' : 'SIIGO'}
    </label>)}</div>
  </fieldset>
  <div className="company-create__columns">
    <section className="admin-card company-create__information"><h2>Información de la empresa</h2>
      <div className="admin-form__grid">
        <label className="admin-form__field" htmlFor="admin-company-nit">NIT<input id="admin-company-nit" inputMode="numeric" value={nit} onChange={event => setNit(event.target.value)} onBlur={() => void handleNitBlur()} required disabled={isSubmitting} /></label>
        <label className="admin-form__field" htmlFor="admin-company-name">Nombre de la empresa<input id="admin-company-name" value={name} onChange={event => setName(event.target.value)} required disabled={isSubmitting} placeholder={isLookingUpName ? 'Buscando empresa…' : undefined} /></label>
        {!advisor && <label className="admin-form__field" htmlFor="admin-company-commercial">Comercial<input id="admin-company-commercial" value={commercial} onChange={event => setCommercial(event.target.value)} maxLength={120} disabled={isSubmitting} placeholder="Nombre del comercial" /></label>}
        <label className="admin-form__field" htmlFor="admin-company-person-type">Tipo de persona<select id="admin-company-person-type" value={personType} onChange={event => setPersonType(event.target.value as CompanyPersonType | '')} required disabled={isSubmitting}><option value="">Selecciona una opción</option><option value={COMPANY_PERSON_TYPE.NATURAL_PERSON}>Persona natural</option><option value={COMPANY_PERSON_TYPE.LEGAL_ENTITY}>Persona jurídica</option></select></label>
        <div className="admin-form__field"><label htmlFor="admin-company-city">Ciudad</label><Autocomplete<AdminCityOption> id="admin-company-city" value={selectedCity} onChange={setSelectedCity} options={cities} disabled={isSubmitting} placeholder="Buscar ciudad…" emptyMessage="No se encontraron ciudades" getOptionKey={city => city.code} getOptionLabel={formatMunicipalityLabel} /></div>
        <label className="admin-form__field admin-form__field--wide" htmlFor="admin-registration-email">Correo de bienvenida<input id="admin-registration-email" type="email" value={registrationEmail} onChange={event => setRegistrationEmail(event.target.value)} required maxLength={254} disabled={isSubmitting} placeholder="usuario@empresa.com" /><small>Recibirá el enlace para crear su acceso.</small></label>
      </div>
      <fieldset className="admin-form__responsible"><legend>Información de contacto (opcional)</legend><div className="admin-form__grid">
        <label className="admin-form__field" htmlFor="admin-responsible-name">Nombre<input id="admin-responsible-name" value={responsibleName} onChange={event => setResponsibleName(event.target.value)} disabled={isSubmitting} /></label>
        <label className="admin-form__field" htmlFor="admin-responsible-phone">Teléfono<input id="admin-responsible-phone" type="tel" inputMode="tel" value={responsiblePhone} onChange={event => setResponsiblePhone(event.target.value)} disabled={isSubmitting} /></label>
      </div></fieldset>
      {includesSiigo && <label className="admin-form__field" htmlFor="admin-company-description">Descripción de la empresa<textarea id="admin-company-description" value={description} onChange={event => setDescription(event.target.value.slice(0, 1000))} disabled={isSubmitting} rows={3} maxLength={1000} placeholder="Actividad de la empresa" /></label>}
    </section>
    <section className="admin-card company-create__commercial"><h2>Planes y recargas</h2>
      {!selectedIntegrations.length && <p className="company-create__empty">Selecciona una integración para ver sus planes.</p>}
      {includesSiigo && <>
        <CompanyPlanCards title="Plan Siigo" name="company-plan-siigo" plans={siigoPlans} value={siigoPlanId} onChange={plan => setSiigoPlanId(plan.id)} disabled={isSubmitting} />
        {siigoPlanId && <label className="admin-form__field" htmlFor="admin-company-billing-months">Periodicidad del plan Siigo (meses)<input id="admin-company-billing-months" type="number" min="1" max="1200" step="1" required value={billingMonths} onChange={event => setBillingMonths(event.target.value)} disabled={isSubmitting} /></label>}
        <fieldset className="admin-form__integrations"><legend>Documentos incluidos</legend>{AVAILABLE_DOCUMENT_TYPES.map(item => <label key={item.value} className="admin-form__checkbox"><input type="checkbox" checked={selectedDocumentTypes.includes(item.value)} onChange={() => toggleCreateDocumentType(item.value)} disabled={isSubmitting} />{item.label}</label>)}</fieldset>
      </>}
      {includesJarvis && <>
        <CompanyPlanCards title="Plan Jarvis" name="company-plan-jarvis" plans={jarvisPlans.filter(isJarvisPortfolioPlan)} value={jarvisPlanId} disabled={isSubmitting} onChange={plan => { setJarvisPlanId(plan.id); setJarvisTopUpCodes(compatibleTopUpCodes(plan, jarvisTopUpCodes, topUpCatalog)); setJarvisModules(jarvisPlanAssignment(plan).jarvisModules!) }} />
        <p className="company-create__hint">Suscripción anual · Vence con el certificado digital.</p>
        {selectedJarvisPlan && <>
          <label className="company-create__topup-toggle"><input type="checkbox" role="switch" checked={hasTopUps} onChange={event => { setHasTopUps(event.target.checked); if (!event.target.checked) setJarvisTopUpCodes([]) }} disabled={isSubmitting || !topUpCatalog.some(item => isTopUpCompatible(selectedJarvisPlan, item))} />Agregar recargas</label>
          {hasTopUps && <JarvisTopUpSelect idPrefix="create-company-top-up" plan={selectedJarvisPlan} catalog={topUpCatalog} value={jarvisTopUpCodes} onChange={setJarvisTopUpCodes} disabled={isSubmitting} />}
          <JarvisCommercialSummary plan={selectedJarvisPlan} topUps={selectedTopUps} showDocumentCapacity />
        </>}
      </>}
      {includesBold && !includesSiigo && !includesJarvis && <p className="company-create__hint">La integración Bold se configura después de crear la empresa.</p>}
      {selectionSummary?.(plans.filter(plan => (includesJarvis && plan.id === jarvisPlanId) || (includesSiigo && plan.id === siigoPlanId)), selectedTopUps)}
    </section>
  </div>
  {(includesSiigo || includesJarvis) && <details className="admin-card company-create__advanced"><summary>Configuración NextPyme (opcional)</summary><div className="admin-form__grid">
    {includesJarvis && <label className="admin-form__field" htmlFor="admin-company-id-software">IDSoftware<input id="admin-company-id-software" value={idSoftware} onChange={event => setIdSoftware(event.target.value)} disabled={isSubmitting} autoComplete="off" /></label>}
    <label className="admin-form__field" htmlFor="admin-company-nextpyme-token">Token NextPyme<input id="admin-company-nextpyme-token" type="password" value={companyNextPymeToken} onChange={event => setCompanyNextPymeToken(event.target.value)} placeholder="Usar token global" disabled={isSubmitting} autoComplete="new-password" /></label>
  </div></details>}
  {successMessage && <SuccessMessage message={successMessage} />}{errorMessage && <ErrorMessage message={errorMessage} />}
  <div className="company-create__actions">{onCancel && <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>Cancelar</Button>}<Button type="submit" disabled={isSubmitting || !selectedIntegrations.length || !nit.trim() || !name.trim() || !personType || !registrationEmail.trim() || (includesSiigo && (!siigoPlanId || !selectedDocumentTypes.length)) || (includesJarvis && (!selectedJarvisPlan || !jarvisModules.length))}>{isSubmitting ? 'Creando empresa…' : 'Crear empresa'}</Button></div>
</form>
}
