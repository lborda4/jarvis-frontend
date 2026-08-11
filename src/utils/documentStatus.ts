import {
  ELECTRONIC_DOCUMENT_STATUS,
  type DocumentDashboardAction,
  type ElectronicDocumentStatus,
} from '../types/electronicDocument'

const STATUS_LABELS: Record<string, string> = {
  [ELECTRONIC_DOCUMENT_STATUS.PENDING]: 'Pendiente',
  [ELECTRONIC_DOCUMENT_STATUS.SUPPLIER_NOT_FOUND]: 'Tercero no encontrado',
  [ELECTRONIC_DOCUMENT_STATUS.SUPPLIER_FOUND]: 'Proveedor encontrado',
  [ELECTRONIC_DOCUMENT_STATUS.THIRD_PARTY_REQUIRED]: 'Requiere proveedor',
  [ELECTRONIC_DOCUMENT_STATUS.ACCOUNT_REQUIRED]: 'Requiere cuenta',
  [ELECTRONIC_DOCUMENT_STATUS.ACCOUNT_MAPPING_REQUIRED]: 'Requiere cuenta',
  [ELECTRONIC_DOCUMENT_STATUS.ACCOUNT_MAPPED]: 'Cuenta asignada',
  [ELECTRONIC_DOCUMENT_STATUS.PURCHASE_CREATED]: 'Factura creada',
  [ELECTRONIC_DOCUMENT_STATUS.PURCHASE_FAILED]: 'Error al crear factura',
  [ELECTRONIC_DOCUMENT_STATUS.READY]: 'Listo',
  [ELECTRONIC_DOCUMENT_STATUS.COMPLETED]: 'Completado',
  [ELECTRONIC_DOCUMENT_STATUS.FAILED]: 'Error',
}

export function getDocumentStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export function getDocumentStatusClass(status: string): string {
  switch (status) {
    case ELECTRONIC_DOCUMENT_STATUS.PURCHASE_CREATED:
    case ELECTRONIC_DOCUMENT_STATUS.COMPLETED:
      return 'status-badge--success'
    case ELECTRONIC_DOCUMENT_STATUS.SUPPLIER_NOT_FOUND:
    case ELECTRONIC_DOCUMENT_STATUS.THIRD_PARTY_REQUIRED:
      return 'status-badge--requiere-proveedor'
    case ELECTRONIC_DOCUMENT_STATUS.ACCOUNT_REQUIRED:
    case ELECTRONIC_DOCUMENT_STATUS.ACCOUNT_MAPPING_REQUIRED:
      return 'status-badge--requiere-cuenta'
    case ELECTRONIC_DOCUMENT_STATUS.PENDING:
    case ELECTRONIC_DOCUMENT_STATUS.SUPPLIER_FOUND:
    case ELECTRONIC_DOCUMENT_STATUS.ACCOUNT_MAPPED:
    case ELECTRONIC_DOCUMENT_STATUS.READY:
      return 'status-badge--en-proceso'
    case ELECTRONIC_DOCUMENT_STATUS.PURCHASE_FAILED:
    case ELECTRONIC_DOCUMENT_STATUS.FAILED:
      return 'status-badge--error'
    default:
      return ''
  }
}

export function getDocumentDashboardAction(
  status: ElectronicDocumentStatus,
): DocumentDashboardAction {
  switch (status) {
    case ELECTRONIC_DOCUMENT_STATUS.SUPPLIER_NOT_FOUND:
    case ELECTRONIC_DOCUMENT_STATUS.THIRD_PARTY_REQUIRED:
      return 'continue_supplier'
    case ELECTRONIC_DOCUMENT_STATUS.ACCOUNT_REQUIRED:
    case ELECTRONIC_DOCUMENT_STATUS.ACCOUNT_MAPPING_REQUIRED:
      return 'continue_account'
    case ELECTRONIC_DOCUMENT_STATUS.PURCHASE_FAILED:
    case ELECTRONIC_DOCUMENT_STATUS.FAILED:
      return 'retry'
    case ELECTRONIC_DOCUMENT_STATUS.PURCHASE_CREATED:
    case ELECTRONIC_DOCUMENT_STATUS.COMPLETED:
      return 'none'
    default:
      return 'retry'
  }
}

export const DOCUMENT_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: ELECTRONIC_DOCUMENT_STATUS.PENDING, label: 'Pendiente' },
  {
    value: ELECTRONIC_DOCUMENT_STATUS.SUPPLIER_NOT_FOUND,
    label: 'Tercero no encontrado',
  },
  { value: ELECTRONIC_DOCUMENT_STATUS.ACCOUNT_REQUIRED, label: 'Requiere cuenta' },
  {
    value: ELECTRONIC_DOCUMENT_STATUS.ACCOUNT_MAPPING_REQUIRED,
    label: 'Requiere cuenta',
  },
  {
    value: ELECTRONIC_DOCUMENT_STATUS.PURCHASE_CREATED,
    label: 'Factura creada',
  },
  { value: ELECTRONIC_DOCUMENT_STATUS.PURCHASE_FAILED, label: 'Error al crear factura' },
  { value: ELECTRONIC_DOCUMENT_STATUS.FAILED, label: 'Error' },
]
