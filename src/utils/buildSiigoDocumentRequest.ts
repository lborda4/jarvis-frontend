import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import {
  isNoneCostCenterOption,
  type SiigoCostCenterOption,
} from '../constants/siigoCostCenterCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import { isPurchaseInvoiceRetentionTaxType } from '../constants/siigoTaxCatalog'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import type { PurchaseInvoiceItemDraft } from '../types/purchaseInvoiceItemDraft'
import type {
  CreateSiigoPurchaseSendRequest,
  CreateSiigoSupportDocumentItem,
  CreateSiigoSupportDocumentRequest,
} from '../types/siigo'
import { buildSiigoSupportDocumentRequest as buildSupportDocumentRequest } from './buildSiigoSupportDocumentRequest'
import { purchaseInvoiceItemIncludedIvaRate } from './purchaseInvoicePricing'
import {
  calculateSiigoSupportDocumentPaymentValue,
  roundMoney,
} from './siigoSupportDocumentTotal'
import { isCreditPaymentMethod } from './siigoPaymentMethods'
import { getTodayLocalDate, isValidLocalDateFormat } from './supportDocumentDate'

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

function dedupeTaxOptionsById(taxes: SiigoTaxOption[]): SiigoTaxOption[] {
  const byId = new Map(taxes.map((tax) => [tax.id, tax]))
  return [...byId.values()]
}

