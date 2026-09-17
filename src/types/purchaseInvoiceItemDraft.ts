import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SiigoProductOption } from '../constants/siigoProductCatalog'
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

/** Reconstruye los ítems desde el borrador guardado (electronic_documents.draft),
 * en vez de recalcular las sugerencias — así lo que el contador dejó
 * guardado sigue viéndose igual después de recargar, incluso si el
 * historial del proveedor o la clasificación de IA cambiaron entre tanto.
 * El borrador solo trae ids de impuesto (no el objeto completo, ver
 * ElectronicDocumentDraft), así que se resuelven contra el catálogo VIGENTE
 * — si un impuesto ya no existe en el catálogo, el ítem queda sin ese
 * impuesto en vez de mostrar uno inventado. */
export function buildPurchaseInvoiceItemDraftsFromDraft(
  draftItems: NonNullable<ElectronicDocumentListItem['draft']>['items'],
  ivaOptions: SiigoTaxOption[] = [],
  retefuenteOptions: SiigoTaxOption[] = [],
): PurchaseInvoiceItemDraft[] {
  const findTax = (
    options: SiigoTaxOption[],
    id: number | null | undefined,
  ): SiigoTaxOption | null =>
    id == null ? null : (options.find((tax) => tax.id === id) ?? null)

  return (draftItems ?? []).map((item) => ({
    localId: createLocalId(),
    tipo: item.tipo,
    producto: item.producto,
    description: item.description,
    quantity: item.quantity,
    unitValue: item.unitValue,
    discount: item.discount,
    ivaTax: findTax(ivaOptions, item.ivaTaxId),
    retefuenteTax: findTax(retefuenteOptions, item.retefuenteTaxId),
  }))
}

/** Devuelve el primer candidato que exista LITERALMENTE en el catálogo real
 * de cuentas transaccionales — nunca un código que "parezca" válido. El
 * código que trae la factura DIAN original (item.code) es SIEMPRE un
 * identificador del VENDEDOR (su propio SKU o código de barras), no la
 * cuenta contable del comprador, así que solo vale como fallback cuando
 * COINCIDE con una cuenta real; de lo contrario no significa nada como
 * cuenta (casos reales vistos: "1" de un placeholder genérico de DIAN,
 * "7702004025784" un código de barras EAN-13 de D1) y se descarta, dejando
 * paso al siguiente candidato (típicamente la sugerencia de IA). */
function resolveValidatedAccountCode(
  candidates: Array<string | null | undefined>,
  accountOptions: SiigoAccountOption[],
): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim()

    if (trimmed && accountOptions.some((account) => account.code === trimmed)) {
      return trimmed
    }
  }

  return null
}

/** Mismo criterio que resolveValidatedAccountCode, pero contra el catálogo
 * de productos SIIGO — un código de producto que no existe LITERALMENTE en
 * el catálogo (ej. el código de barras/SKU del vendedor, que no tiene nada
 * que ver con el código de producto del comprador en SIIGO) se descarta en
 * vez de mostrarse como si fuera válido. */
