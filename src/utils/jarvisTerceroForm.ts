import {
  JARVIS_DOCUMENT_TYPE,
  JARVIS_DOCUMENT_TYPE_OPTIONS,
  JARVIS_ENTITY_TYPE,
  type CreateJarvisTerceroRequest,
  type JarvisEntityType,
  type JarvisTercero,
} from '../types/jarvis'

export function entityTypeFromDocumentType(
  documentType?: string | null,
): JarvisEntityType {
  return documentType === JARVIS_DOCUMENT_TYPE.NIT
    ? JARVIS_ENTITY_TYPE.LEGAL_ENTITY
    : JARVIS_ENTITY_TYPE.NATURAL_PERSON
}

export function terceroToForm(tercero: JarvisTercero): CreateJarvisTerceroRequest {
  return {
    document_type: JARVIS_DOCUMENT_TYPE_OPTIONS.find((option) => option.value === tercero.document_type)?.value ?? 'NIT',
    document_number: tercero.document_number,
    name: tercero.name,
    check_digit: tercero.check_digit ?? '',
    entity_type: tercero.entity_type ?? undefined,
    tax_regime: tercero.tax_regime ?? undefined,
    tax_responsibility: tercero.tax_responsibility,
    municipality_id: tercero.municipality_id ?? undefined,
    type_regime_id: tercero.type_regime_id ?? undefined,
    email: tercero.email ?? '',
    phone: tercero.phone ?? '',
    address: tercero.address ?? '',
  }
}
