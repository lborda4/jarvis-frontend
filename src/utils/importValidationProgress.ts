import type {
  ElectronicDocumentListItem,
  ElectronicDocumentType,
} from '../types/electronicDocument'
import { isPurchaseAiClassificationPending } from './mapImportRowStatus'
import { isSupplierCheckPending } from './supplierSiigoStatus'

export function getImportValidationProgress(
  ids: string[],
  documents: ElectronicDocumentListItem[],
  documentType: ElectronicDocumentType,
  provider: 'SIIGO' | 'JARVIS',
) {
  const byId = new Map(documents.map((document) => [document.id, document]))
  let missing = 0
  let suppliers = 0
  let ai = 0
  for (const id of new Set(ids)) {
    const document = byId.get(id)
    if (!document) {
      missing++
      continue
    }
    if (
      document.alreadyInSiigo ||
      ['PURCHASE_CREATED', 'COMPLETED', 'PURCHASE_FAILED', 'FAILED'].includes(
        document.status,
      )
    )
      continue
    if (isSupplierCheckPending(document)) suppliers++
    if (
      provider === 'SIIGO' &&
      documentType === 'PURCHASE_INVOICE' &&
      isPurchaseAiClassificationPending(document)
    )
      ai++
  }
  return { missing, suppliers, ai, complete: missing + suppliers + ai === 0 }
}

export function formatImportValidationNotice(
  progress: ReturnType<typeof getImportValidationProgress>,
): string | null {
  if (progress.complete) return null
  const details = [
    progress.missing
      ? progress.missing + ' documento(s) sin estado actualizado'
      : '',
    progress.suppliers
      ? progress.suppliers + ' proveedor(es) pendientes de validar'
      : '',
    progress.ai
      ? progress.ai + ' documento(s) pendientes de sugerencias de IA'
      : '',
  ]
    .filter(Boolean)
    .join('; ')
  return (
    'La importación se guardó. Seguimiento pendiente: ' +
    details +
    '. Pulse Actualizar para consultar el estado. Este aviso no indica que la importación haya fallado.'
  )
}