function resolveValidatedProductCode(
  candidates: Array<string | null | undefined>,
  productOptions: SiigoProductOption[],
): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim()

    if (trimmed && productOptions.some((product) => product.code === trimmed)) {
      return trimmed
    }
  }

  return null
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
  accountOptions: SiigoAccountOption[] = [],
  productOptions: SiigoProductOption[] = [],
): PurchaseInvoiceItemDraft[] {
  const items = document.items ?? []
  const supplierConfig = document.suggestedItemConfig ?? null
  const effectiveTipo = supplierConfig?.itemType ?? 'Account'
  // Cuenta sugerida por IA (SiigoPurchaseAiClassificationService, ver
  // document.payload.aiSuggestion en el backend) — solo se calcula/guarda
  // justo cuando supplierConfig.accountCode NO es confiable (proveedor sin
  // historial suficiente, o cuenta variable), así que como fallback de menor
  // prioridad que el histórico confirmado y que el código que ya traía la
  // factura importada, nunca pisa a ninguno de los dos, solo llena el hueco
  // que dejan cuando ninguno resolvió nada.
  const aiSuggestedAccountCode = document.suggestedAccount?.code?.trim() || null
  // Mismo mecanismo que aiSuggestedAccountCode, pero para itemType='Product'
  // — la IA solo sugiere producto cuando clasificó el ítem como Producto
  // (ver ItemTypeAndAccountClassification en el backend), nunca ambos a la
  // vez.
  const aiSuggestedProductCode = document.suggestedProduct?.code?.trim() || null

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
    const producto =
      effectiveTipo === 'Account'
        ? (resolveValidatedAccountCode(
            [supplierConfig?.accountCode, aiSuggestedAccountCode],
            accountOptions,
          ) ?? '')
        : effectiveTipo === 'Product'
          ? (resolveValidatedProductCode(
              [supplierConfig?.productCode, aiSuggestedProductCode],
              productOptions,
            ) ?? '')
          : (supplierConfig?.accountCode ?? aiSuggestedAccountCode ?? '')

    return [
      {
        ...createEmptyPurchaseInvoiceItemDraft(),
        description: 'Factura de compra importada',
        unitValue: document.total,
        tipo: effectiveTipo,
        producto,
        ivaTax: ivaTaxFromSupplierConfig,
        retefuenteTax: retefuenteTaxFromSupplierConfig,
      },
    ]
  }

  return items.map((item) => {
    const rawItemCode = item.code?.trim() || null
    // Regla exacta de ESTE ítem puntual (proveedor + esta descripción,
    // SupplierItemAccountMapping en el backend) — tiene prioridad sobre el
    // tipo dominante de TODO el proveedor (effectiveTipo/supplierConfig):
    // un proveedor puede facturar la mayoría de sus conceptos como
    // Producto pero tener uno puntual que siempre se contabiliza a una
    // cuenta de gasto específica (caso real: concepto "BAHHIA" con cuenta
    // fija mientras el resto de la factura es Producto). Solo se aplica con
    // source: 'exact' — 'fallback' es apenas una sugerencia de proveedor sin
    // confirmar para esta descripción y no alcanza para cambiar el tipo.
    const hasExactItemAccountRule = item.suggestedAccount?.source === 'exact'
    const itemTipo: PurchaseInvoiceItemType = hasExactItemAccountRule
      ? 'Account'
      : effectiveTipo
    // El código de la factura importada (item.code) es SIEMPRE del VENDEDOR
    // (su SKU o código de barras), no un código del comprador — cuando el
    // tipo es 'Account' o 'Product', solo se usa si coincide LITERALMENTE
    // con el catálogo correspondiente (ver resolveValidatedAccountCode /
    // resolveValidatedProductCode); si no, se descarta y cae a la
    // sugerencia de IA. Solo 'FixedAsset' queda como código libre — SIIGO no
    // expone un catálogo de activos fijos por esta vía.
    const producto =
      itemTipo === 'Account'
        ? (resolveValidatedAccountCode(
            [
              item.suggestedAccount?.code,
              supplierConfig?.accountCode,
              rawItemCode,
              aiSuggestedAccountCode,
            ],
            accountOptions,
          ) ?? '')
        : itemTipo === 'Product'
          ? (resolveValidatedProductCode(
              [supplierConfig?.productCode, rawItemCode, aiSuggestedProductCode],
              productOptions,
            ) ?? '')
          : (supplierConfig?.accountCode ?? rawItemCode ?? '')

    return {
      localId: createLocalId(),
      tipo: itemTipo,
      producto,
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

/** true si algún ítem de tipo 'Product' quedó sin código resuelto — ni la
 * regla exacta del proveedor, ni el historial, ni la IA encontraron uno que
 * exista en el catálogo real de productos (caso real: primera compra de un
 * producto nuevo, ej. "cremallera azul", sin código SIIGO conocido todavía).
 * A diferencia de un ítem 'Account' sin código (que puede caer al fallback
 * de cuenta a nivel de documento, ver buildSiigoPurchaseSendRequest), un
 * Producto sin código SIEMPRE requiere completarlo a mano — SIIGO exige un
 * código de producto real por línea, no existe un "producto por defecto" a
 * nivel de documento. */
export function hasUnresolvedProductItem(
  items: PurchaseInvoiceItemDraft[] | undefined,
): boolean {
  if (!items || items.length === 0) {
    return false
  }

  return items.some(
    (item) => item.tipo === 'Product' && item.producto.trim().length === 0,
  )
}

/** true si algún ítem quedó sin descripción — a diferencia de
 * hasUnresolvedProductItem (que solo mira el código de ítems Producto), esto
 * aplica a CUALQUIER tipo de ítem: si el usuario borra la descripción, no
 * hay ningún valor por defecto al que caer y "Enviar" debe bloquearse. */
export function hasEmptyItemDescription(
  items: PurchaseInvoiceItemDraft[] | undefined,
): boolean {
  if (!items || items.length === 0) {
    return false
  }

  return items.some((item) => item.description.trim().length === 0)
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
