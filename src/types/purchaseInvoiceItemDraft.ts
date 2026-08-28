import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import { roundMoney } from '../utils/siigoSupportDocumentTotal'

/** Valores que SIIGO acepta en items[].type — campo obligatorio del lado de
 * SIIGO, solo admite estos 3. */
export type PurchaseInvoiceItemType = 'Product' | 'FixedAsset' | 'Account'

export interface PurchaseInvoiceItemDraft {
  localId: string
  tipo: PurchaseInvoiceItemType
  /** Código SIIGO del producto/activo (o de la cuenta contable, si tipo es
   * 'Account' y se quiere anular la cuenta elegida arriba a nivel de
   * documento). Editable siempre; si tipo es 'Account' y se deja vacío, el
   * envío cae a esa cuenta del documento. */
  producto: string
  description: string
  quantity: number
  unitValue: number
  discount: number
  ivaTax: SiigoTaxOption | null
  /** Retefuente elegida por línea (reemplaza el reparto proporcional a nivel
   * de documento — cada ítem puede tener un concepto/tarifa distinto). */
  retefuenteTax: SiigoTaxOption | null
}

/** Un código de 1-2 caracteres que trae la factura DIAN original casi
 * siempre es un placeholder genérico del vendedor (sin SKU/cuenta real,
 * común en recargas/retail chico) — no una cuenta contable ni un código de
 * producto real. Se descarta como fallback en vez de autocompletar un valor
 * sin sentido (bug real: código "1" autocompletaba "1 - 1" en el editor de
 * ítems). Ningún código PUC ni SKU real es tan corto, así que este umbral no
 * afecta códigos legítimos. */
function looksLikeMeaningfulItemCode(code: string): boolean {
  return code.length >= 3
}

let localIdSequence = 0

function createLocalId(): string {
  localIdSequence += 1
  return `item-draft-${Date.now()}-${localIdSequence}`
}

export function createEmptyPurchaseInvoiceItemDraft(): PurchaseInvoiceItemDraft {
  return {
    localId: createLocalId(),
    tipo: 'Account',
    producto: '',
    description: '',
    quantity: 1,
    unitValue: 0,
    discount: 0,
    ivaTax: null,
    retefuenteTax: null,
  }
}

/** Ítems editables de partida para el panel de edición de Factura de compra:
 * parte de lo ya guardado (rowItems) si existe, si no de los ítems del
 * documento importado, y si no hay ninguno arma una sola línea con el total
 * del documento (mismo fallback que usa el armado del envío a SIIGO).
 *
 * `document.suggestedItemConfig` trae, por CADA campo (tipo, cuenta, IVA) de
 * forma independiente, un valor precargado si ese campo puntual es fijo en
 * el historial del proveedor, o null si ese campo es variable — un
 * proveedor puede tener cuenta fija con IVA variable, o viceversa, sin que
 * uno apague al otro. Si el proveedor es nuevo, `suggestedItemConfig` viene
 * null entero y el comportamiento es exactamente el de antes: Tipo en
 * 'Account' por defecto, IVA solo si el % de la factura matchea el catálogo.
 *
 * Retefuente se autocompleta igual que el IVA cuando el historial del
 * proveedor la trae consistente (supplierConfig.retefuenteTax != null —
 * backend ya la deja en null si es variable/no confiable, no hay que
 * adivinar acá). Antes arrancaba SIEMPRE en null a propósito, porque el
 * listado y el panel de detalle armaban esta lista cada uno por su cuenta:
 * abrir el panel precargaba una Retefuente que el listado no aplicaba,
 * mostrando dos Totales distintos para el mismo documento. Ahora
 * SupportDocumentTable.tsx arma el listado y el panel a partir de esta
 * MISMA función (effectivePurchaseInvoiceItems), así que ya no hay dos
 * cálculos que puedan divergir — el problema de fondo que forzaba dejarla
 * en null quedó resuelto, y varios proveedores tienen Retefuente fija en
 * el 100% de su historial (dejarla en null ahí solo obliga a elegirla a
 * mano cada vez, con el riesgo de que se le olvide al contador). */
