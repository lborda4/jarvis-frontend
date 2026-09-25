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
  CreateSiigoSupportDocumentRequest,
} from '../types/siigo'
import { buildSiigoSupportDocumentRequest as buildSupportDocumentRequest } from './buildSiigoSupportDocumentRequest'
import {
  areItemPricesTaxInclusive,
  calculateSiigoSupportDocumentPaymentValue,
  convertTaxInclusiveUnitPrice,
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

  // Retefuente sugerida por el historial del proveedor (igual que
  // buildPurchaseInvoiceItemDrafts) — es el fallback para cuando el usuario
  // envía directo desde la fila colapsada, SIN haber abierto el panel de
  // detalle del ítem. Antes, en ese caso, la Retefuente nunca se aplicaba
  // (solo vivía en editedItems, que queda vacío si la fila nunca se
  // expandió): un documento con retención en la fuente consistente en el
  // historial se enviaba a SIIGO sin ninguna retención. Ver bug reportado en
  // producción.
  const retefuenteTaxFromSupplierConfig = document.suggestedItemConfig?.retefuenteTax
    ? {
        id: document.suggestedItemConfig.retefuenteTax.id,
        name: document.suggestedItemConfig.retefuenteTax.name,
        type: 'Retefuente',
        percentage: document.suggestedItemConfig.retefuenteTax.percentage,
      }
    : null

  // La Retefuente se elige por ítem en el editor de detalle (no a nivel de
  // documento como ReteIVA/ReteICA), pero SIIGO la espera igual que las
  // demás retenciones en el campo `retentions` de nivel documento — se
  // agregan las distintas tarifas usadas en los ítems editados, o la
  // sugerida por el historial si la fila nunca se editó a mano.
  const editedRetefuenteTaxes = hasEditedItems
    ? dedupeTaxOptionsById(
        editedItems!
          .map((item) => item.retefuenteTax)
          .filter((tax): tax is SiigoTaxOption => Boolean(tax)),
      )
    : retefuenteTaxFromSupplierConfig
      ? [retefuenteTaxFromSupplierConfig]
      : []
  const retentionOptionsPool = dedupeTaxOptionsById([
    ...retentions,
    ...editedRetefuenteTaxes,
  ])
  const documentRetentions = retentionOptionsPool
    .filter((tax) => Number.isFinite(tax.id) && tax.id > 0)
    .filter((tax) => isPurchaseInvoiceRetentionTaxType(tax.type))
    .map((tax) => ({ id: tax.id, type: tax.type }))

  // IVA de documento (columna del listado) o, si no hay, el sugerido por
  // los ítems importados. Sirve tanto al enviar la fila colapsada como
  // fallback cuando el panel de detalle dejó la celda de IVA vacía — si no,
  // el backend aplicaba el primer IVA del catálogo (a menudo 5%) y SIIGO
  // recibía un impuesto distinto al que Jarvis muestra (el de la DIAN).
  const documentLevelIvaTax =
    ivaTax && Number.isFinite(ivaTax.id) && ivaTax.id > 0 ? ivaTax : null

  const items = hasEditedItems
    ? editedItems!.map((item, index) => {
        const isAccountItem = item.tipo === 'Account'
        const editedCode = item.producto.trim()
        const itemTax =
          item.ivaTax && item.ivaTax.id > 0
            ? item.ivaTax
            : (documentLevelIvaTax ?? sourceItems[index]?.suggestedTax)
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
        const itemTax = documentLevelIvaTax ?? item.suggestedTax

        return {
          type: 'Account',
          code: account.code,
          description: item.description,
          quantity: item.quantity > 0 ? item.quantity : 1,
          price: item.unitValue > 0 ? item.unitValue : item.total,
          ...(itemTax ? { taxes: [{ id: itemTax.id }] } : {}),
        }
      })
  // El impuesto (elegido o sugerido) no viene del catálogo de retenciones ya
  // cargado, así que se arma un catálogo mínimo con lo que ya trae cada ítem
  // para que el cálculo del total a pagar sí lo tenga en cuenta (si no, el
  // payments[].value quedaría sin el IVA y no cuadraría con lo que SIIGO
  // calcula del lado suyo al ver items[].taxes).
  const itemTaxesCatalog: SiigoTaxOption[] = hasEditedItems
    ? dedupeTaxOptionsById(
        [
          ...editedItems!
            .map((item) => item.ivaTax)
            .filter((tax): tax is SiigoTaxOption => Boolean(tax)),
          ...(documentLevelIvaTax ? [documentLevelIvaTax] : []),
          ...sourceItems
            .map((item) => item.suggestedTax)
            .filter((tax): tax is NonNullable<typeof tax> => Boolean(tax))
            .map((tax) => ({
              id: tax.id,
              name: tax.name,
              type: 'IVA',
              percentage: tax.percentage,
            })),
        ],
      )
    : documentLevelIvaTax
      ? [documentLevelIvaTax]
      : sourceItems
          .map((item) => item.suggestedTax)
          .filter((tax): tax is NonNullable<typeof tax> => Boolean(tax))
          .map((tax) => ({
            id: tax.id,
            name: tax.name,
            type: 'IVA',
            percentage: tax.percentage,
          }))

  const itemsGross = items.reduce((sum, item) => {
    const quantity = item.quantity > 0 ? item.quantity : 1
    const discount = item.discount && item.discount > 0 ? item.discount : 0
    return sum + quantity * item.price - discount
  }, 0)
  const fallbackIvaRate =
    itemTaxesCatalog[0]?.percentage ??
    (document.documentSubtotal > 0 && document.documentIva > 0
      ? (document.documentIva / document.documentSubtotal) * 100
      : 0)
  if (
    fallbackIvaRate > 0 &&
    areItemPricesTaxInclusive({
      itemsGross,
      subtotal: document.documentSubtotal,
      total: document.total,
    })
  ) {
    for (const item of items) {
      item.price = convertTaxInclusiveUnitPrice(item.price, fallbackIvaRate)
    }
  }

  const paymentValue = calculateSiigoSupportDocumentPaymentValue(
    items,
    itemTaxesCatalog,
    documentRetentions
      .map((retention) => retentionOptionsPool.find((tax) => tax.id === retention.id))
      .filter((retention): retention is SiigoTaxOption => Boolean(retention)),
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
