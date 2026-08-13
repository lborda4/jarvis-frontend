import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import {
  isNoneCostCenterOption,
  type SiigoCostCenterOption,
} from '../constants/siigoCostCenterCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import { isPurchaseInvoiceRetentionTaxType } from '../constants/siigoTaxCatalog'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import type {
  CreateSiigoPurchaseSendRequest,
  CreateSiigoSupportDocumentRequest,
} from '../types/siigo'
import { buildSiigoSupportDocumentRequest as buildSupportDocumentRequest } from './buildSiigoSupportDocumentRequest'
import { calculateSiigoSupportDocumentPaymentValue } from './siigoSupportDocumentTotal'
import { isCreditPaymentMethod } from './siigoPaymentMethods'
import {
  getTodayLocalDate,
  isSupportDocumentDateInRange,
} from './supportDocumentDate'

export { buildSupportDocumentRequest as buildSiigoSupportDocumentRequest }

function normalizeSupplierIdentification(value: string): string {
  return value.replace(/[^\d]/g, '')
}

function parseProviderInvoiceNumber(numeroFactura: string | null | undefined): {
  prefix: string
  number: string
} {
  const normalized = numeroFactura?.trim() ?? ''

  if (!normalized) {
    return { prefix: 'DIAN', number: '0' }
  }

  const match = normalized.match(/^([A-Za-z]+)[\s-]*(\d+)$/)

  if (match) {
    return {
      prefix: match[1].slice(0, 6),
      number: match[2].slice(0, 11),
    }
  }

  const digitsOnly = normalized.replace(/\D/g, '')

  return {
    prefix: 'DIAN',
    number: (digitsOnly || normalized).slice(0, 11),
  }
}

export function buildSiigoPurchaseSendRequest(
  document: ElectronicDocumentListItem,
  account: SiigoAccountOption,
  paymentMethod: SiigoPaymentMethodOption,
  retentions: SiigoTaxOption[],
  costCenter: SiigoCostCenterOption | null,
  selectedDate: string,
  dueDate?: string,
  _observations?: string,
  savePreferences = true,
): CreateSiigoPurchaseSendRequest {
  const supplierIdentification = normalizeSupplierIdentification(
    document.supplierNit?.trim() || '',
  )
  const providerInvoice = parseProviderInvoiceNumber(document.invoiceNumber)
  const documentRetentions = retentions
    .filter((tax) => Number.isFinite(tax.id) && tax.id > 0)
    .filter((tax) => isPurchaseInvoiceRetentionTaxType(tax.type))
    .map((tax) => ({ id: tax.id, type: tax.type }))
  const sourceItems =
    document.items && document.items.length > 0
      ? document.items
      : [
          {
            description: 'Factura de compra importada',
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
  // El impuesto sugerido no viene del catálogo de retenciones ya cargado,
  // así que se arma un catálogo mínimo con lo que ya trae cada ítem para
  // que el cálculo del total a pagar sí lo tenga en cuenta (si no, el
  // payments[].value quedaría sin el IVA y no cuadraría con lo que SIIGO
  // calcula del lado suyo al ver items[].taxes).
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
  const resolvedDueDate =
    isCreditPaymentMethod(paymentMethod) &&
    dueDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
      ? dueDate
      : documentDate
  const cufe = document.cufe?.trim()

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
    provider_invoice: providerInvoice,
    observations: cufe ? `CUFE: ${cufe}` : undefined,
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

export type SiigoDocumentSendRequest =
  | CreateSiigoSupportDocumentRequest
  | CreateSiigoPurchaseSendRequest
