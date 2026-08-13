import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import {
  isNoneCostCenterOption,
  type SiigoCostCenterOption,
} from '../constants/siigoCostCenterCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import type { CreateSiigoSupportDocumentRequest } from '../types/siigo'

const DEFAULT_SUPPORT_DOCUMENT_PREFIX = 'DS'

function normalizeSupplierIdentification(value: string): string {
  return value.replace(/[^\d]/g, '')
}

function buildSupplierReceiptNumber(
  invoiceNumber: string | null | undefined,
): CreateSiigoSupportDocumentRequest['supplier_receipt_number'] {
  const fullNumber = invoiceNumber?.trim() || ''
  const prefix = DEFAULT_SUPPORT_DOCUMENT_PREFIX

  if (fullNumber.toUpperCase().startsWith(prefix)) {
    const numberPart = fullNumber.slice(prefix.length).trim()
    const digitsOnly = numberPart.replace(/\D/g, '')

    return {
      prefix,
      number: (digitsOnly || numberPart || fullNumber).slice(0, 11),
    }
  }

  const digitsOnly = fullNumber.replace(/\D/g, '')

  return {
    prefix,
    number: (digitsOnly || fullNumber || '0').slice(0, 11),
  }
}

import {
  getTodayLocalDate,
  isSupportDocumentDateInRange,
} from './supportDocumentDate'
import { isSupportDocumentRetentionTaxType } from '../constants/siigoTaxCatalog'
import { calculateSiigoSupportDocumentPaymentValue } from './siigoSupportDocumentTotal'
import { isCreditPaymentMethod } from './siigoPaymentMethods'

export function buildSiigoSupportDocumentRequest(
  document: ElectronicDocumentListItem,
  account: SiigoAccountOption,
  paymentMethod: SiigoPaymentMethodOption,
  retentions: SiigoTaxOption[],
  costCenter: SiigoCostCenterOption | null,
  selectedDate: string,
  dueDate?: string,
  observations?: string,
  savePreferences = true,
): CreateSiigoSupportDocumentRequest {
  const supplierIdentification = normalizeSupplierIdentification(
    document.supplierNit?.trim() || '',
  )
  const receiptNumber = buildSupplierReceiptNumber(document.invoiceNumber)
  const documentRetentions = retentions
    .filter((tax) => Number.isFinite(tax.id) && tax.id > 0)
    .filter((tax) => isSupportDocumentRetentionTaxType(tax.type))
    .map((tax) => ({ id: tax.id, type: tax.type }))
  const sourceItems =
    document.items && document.items.length > 0
      ? document.items
      : [
          {
            description: 'Documento soporte importado',
            quantity: 1,
            unitValue: document.total,
            total: document.total,
          },
        ]

  const items = sourceItems.map((item) => ({
    type: 'Account',
    code: account.code,
    description: item.description,
    quantity: item.quantity > 0 ? item.quantity : 1,
    price: item.unitValue > 0 ? item.unitValue : item.total,
    ...(item.suggestedTax ? { taxes: [{ id: item.suggestedTax.id }] } : {}),
  }))
  // Ídem que en factura de compra: sin esto, el IVA sugerido quedaría en
  // items[].taxes pero el total a pagar calculado acá no lo incluiría.
  const itemTaxesCatalog: SiigoTaxOption[] = sourceItems
    .map((item) => item.suggestedTax)
    .filter((tax): tax is NonNullable<typeof tax> => Boolean(tax))
    .map((tax) => ({
      id: tax.id,
      name: tax.name,
      type: 'IVA',
      percentage: tax.percentage,
    }))

  const paymentValue = calculateSiigoSupportDocumentPaymentValue(
    items,
    itemTaxesCatalog,
    documentRetentions
      .map((retention) => retentions.find((tax) => tax.id === retention.id))
      .filter((retention): retention is SiigoTaxOption => Boolean(retention)),
  )
  const documentDate = isSupportDocumentDateInRange(selectedDate)
    ? selectedDate
    : getTodayLocalDate()
  const resolvedObservations =
    observations?.trim() || document.observations?.trim() || undefined
  const resolvedDueDate =
    isCreditPaymentMethod(paymentMethod) &&
    dueDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
      ? dueDate
      : documentDate

  return {
    documentId: document.id,
    date: documentDate,
    supplier: {
      identification: supplierIdentification,
      branch_office: 0,
    },
    ...(costCenter && !isNoneCostCenterOption(costCenter)
      ? { cost_center: costCenter.id }
      : {}),
    supplier_receipt_number: receiptNumber,
    ...(resolvedObservations ? { observations: resolvedObservations } : {}),
    stamp: {
      send: false,
    },
    ...(documentRetentions.length > 0
      ? { retentions: documentRetentions }
      : {}),
    items,
    payments: [
      {
        id: paymentMethod.id,
        value: paymentValue,
        due_date: resolvedDueDate,
      },
    ],
    ...(savePreferences
      ? {
          savePreferences: true,
          supplierPreferences: {
            accountCode: account.code,
            accountDescription: account.description,
            paymentMethod: {
              id: paymentMethod.id,
              name: paymentMethod.name,
              type: paymentMethod.type ?? '',
              dueDate: paymentMethod.dueDate,
            },
            ...(costCenter && !isNoneCostCenterOption(costCenter)
              ? {
                  costCenter: {
                    id: costCenter.id,
                    code: costCenter.code,
                    name: costCenter.name,
                  },
                }
              : {}),
            retentions: documentRetentions.map((retention) => {
              const source = retentions.find((tax) => tax.id === retention.id)

              return {
                id: retention.id,
                name: source?.name ?? `Retención ${retention.id}`,
                type: retention.type ?? source?.type ?? '',
                percentage: source?.percentage ?? 0,
              }
            }),
          },
        }
      : {}),
  }
}
