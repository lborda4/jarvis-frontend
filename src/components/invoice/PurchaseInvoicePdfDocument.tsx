import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import dianLogo from '../../assets/dian-logo.png'
import type {
  PurchaseInvoiceDownload,
  PurchaseInvoiceDownloadItem,
  PurchaseInvoiceDownloadParty,
} from '../../types/electronicDocument'

/**
 * Representación gráfica alineada a la plantilla HTML de la Solución
 * Gratuita DIAN y a la Res. 000165/2023 art. 11.
 */
const colors = {
  ink: '#001028',
  muted: '#595959',
  title: '#747474',
  mint: '#99FFCC',
  mintSoft: '#C3E6CB',
  tableHead: '#BAF1D6',
  tableLine: '#41D78C',
  line: '#808080',
  panel: '#DADADA',
  thinLine: '#E9E8E8',
  white: '#FFFFFF',
}

const COLS = {
  nro: '4.1%',
  code: '5.6%',
  desc: '14%',
  um: '5.6%',
  qty: '7.3%',
  price: '11.3%',
  disc: '11.3%',
  surch: '11.3%',
  iva: '7.8%',
  ivaPct: '4.2%',
  inc: '7.1%',
  incPct: '2.8%',
  line: '7.6%',
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: colors.ink,
    paddingTop: 40,
    paddingBottom: 28,
    paddingHorizontal: 28,
    backgroundColor: colors.white,
  },
  header: {
    position: 'relative',
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 5.8,
    borderBottomColor: colors.mint,
    alignItems: 'center',
    marginBottom: 12,
  },
  logoLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 72,
    height: 24,
  },
  logoRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 72,
    height: 24,
  },
  headerTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    color: colors.ink,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 13,
    marginTop: 12,
    color: colors.ink,
    textAlign: 'center',
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: colors.title,
    paddingBottom: 2,
    paddingHorizontal: 8,
    marginBottom: 6,
    borderBottomWidth: 1.7,
    borderBottomColor: colors.mint,
  },
  stackedField: {
    marginBottom: 6,
    paddingHorizontal: 18,
  },
  columns: {
    flexDirection: 'row',
    paddingHorizontal: 18,
  },
  column: {
    width: '50%',
    paddingRight: 10,
  },
  field: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  label: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: colors.muted,
    marginRight: 6,
  },
  value: {
    fontSize: 9,
    color: colors.ink,
    flex: 1,
  },
  cufeValue: {
    fontSize: 8,
    color: colors.ink,
  },
  table: {
    width: '100%',
  },
  tableGroup: {
    flexDirection: 'row',
  },
  th: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.6,
    color: colors.ink,
    backgroundColor: colors.tableHead,
    borderWidth: 0.6,
    borderColor: colors.tableLine,
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  td: {
    fontSize: 6.6,
    borderWidth: 0.6,
    borderColor: colors.tableLine,
    paddingVertical: 2,
    paddingHorizontal: 1.5,
  },
  tdCenter: {
    textAlign: 'center',
  },
  tdRight: {
    textAlign: 'right',
  },
  totalsWrap: {
    flexDirection: 'row',
    marginTop: 12,
    alignItems: 'flex-start',
  },
  qrCol: {
    width: '32%',
    paddingRight: 12,
  },
  qr: {
    width: 78,
    height: 78,
    marginBottom: 6,
  },
  qrHint: {
    fontSize: 7,
    color: colors.muted,
    lineHeight: 1.3,
  },
  totalsCol: {
    width: '68%',
    alignItems: 'flex-end',
  },
  currencyCard: {
    width: 186,
    backgroundColor: colors.mintSoft,
    borderWidth: 1.2,
    borderColor: colors.line,
    marginBottom: 8,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  currencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    paddingVertical: 1,
  },
  totalsCard: {
    width: 186,
    borderWidth: 1.2,
    borderColor: colors.line,
  },
  totalRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.thinLine,
  },
  totalLabel: {
    width: '58%',
    fontSize: 8,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  totalValue: {
    width: '42%',
    fontSize: 8,
    textAlign: 'right',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  band: {
    backgroundColor: colors.panel,
    fontFamily: 'Helvetica-Bold',
  },
  infoTitle: {
    width: 186,
    marginTop: 10,
    marginBottom: 6,
    fontSize: 8,
  },
  infoCard: {
    width: 186,
    borderWidth: 1.2,
    borderColor: colors.line,
    marginBottom: 8,
  },
  infoHead: {
    backgroundColor: colors.panel,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderBottomWidth: 1.2,
    borderBottomColor: colors.line,
  },
  observations: {
    minHeight: 24,
    paddingHorizontal: 8,
    fontSize: 9,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 10,
    left: 28,
    right: 28,
    fontSize: 8,
    textAlign: 'right',
    color: colors.ink,
  },
})

