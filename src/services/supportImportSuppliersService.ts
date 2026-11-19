import { getApiErrorMessage } from './apiClient'
import { createJarvisTercero, fetchJarvisTerceros } from './jarvisService'
import { getActiveCompanyId } from './queryCache'
import { JARVIS_DOCUMENT_TYPE_OPTIONS, JARVIS_TAX_RESPONSIBILITY, type JarvisTercero } from '../types/jarvis'
import { entityTypeFromDocumentType } from '../utils/jarvisTerceroForm'
import { supportSupplierKey } from '../utils/supportDocumentsExcel'

interface ImportSupplier {
  document_type: string
  document_number: string
  name: string | null
  email: string | null
  municipality_id?: number
}

export async function createSupportImportSuppliers(selected: ImportSupplier[], company: string | null): Promise<{ suppliers: JarvisTercero[]; failures: string[] }> {
  const checkCompany = () => {
    if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
  }
  checkCompany()
  // Validate all selected entries before creating the first one.
  const payloads = selected.map(supplier => {
    const documentType = JARVIS_DOCUMENT_TYPE_OPTIONS.find(option => option.value === supplier.document_type)?.value
    if (!documentType || !(documentType === 'NIT' || documentType === 'CC' ? /^\d+$/ : /^[a-z\d]+$/i).test(supplier.document_number)) throw new Error('Revisa el tipo y número de identificación de los terceros.')
    if (!supplier.name?.trim()) throw new Error('Completa el nombre / razón social de todos los terceros seleccionados.')
    if (!supplier.municipality_id || !Number.isInteger(supplier.municipality_id)) throw new Error('Selecciona la ciudad de cada tercero.')
    if (supplier.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplier.email.trim())) throw new Error('Revisa los correos de los terceros seleccionados.')
    return { document_type: documentType, document_number: supplier.document_number, name: supplier.name.trim(),
      ...(supplier.email?.trim() ? { email: supplier.email.trim() } : {}), municipality_id: supplier.municipality_id,
      entity_type: entityTypeFromDocumentType(documentType), tax_responsibility: JARVIS_TAX_RESPONSIBILITY.NOT_APPLICABLE, type_regime_id: 2 }
  })
  const existing = await fetchJarvisTerceros(undefined, { force: true })
  checkCompany()
  const suppliers = [...existing.items]
  const failures: string[] = []
  const attempted = new Set(suppliers.map(supplier => supportSupplierKey(supplier.document_type, supplier.document_number)))
  for (const payload of payloads) {
    checkCompany()
    const key = supportSupplierKey(payload.document_type, payload.document_number)
    if (attempted.has(key)) continue
    attempted.add(key)
    try {
      const response = await createJarvisTercero(payload)
      if (!response.success || !response.tercero?.id) throw new Error('Jarvis no confirmó la creación.')
      suppliers.push(response.tercero)
    } catch (failure) { failures.push(`${payload.document_number}: ${getApiErrorMessage(failure, 'No se pudo crear.')}`) }
  }
  checkCompany()
  return { suppliers, failures }
}