export function buildPurchaseInvoiceItemDrafts(
  document: ElectronicDocumentListItem,
): PurchaseInvoiceItemDraft[] {
  const items = document.items ?? []
  const supplierConfig = document.suggestedItemConfig ?? null
  // Cuenta sugerida por IA (SiigoPurchaseAiClassificationService, ver
  // document.payload.aiSuggestion en el backend) — solo se calcula/guarda
  // justo cuando supplierConfig.accountCode NO es confiable (proveedor sin
  // historial suficiente, o cuenta variable), así que como fallback de menor
  // prioridad que el histórico confirmado y que el código que ya traía la
  // factura importada, nunca pisa a ninguno de los dos, solo llena el hueco
  // que dejan cuando ninguno resolvió nada.
  const aiSuggestedAccountCode = document.suggestedAccount?.code?.trim() || null

  const ivaTaxFromSupplierConfig = supplierConfig?.ivaTax
    ? {
        id: supplierConfig.ivaTax.id,
        name: supplierConfig.ivaTax.name,
        type: 'IVA',
        percentage: supplierConfig.ivaTax.percentage,
      }
    : null

  const retefuenteTaxFromSupplierConfig = supplierConfig?.retefuenteTax
    ? {
        id: supplierConfig.retefuenteTax.id,
        name: supplierConfig.retefuenteTax.name,
        type: 'Retefuente',
        percentage: supplierConfig.retefuenteTax.percentage,
      }
    : null

  if (items.length === 0) {
    return [
      {
        ...createEmptyPurchaseInvoiceItemDraft(),
        description: 'Factura de compra importada',
        unitValue: document.total,
        tipo: supplierConfig?.itemType ?? 'Account',
        producto: supplierConfig?.accountCode ?? aiSuggestedAccountCode ?? '',
        ivaTax: ivaTaxFromSupplierConfig,
        retefuenteTax: retefuenteTaxFromSupplierConfig,
      },
    ]
  }

  return items.map((item) => {
    // El código de la factura importada (item.code) puede ser un placeholder
    // genérico sin sentido de la factura DIAN original (ver
    // looksLikeMeaningfulItemCode) — en ese caso se descarta como fallback en
    // vez de autocompletar un valor sin sentido, dejando paso a la cuenta
    // sugerida por IA si la hay.
    const rawItemCode = item.code?.trim() || null
    const meaningfulItemCode =
      rawItemCode && looksLikeMeaningfulItemCode(rawItemCode) ? rawItemCode : null

    return {
      localId: createLocalId(),
      tipo: supplierConfig?.itemType ?? 'Account',
      producto:
        supplierConfig?.accountCode ??
        meaningfulItemCode ??
        aiSuggestedAccountCode ??
        '',
      description: item.description,
      quantity: item.quantity > 0 ? item.quantity : 1,
      unitValue: item.unitValue > 0 ? item.unitValue : item.total,
      discount: item.discount && item.discount > 0 ? item.discount : 0,
      // La config del proveedor (historial consistente) tiene prioridad sobre
      // el match por % de IVA de esta factura puntual — es la señal más fuerte
      // porque ya se confirmó que ese proveedor casi siempre usa ese IVA.
      ivaTax:
        ivaTaxFromSupplierConfig ??
        (item.suggestedTax
          ? {
              id: item.suggestedTax.id,
              name: item.suggestedTax.name,
              type: 'IVA',
              percentage: item.suggestedTax.percentage,
            }
          : null),
      retefuenteTax: retefuenteTaxFromSupplierConfig,
    }
  })
}

export function purchaseInvoiceItemDraftBase(item: PurchaseInvoiceItemDraft): number {
  const quantity = item.quantity > 0 ? item.quantity : 1
  const discount = item.discount > 0 ? item.discount : 0
  return quantity * item.unitValue - discount
}

export function purchaseInvoiceItemDraftIvaAmount(item: PurchaseInvoiceItemDraft): number {
  const percentage = item.ivaTax?.percentage ?? 0
  return percentage > 0 ? (purchaseInvoiceItemDraftBase(item) * percentage) / 100 : 0
}

export function purchaseInvoiceItemDraftRetefuenteAmount(
  item: PurchaseInvoiceItemDraft,
): number {
  const percentage = item.retefuenteTax?.percentage ?? 0
  return percentage > 0 ? (purchaseInvoiceItemDraftBase(item) * percentage) / 100 : 0
}

/** "Valor total" por línea para la tabla de ítems: reparte `documentTotal`
 * (payload.totals.total, el payable_amount certificado por la DIAN) entre
 * las líneas — nunca se muestra cantidad × valor unitario + IVA por línea
 * directo, porque en facturas reales (ej. muestras sin valor comercial) esa
 * suma no coincide con lo realmente pagable (el vendedor asume el IVA).
 * Con una sola línea no hay nada que prorratear: esa línea es el 100% del
 * total. Con varias líneas, se reparte proporcional al peso "natural" de
 * cada una (base + IVA propios) — no porque ese peso sea el valor correcto
 * en sí, sino como la mejor proporción disponible entre líneas; el
 * redondeo se absorbe en la última línea para que la suma cuadre exacto
 * con documentTotal. La Retefuente elegida por línea se resta después del
 * reparto, igual que antes. */
export function calculatePurchaseInvoiceItemLineTotals(
  items: PurchaseInvoiceItemDraft[],
  documentTotal: number,
): number[] {
  if (items.length === 0) {
    return []
  }

  const retefuenteAmounts = items.map((item) =>
    purchaseInvoiceItemDraftRetefuenteAmount(item),
  )

  if (items.length === 1) {
    return [roundMoney(documentTotal - retefuenteAmounts[0])]
  }

  const grossWeights = items.map(
    (item) =>
      purchaseInvoiceItemDraftBase(item) + purchaseInvoiceItemDraftIvaAmount(item),
  )
  const weightSum = grossWeights.reduce((sum, weight) => sum + weight, 0)

  const grossShares =
    weightSum > 0
      ? grossWeights.map((weight) => roundMoney((weight / weightSum) * documentTotal))
      : items.map(() => roundMoney(documentTotal / items.length))

  const roundedSum = grossShares
    .slice(0, -1)
    .reduce((sum, share) => sum + share, 0)
  grossShares[grossShares.length - 1] = roundMoney(documentTotal - roundedSum)

  return grossShares.map((share, index) => roundMoney(share - retefuenteAmounts[index]))
}