function formatIsoDate(value: string | null): string {
  if (!value) {
    return ''
  }

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (isoDate) {
    return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`
  }

  const colombianDate = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
  if (colombianDate) {
    return `${colombianDate[1]}/${colombianDate[2]}/${colombianDate[3]}`
  }

  return value
}

function formatMoney(amount: number | null | undefined, currency: string): string {
  if (amount == null || !Number.isFinite(amount)) {
    return ''
  }

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency || 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDecimal(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) {
    return ''
  }

  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 4,
  }).format(amount)
}

function formatNit(number: string | null, checkDigit: string | null): string {
  if (!number) {
    return ''
  }

  const digits = number.replace(/\D/g, '') || number
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return checkDigit ? `${grouped}-${checkDigit}` : grouped
}

function formatPaymentForm(isCreditPayment: boolean | null): string {
  if (isCreditPayment === true) {
    return 'Crédito'
  }

  if (isCreditPayment === false) {
    return 'Contado'
  }

  return ''
}

function lineIvaAmount(item: PurchaseInvoiceDownloadItem): number | null {
  if (item.ivaAmount != null) {
    return item.ivaAmount
  }

  if (item.ivaPercentage == null) {
    return null
  }

  return item.total * (item.ivaPercentage / 100)
}

function taxAmount(
  data: PurchaseInvoiceDownload,
  aliases: string[],
): number | null {
  const match = (data.taxes ?? []).find((tax) =>
    aliases.some((alias) => tax.type.toUpperCase().includes(alias)),
  )

  return match ? match.amount : null
}

function withholdingAmount(
  data: PurchaseInvoiceDownload,
  matchers: string[],
): number | null {
  const found = data.withholdings.find((item) => {
    const haystack = `${item.name} ${item.dianTaxCode}`.toLowerCase()
    return matchers.some((matcher) => haystack.includes(matcher))
  })

  if (!found) {
    return null
  }

  if (found.amount != null) {
    return found.amount
  }

  return data.subtotal * (found.percentage / 100)
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || ''}</Text>
    </View>
  )
}

function TotalRow({
  label,
  value,
  band = false,
}: {
  label: string
  value: string
  band?: boolean
}) {
  return (
    <View style={styles.totalRow}>
      <Text style={band ? [styles.totalLabel, styles.band] : styles.totalLabel}>
        {label}
      </Text>
      <Text style={band ? [styles.totalValue, styles.band] : styles.totalValue}>
        {value}
      </Text>
    </View>
  )
}

function PartyBlock({
  party,
  issuer,
}: {
  party: PurchaseInvoiceDownloadParty
  issuer: boolean
}) {
  const nit = formatNit(party.documentNumber, party.checkDigit)

  if (issuer) {
    return (
      <View style={styles.columns}>
        <View style={styles.column}>
          <Field label="Razón Social:" value={party.name} />
          <Field
            label="Nombre Comercial:"
            value={party.tradeName || party.name}
          />
          <Field label="Nit del Emisor:" value={nit} />
          <Field label="Tipo de Contribuyente:" value="" />
          <Field label="Régimen Fiscal:" value="" />
          <Field label="Responsabilidad tributaria:" value="" />
          <Field label="Actividad Económica:" value="" />
        </View>
        <View style={styles.column}>
          <Field label="País:" value={party.countryName} />
          <Field label="Departamento:" value={party.departmentName} />
          <Field label="Municipio / Ciudad:" value={party.cityName} />
          <Field label="Dirección:" value={party.address} />
          <Field label="Teléfono / Móvil:" value={party.phone} />
          <Field label="Correo:" value={party.email} />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.columns}>
      <View style={styles.column}>
        <Field label="Nombre o Razón Social:" value={party.name} />
        <Field label="Tipo de Documento:" value={party.documentType || 'NIT'} />
        <Field label="Número Documento:" value={nit} />
        <Field label="Tipo de Contribuyente:" value="" />
        <Field label="Régimen fiscal:" value="" />
        <Field label="Responsabilidad tributaria:" value="" />
      </View>
      <View style={styles.column}>
        <Field label="País:" value={party.countryName} />
        <Field label="Departamento:" value={party.departmentName} />
        <Field label="Municipio / Ciudad:" value={party.cityName} />
        <Field label="Dirección:" value={party.address} />
        <Field label="Teléfono / Móvil:" value={party.phone} />
        <Field label="Correo:" value={party.email} />
      </View>
    </View>
  )
}

export function renderPurchaseInvoicePdfDocument(
  data: PurchaseInvoiceDownload,
  qrDataUrl: string,
) {
  const money = (amount: number | null | undefined) =>
    formatMoney(amount, data.currency)
  const items =
    data.items.length > 0
      ? data.items
      : [
          {
            description: 'Factura electrónica recibida',
            code: null,
            quantity: 1,
            unitValue: data.subtotal,
            discount: null,
            surcharge: null,
            ivaPercentage: null,
            ivaAmount: null,
            total: data.subtotal,
          },
        ]

  const detailDiscount = items.reduce(
    (sum, item) => sum + (item.discount ?? 0),
    0,
  )
  const detailSurcharge = items.reduce(
    (sum, item) => sum + (item.surcharge ?? 0),
    0,
  )
  const inc = taxAmount(data, ['INC', 'CONSUMO'])
  const bags = taxAmount(data, ['BOLSA'])
  const otherTaxes = (data.taxes ?? [])
    .filter((tax) => {
      const type = tax.type.toUpperCase()
      return !['IVA', 'INC', 'CONSUMO', 'BOLSA', 'RETE'].some((alias) =>
        type.includes(alias),
      )
    })
    .reduce((sum, tax) => sum + tax.amount, 0)
  const totalTax = data.iva + (inc ?? 0) + (bags ?? 0) + otherTaxes
  const globalDiscount = data.discount ?? 0
  const globalSurcharge = data.surcharge ?? 0
  const reteFuente = withholdingAmount(data, ['fuente', '06'])
  const reteIva = withholdingAmount(data, ['reteiva', 'rete iva', '05'])
  const reteIca = withholdingAmount(data, ['ica', '07'])

  return (
    <Document
      title={`Factura electrónica de venta ${data.invoiceNumber || data.cufe}`}
      author="Jarvis"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Image src={dianLogo} style={styles.logoLeft} />
          <Text style={styles.headerTitle}>FACTURA ELECTRÓNICA DE VENTA</Text>
          <Text style={styles.headerSub}>Representación Gráfica</Text>
          <Image src={dianLogo} style={styles.logoRight} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos del Documento</Text>
          <View style={styles.stackedField}>
            <Text style={styles.label}>Código Único de Factura - CUFE :</Text>
            <Text style={styles.cufeValue}>{data.cufe}</Text>
          </View>
          <View style={styles.columns}>
            <View style={styles.column}>
              <Field label="Número de Factura:" value={data.invoiceNumber} />
              <Field
                label="Fecha de Emisión:"
                value={formatIsoDate(data.issueDate)}
              />
              <Field
                label="Fecha de Vencimiento:"
                value={formatIsoDate(data.dueDate)}
              />
              <Field label="Tipo de Operación:" value="" />
            </View>
            <View style={styles.column}>
              <Field
                label="Forma de pago:"
                value={formatPaymentForm(data.isCreditPayment)}
              />
              <Field label="Medio de Pago:" value={data.paymentMethodName} />
              <Field label="Orden de pedido:" value="" />
              <Field label="Fecha de orden de pedido:" value="" />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos del Emisor / Vendedor</Text>
          <PartyBlock party={data.issuer} issuer />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Datos del Adquiriente / Comprador
          </Text>
          <PartyBlock party={data.buyer} issuer={false} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalles de Productos</Text>
          <View style={styles.table}>
            <View style={styles.tableGroup} fixed>
              <Text style={[styles.th, { width: COLS.nro }]}>Nro.</Text>
              <Text style={[styles.th, { width: COLS.code }]}>Código</Text>
              <Text style={[styles.th, { width: COLS.desc }]}>Descripción</Text>
              <Text style={[styles.th, { width: COLS.um }]}>U/M</Text>
              <Text style={[styles.th, { width: COLS.qty }]}>Cantidad</Text>
              <Text style={[styles.th, { width: COLS.price }]}>
                Precio unitario
              </Text>
              <Text style={[styles.th, { width: COLS.disc }]}>
                Descuento detalle
              </Text>
              <Text style={[styles.th, { width: COLS.surch }]}>
                Recargo detalle
              </Text>
              <Text style={[styles.th, { width: COLS.iva }]}>IVA</Text>
              <Text style={[styles.th, { width: COLS.ivaPct }]}>%</Text>
              <Text style={[styles.th, { width: COLS.inc }]}>INC</Text>
              <Text style={[styles.th, { width: COLS.incPct }]}>%</Text>
              <Text style={[styles.th, { width: COLS.line }]}>
                Precio unitario de venta
              </Text>
            </View>
            {items.map((item, index) => (
              <View
                key={`${item.description}-${index}`}
                style={styles.tableGroup}
                wrap={false}
              >
                <Text style={[styles.td, styles.tdCenter, { width: COLS.nro }]}>
                  {index + 1}
                </Text>
                <Text style={[styles.td, styles.tdCenter, { width: COLS.code }]}>
                  {item.code || ''}
                </Text>
                <Text style={[styles.td, styles.tdCenter, { width: COLS.desc }]}>
                  {item.description}
                </Text>
                <Text style={[styles.td, { width: COLS.um }]} />
                <Text style={[styles.td, styles.tdRight, { width: COLS.qty }]}>
                  {formatDecimal(item.quantity)}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: COLS.price }]}>
                  {money(item.unitValue)}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: COLS.disc }]}>
                  {money(item.discount ?? 0)}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: COLS.surch }]}>
                  {money(item.surcharge ?? 0)}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: COLS.iva }]}>
                  {money(lineIvaAmount(item))}
                </Text>
                <Text
                  style={[styles.td, styles.tdCenter, { width: COLS.ivaPct }]}
                >
                  {formatDecimal(item.ivaPercentage)}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: COLS.inc }]} />
                <Text
                  style={[styles.td, styles.tdCenter, { width: COLS.incPct }]}
                />
                <Text style={[styles.td, styles.tdRight, { width: COLS.line }]}>
                  {money(item.total)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.totalsWrap} wrap={false}>
          <View style={styles.qrCol}>
            <Image src={qrDataUrl} style={styles.qr} />
            <Text style={styles.qrHint}>
              Escanee el QR para validar el documento en el catálogo DIAN.
            </Text>
          </View>
          <View style={styles.totalsCol}>
            <Text style={[styles.sectionTitle, { alignSelf: 'stretch' }]}>
              Datos Totales
            </Text>
            <View style={styles.currencyCard}>
              <View style={styles.currencyRow}>
                <Text>MONEDA</Text>
                <Text>{data.currency}</Text>
              </View>
            </View>
            <View style={styles.totalsCard}>
              <TotalRow label="Subtotal" value={money(data.subtotal)} band />
              <TotalRow
                label="Descuento detalle"
                value={money(detailDiscount)}
              />
              <TotalRow
                label="Recargo detalle"
                value={money(detailSurcharge)}
              />
              <TotalRow
                label="Total Bruto Factura"
                value={money(data.subtotal - globalDiscount)}
                band
              />
              <TotalRow label="IVA" value={money(data.iva)} />
              <TotalRow label="INC" value={money(inc ?? 0)} />
              <TotalRow label="Bolsas" value={money(bags ?? 0)} />
              <TotalRow label="Otros impuestos" value={money(otherTaxes)} />
              <TotalRow
                label="Total impuesto (=)"
                value={money(totalTax)}
                band
              />
              <TotalRow
                label="Total neto factura (=)"
                value={money(data.total)}
                band
              />
              <TotalRow
                label="Descuento Global (-)"
                value={money(globalDiscount)}
              />
              <TotalRow
                label="Recargo Global (+)"
                value={money(globalSurcharge)}
              />
              <TotalRow
                label="Total factura (=)"
                value={money(data.total)}
                band
              />
            </View>
            <Text style={styles.infoTitle}>Valores informativos</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoHead}>ANTICIPOS</Text>
              <TotalRow label="Anticipos" value={money(0)} />
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoHead}>RETENCIONES</Text>
              <TotalRow label="Rete fuente" value={money(reteFuente ?? 0)} />
              <TotalRow label="Rete IVA" value={money(reteIva ?? 0)} />
              <TotalRow label="Rete ICA" value={money(reteIca ?? 0)} />
            </View>
          </View>
        </View>

        {data.observations ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Observaciones</Text>
            <Text style={styles.observations}>{data.observations}</Text>
          </View>
        ) : null}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Hoja ${pageNumber} de ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