export function buildSiigoPurchaseSendRequest(
  document: ElectronicDocumentListItem,
  account: SiigoAccountOption,
  paymentMethod: SiigoPaymentMethodOption,
  retentions: SiigoTaxOption[],
  costCenter: SiigoCostCenterOption | null,
  selectedDate: string,
  dueDate?: string,
  observations?: string,
  ivaTax?: SiigoTaxOption | null,
  editedItems?: PurchaseInvoiceItemDraft[] | null,
): CreateSiigoPurchaseSendRequest {
  const supplierIdentification = normalizeSupplierIdentification(
    document.supplierNit?.trim() || '',
  )
  const providerInvoice = parseProviderInvoiceNumber(document.invoiceNumber)
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
  const hasEditedItems = Boolean(editedItems && editedItems.length > 0)

  // Solo enviar las retenciones elegidas por el usuario.
  const editedRetefuenteTaxes = hasEditedItems
    ? dedupeTaxOptionsById(
        editedItems!
          .map((item) => item.retefuenteTax)
          .filter((tax): tax is SiigoTaxOption => Boolean(tax)),
      )
    : []
  const retentionOptionsPool = dedupeTaxOptionsById([
    ...retentions,
    ...editedRetefuenteTaxes,
  ])
  const documentRetentions = retentionOptionsPool
    .filter((tax) => Number.isFinite(tax.id) && tax.id > 0)
    .filter((tax) => isPurchaseInvoiceRetentionTaxType(tax.type))
    .map((tax) => ({ id: tax.id, type: tax.type }))

  // IVA general solo para el respaldo de documentos sin líneas.
  const documentLevelIvaTax =
    ivaTax && Number.isFinite(ivaTax.id) && ivaTax.id > 0 ? ivaTax : null

  const items: CreateSiigoSupportDocumentItem[] = hasEditedItems
    ? editedItems!.map((item, index) => {
        const isAccountItem = item.tipo === 'Account'
        const editedCode = item.producto.trim()
        const itemTax =
          item.ivaTax && item.ivaTax.id > 0
            ? item.ivaTax
            : null
        const description =
          item.description.trim() ||
          sourceItems[index]?.description?.trim() ||
          ''

        return {
          type: item.tipo,
          code: isAccountItem ? editedCode || account.code : editedCode,
          ...(description ? { description } : {}),
          quantity: item.quantity > 0 ? item.quantity : 1,
          price: item.unitValue,
          ...(item.discount > 0 ? { discount: item.discount } : {}),
          ...(itemTax && itemTax.id > 0 ? { taxes: [{ id: itemTax.id }] } : {}),
        }
      })
    : sourceItems.map((item) => {
        const itemTax = document.items?.length ? item.suggestedTax : documentLevelIvaTax

        return {
          type: 'Account',
          code: account.code,
          description: item.description,
          quantity: item.quantity > 0 ? item.quantity : 1,
          price: item.unitValue > 0 ? item.unitValue : item.total,
          ...(item.discount && item.discount > 0
            ? { discount: item.discount }
            : {}),
          ...(itemTax ? { taxes: [{ id: itemTax.id }] } : {}),
        }
      })
  // El impuesto (elegido o sugerido) no viene del catálogo de retenciones ya
  // cargado, así que se arma un catálogo mínimo con lo que ya trae cada ítem
  // para que el cálculo del total a pagar sí lo tenga en cuenta (si no, el
  // payments[].value quedaría sin el IVA y no cuadraría con lo que SIIGO
  // calcula del lado suyo al ver items[].taxes).
  const itemTaxesCatalog = dedupeTaxOptionsById([
    ...(editedItems ?? []).flatMap(item => item.ivaTax ? [item.ivaTax] : []),
    ...(documentLevelIvaTax ? [documentLevelIvaTax] : []),
    ...sourceItems.flatMap(item => item.suggestedTax
      ? [{ ...item.suggestedTax, type: 'IVA' }]
      : []),
  ])

  // Algunos emisores entregan precio Y descuento con IVA. Convertir ambos
  // solo si las líneas originales concilian con base, IVA y total certificados.
  const includedRates = items.map((_, index) => purchaseInvoiceItemIncludedIvaRate(document, index))
  // Se envían precios originales solo cuando todas las líneas gravadas
  // concilian como IVA incluido y conservan su tarifa original.
  const taxIncluded = includedRates.some(rate => rate > 0) && items.every((item, index) => {
    const rate = itemTaxesCatalog.find(tax => tax.type.toUpperCase() === 'IVA' && item.taxes?.some(ref => ref.id === tax.id))?.percentage ?? 0
    return includedRates[index] > 0 ? rate === includedRates[index] : rate === 0
  })
  for (const [index, item] of items.entries()) {
    if (taxIncluded) continue
    const rate = purchaseInvoiceItemIncludedIvaRate(document, index)
    if (rate <= 0) continue
    const source = document.items?.[index]
    const unchanged = source && item.quantity === source.quantity && item.price === source.unitValue &&
      (item.discount ?? 0) === (source.discount ?? 0)
    const factor = 1 + rate / 100
    item.price = roundMoney(item.price / factor)
    if (item.discount) {
      item.discount = roundMoney(item.discount / factor)
      // En una línea sin editar, absorber únicamente el centavo de conversión
      // en el descuento para conservar la base explícita de Nextpyme.
      if (unchanged && source && Math.abs(
        (source.quantity * source.unitValue - (source.discount ?? 0)) / factor - source.total,
      ) <= 0.011) {
        const sourceDiscount = roundMoney(item.quantity * item.price - source.total)
        if (sourceDiscount >= 0 && Math.abs(sourceDiscount - item.discount) <= 0.011) item.discount = sourceDiscount
      }
    }
  }

  const paymentValue = calculateSiigoSupportDocumentPaymentValue(
    items,
    itemTaxesCatalog,
    documentRetentions
      .map((retention) => retentionOptionsPool.find((tax) => tax.id === retention.id))
      .filter((retention): retention is SiigoTaxOption => Boolean(retention)),
    taxIncluded,
  )
  // La fecha de Factura de compra es la de una factura de tercero ya
  // emitida (puede ser de hace meses) — solo se valida el formato, no una
  // ventana de días como en Documento Soporte.
  const documentDate = isValidLocalDateFormat(selectedDate)
    ? selectedDate
    : getTodayLocalDate()
  const resolvedDueDate =
    isCreditPaymentMethod(paymentMethod) &&
    dueDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
      ? dueDate
      : documentDate
  const cufe = document.cufe?.trim()
  // Si el usuario ya tiene observaciones en pantalla (por defecto arrancan
  // con "CUFE: ..." — ver buildInitialPurchaseInvoiceRowObservations en
  // SupportDocumentPage.tsx) se envían tal cual, para no perder ni el CUFE
  // ni las notas que haya agregado/editado. Solo si viene vacío se arma un
  // valor mínimo con el CUFE.
  const resolvedObservations = observations?.trim() || (cufe ? `CUFE: ${cufe}` : undefined)

  return {
    tax_included: taxIncluded,
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
    observations: resolvedObservations,
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
        const source = retentionOptionsPool.find((tax) => tax.id === retention.id)

        return {
          id: retention.id,
          name: source?.name ?? `Retención ${retention.id}`,
          type: retention.type ?? source?.type ?? '',
          percentage: source?.percentage ?? 0,
        }
      }),
    },
  }
}

export type SiigoDocumentSendRequest =
  | CreateSiigoSupportDocumentRequest
  | CreateSiigoPurchaseSendRequest
