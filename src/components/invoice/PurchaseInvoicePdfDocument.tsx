import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import type {
  PurchaseInvoiceDownload,
  PurchaseInvoiceDownloadParty,
} from '../../types/electronicDocument'
import { disablePdfHyphenation, keepPdfWordIntact } from '../../utils/pdfTextWrap'

disablePdfHyphenation()

// Layout adapted from FV1195-representacion-JARVIS.html supplied by the user.
// React PDF keeps text selectable and paginates long invoices without rasterizing HTML.
const mm = (value: number) => (value * 72) / 25.4
const styles = StyleSheet.create({
  page: {
    paddingTop: mm(14),
    paddingHorizontal: mm(10),
    paddingBottom: mm(16),
    fontFamily: 'Helvetica',
    fontSize: 8.7,
    color: '#00132d',
  },
  title: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: mm(8),
  },
  subtitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: mm(3),
  },
  section: {
    marginTop: mm(3),
    marginBottom: mm(2),
  },
  sectionTopRule: { height: mm(2.2), backgroundColor: '#a5f5cf' },
  sectionBottomRule: { height: mm(0.7), backgroundColor: '#92f0c4' },
  sectionTitle: {
    paddingLeft: mm(14),
    paddingTop: mm(0.7),
    paddingBottom: mm(0.7),
    color: '#707070',
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  details: { marginHorizontal: mm(16) },
  columns: { flexDirection: 'row', marginHorizontal: mm(16), gap: mm(10) },
  column: { flex: 1, minWidth: 0 },
  field: { marginBottom: 1 },
  label: { fontFamily: 'Helvetica-Bold', color: '#616161' },
  cufe: { fontSize: 8, marginBottom: mm(1) },
  tableRow: { flexDirection: 'row', alignItems: 'stretch' },
  cell: {
    borderWidth: mm(0.175),
    borderColor: '#21d98a',
    paddingVertical: mm(0.7),
    paddingHorizontal: mm(0.35),
    fontSize: 6.3,
    textAlign: 'center',
    justifyContent: 'center',
  },
  head: { backgroundColor: '#c5efd5', fontFamily: 'Helvetica-Bold' },
  description: { fontSize: 6, textTransform: 'uppercase' },
  code: { fontFamily: 'Courier', fontSize: 6.3 },
  referenceRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  referenceCell: {
    width: '33.333%',
    padding: mm(1),
    textAlign: 'center',
    fontSize: 8,
  },
  note: { fontSize: 8, lineHeight: 1.25 },
  totals: { flexDirection: 'row', gap: mm(10), marginTop: mm(2) },
  qrColumn: { width: mm(45) },
  qr: { width: mm(36), height: mm(36) },
  provenance: { fontSize: 8.2, lineHeight: 1.2, marginTop: mm(2) },
  provenanceLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginTop: mm(2),
  },
  summaryColumn: { flex: 1, marginLeft: mm(15) },
  currency: {
    borderWidth: mm(0.7),
    borderColor: '#888',
    backgroundColor: '#c4efd5',
    padding: mm(1.5),
    fontSize: 7,
    lineHeight: 1.4,
  },
  currencyRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summary: {
    marginTop: mm(4),
    borderWidth: mm(0.7),
    borderColor: '#888',
    fontSize: 7,
  },
  totalRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
    paddingVertical: mm(0.8),
    paddingHorizontal: mm(1),
  },
  band: {
    backgroundColor: '#dedede',
    fontFamily: 'Helvetica-Bold',
    borderTopWidth: 1,
    borderTopColor: '#888',
    borderBottomWidth: 1,
    borderBottomColor: '#888',
  },
  totalLabel: { flex: 1 },
  totalValue: { width: '35%', textAlign: 'right' },
  infoTitle: { fontSize: 7.3, fontFamily: 'Helvetica-Bold', marginTop: mm(4) },
  authorization: {
    flexDirection: 'row',
    gap: mm(8),
    marginTop: mm(5),
    fontSize: 7.2,
  },
  footer: {
    position: 'absolute',
    left: mm(10),
    right: mm(10),
    bottom: mm(5),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    fontSize: 8,
    color: '#444',
  },
  folio: { fontSize: 12, color: '#111' },
})
const widths = [4, 6, 14, 5.5, 7.5, 11, 11, 11, 8, 4, 7, 3, 7.5]
const headers = [
  'Nro.',
  'Código',
  'Descripción',
  'U/M',
  'Cantidad',
  'Precio unitario',
  'Descuento detalle',
  'Recargo detalle',
  'IVA',
  '%',
  'INC',
  '%',
  'Precio unitario de venta',
]
const decimal = (n: number | null | undefined) =>
  n == null
    ? ''
    : new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n)
const date = (s?: string | null) =>
  s?.replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, '$3/$2/$1') ?? ''
const textBreaks = (word: string) =>
  word.length > 18 ? (word.match(/.{1,12}/gu) ?? [word]) : [word]
// Seven monospace characters fit the code column, including its borders and padding.
// Explicit line breaks preserve the identifier without adding hyphens.
const wrapItemCode = (code: string) => code.match(/.{1,7}/gu)?.join('\n') ?? ''
const preserveCodeCharacters = (word: string) => [word]
function Field({
  label,
  value,
  keepWord,
}: {
  label: string
  value?: string | null
  keepWord?: boolean
}) {
  return (
    <Text
      style={styles.field}
      hyphenationCallback={keepWord ? keepPdfWordIntact : textBreaks}
    >
      <Text style={styles.label}>{label} </Text>
      {value ?? ''}
    </Text>
  )
}
function Section({ children, topRule = false }: { children: string; topRule?: boolean }) {
  return (
    <View style={styles.section} wrap={false} minPresenceAhead={18}>
      {topRule && <View style={styles.sectionTopRule} />}
      <Text style={styles.sectionTitle}>{children}</Text>
      <View style={styles.sectionBottomRule} />
    </View>
  )
}
function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>PDF generado por JARVIS a partir del XML de la factura</Text>
      <Text
        style={styles.folio}
        render={({ pageNumber, totalPages }) =>
          `Hoja ${pageNumber} de ${totalPages}`
        }
      />
    </View>
  )
}
function Party({
  party: p,
  issuer,
}: {
  party: PurchaseInvoiceDownloadParty
  issuer?: boolean
}) {
  return (
    <View style={styles.columns} wrap={false}>
      <View style={styles.column}>
        <Field
          label={issuer ? 'Razón Social:' : 'Nombre o Razón Social:'}
          value={p.name}
          keepWord
        />
        {issuer ? (
          <Field label="Nombre Comercial:" value={p.tradeName} keepWord />
        ) : (
          <Field label="Tipo de Documento:" value={p.documentType} />
        )}
        <Field
          label={issuer ? 'Nit del Emisor:' : 'Número Documento:'}
          value={
            p.documentNumber
              ? `${p.documentNumber}${p.checkDigit ? `-${p.checkDigit}` : ''}`
              : ''
          }
        />
        <Field label="Tipo de Contribuyente:" value={p.contributorType} />
        <Field label="Régimen Fiscal:" value={p.fiscalRegime} />
        <Field
          label="Responsabilidad tributaria:"
          value={p.taxResponsibility}
        />
        {issuer && (
          <Field label="Actividad Económica:" value={p.economicActivity} />
        )}
      </View>
      <View style={styles.column}>
        <Field label="País:" value={p.countryName} />
        <Field label="Departamento:" value={p.departmentName} />
        <Field label="Municipio / Ciudad:" value={p.cityName} />
        <Field label="Dirección:" value={p.address} />
        <Field label="Teléfono / Móvil:" value={p.phone} />
        <Field label="Correo:" value={p.email} />
      </View>
    </View>
  )
}
function TotalRow({
  label,
  amount,
  strong = false,
}: {
  label: string
  amount?: number | null
  strong?: boolean
}) {
  return (
    <View style={strong ? [styles.totalRow, styles.band] : styles.totalRow}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>{decimal(amount)}</Text>
    </View>
  )
}

export function renderPurchaseInvoicePdfDocument(
  data: PurchaseInvoiceDownload,
  qrDataUrl: string,
) {
  const money = (n: number | null | undefined) =>
    n == null ? '' : `$ ${decimal(n)}`
  const taxes = data.taxes ?? []
  const taxSum = (pattern: RegExp) =>
    taxes
      .filter((t) => pattern.test(t.type))
      .reduce((sum, t) => sum + t.amount, 0)
  const inc = taxSum(/INC|CONSUMO/i),
    bags = taxSum(/BOLSA/i)
  const other = taxes
    .filter((t) => !/IVA|INC|CONSUMO|BOLSA|RETE/i.test(t.type))
    .reduce((sum, t) => sum + t.amount, 0)
  const totalTax = data.iva + inc + bags + other
  const retention = (code: string) =>
    data.withholdings
      .filter((t) => t.dianTaxCode === code)
      .reduce((sum, t) => sum + (t.amount ?? 0), 0)
  const detailDiscount = data.items.reduce(
    (sum, t) => sum + (t.discount ?? 0),
    0,
  )
  const detailSurcharge = data.items.reduce(
    (sum, t) => sum + (t.surcharge ?? 0),
    0,
  )
  const auth = data.authorization
  return (
    <Document
      title={`Factura ${data.invoiceNumber ?? data.cufe}`}
      author="JARVIS"
    >
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>FACTURA ELECTRÓNICA DE VENTA</Text>
        <Text style={styles.subtitle}>Representación Gráfica</Text>
        <Section topRule>Datos del Documento</Section>
        <View style={styles.details}>
          <Text style={styles.label}>Código Único de Factura - CUFE :</Text>
          <Text style={styles.cufe} hyphenationCallback={textBreaks}>
            {data.cufe}
          </Text>
        </View>
        <View style={styles.columns} wrap={false}>
          <View style={styles.column}>
            <Field label="Número de Factura:" value={data.invoiceNumber} />
            <Field label="Fecha de Emisión:" value={date(data.issueDate)} />
            <Field label="Fecha de Vencimiento:" value={date(data.dueDate)} />
            <Field label="Tipo de Operación:" value={data.operationType} />
          </View>
          <View style={styles.column}>
            <Field
              label="Forma de pago:"
              value={
                data.isCreditPayment === null
                  ? ''
                  : data.isCreditPayment
                    ? 'Crédito'
                    : 'Contado'
              }
            />
            <Field label="Medio de Pago:" value={data.paymentMethodName} />
            <Field label="Orden de pedido:" value={data.orderNumber} />
            <Field
              label="Fecha de orden de pedido:"
              value={date(data.orderDate)}
            />
          </View>
        </View>
        <Section>Datos del Emisor / Vendedor</Section>
        <Party party={data.issuer} issuer />
        <Section>Datos del Adquiriente / Comprador</Section>
        <Party party={data.buyer} />
        <Section>Detalles de Productos</Section>
        <View>
          <View style={styles.tableRow} fixed>
            {headers.map((h, i) => (
              <View
                key={i}
                style={[styles.cell, styles.head, { width: `${widths[i]}%` }]}
              >
                <Text>{h}</Text>
              </View>
            ))}
          </View>
          {data.items.map((item, index) => {
            const cells = [
              String(index + 1),
              item.code ?? '',
              item.description,
              item.unitCode ?? '',
              decimal(item.quantity),
              money(item.unitValue),
              money(item.discount ?? 0),
              money(item.surcharge ?? 0),
              money(item.ivaAmount),
              decimal(item.ivaPercentage),
              money(item.incAmount),
              decimal(item.incPercentage),
              money(item.total),
            ]
            return (
              <View key={index} style={styles.tableRow} wrap={false}>
                {cells.map((value, col) => (
                  <View
                    key={col}
                    style={[styles.cell, { width: `${widths[col]}%` }]}
                  >
                    <Text
                      style={col === 1 ? styles.code : col === 2 ? styles.description : {}}
                      hyphenationCallback={col === 1 ? preserveCodeCharacters : textBreaks}
                    >
                      {col === 1 ? wrapItemCode(value) : value}
                    </Text>
                  </View>
                ))}
              </View>
            )
          })}
        </View>
        <Section>Referencias</Section>
        <View style={styles.referenceRow} wrap={false}>
          {[
            'Tipo de Documento Referencia',
            'Número Referencia',
            'Fecha Referencia',
          ].map((t) => (
            <Text key={t} style={[styles.referenceCell, styles.label]}>
              {t}
            </Text>
          ))}
        </View>
        {(data.references ?? []).map((ref, i) => (
          <View key={i} style={styles.referenceRow} wrap={false}>
            <Text style={styles.referenceCell}>{ref.type}</Text>
            <Text style={styles.referenceCell}>{ref.number}</Text>
            <Text style={styles.referenceCell}>{date(ref.date)}</Text>
          </View>
        ))}
        <Section>Notas Finales</Section>
        <Text style={styles.note} hyphenationCallback={textBreaks}>
          {data.observations ?? ''}
        </Text>
        <Footer />
      </Page>
      <Page size="A4" style={styles.page} wrap>
        <Section>Datos Totales</Section>
        <View style={styles.totals} wrap={false}>
          <View style={styles.qrColumn}>
            <Image src={qrDataUrl} style={styles.qr} />
            <Text style={styles.provenanceLabel}>Documento generado el:</Text>
            <Text style={styles.provenance}>
              {date(data.issueDate)} {data.issueTime ?? ''}
            </Text>
            {data.technologyProviderId && (
              <>
                <Text style={styles.provenanceLabel}>XML generado por:</Text>
                <Text style={styles.provenance}>
                  Proveedor tecnológico{'\n'}
                  {data.technologyProviderId}
                </Text>
              </>
            )}
            <Text style={styles.provenanceLabel}>PDF generado por:</Text>
            <Text style={styles.provenance}>JARVIS</Text>
          </View>
          <View style={styles.summaryColumn}>
            <View style={styles.currency}>
              <View style={styles.currencyRow}>
                <Text>MONEDA</Text>
                <Text>{data.currency}</Text>
              </View>
              <View style={styles.currencyRow}>
                <Text>TASA DE CAMBIO</Text>
                <Text>{decimal(data.exchangeRate)}</Text>
              </View>
            </View>
            <View style={styles.summary}>
              <TotalRow label="Subtotal" amount={data.subtotal} strong />
              <TotalRow label="Descuento detalle" amount={detailDiscount} />
              <TotalRow label="Recargo detalle" amount={detailSurcharge} />
              <TotalRow
                label="Total Bruto Factura"
                amount={data.subtotal}
                strong
              />
              <TotalRow label="IVA" amount={data.iva} />
              <TotalRow label="INC" amount={inc} />
              <TotalRow label="Bolsas" amount={bags} />
              <TotalRow label="Otros impuestos" amount={other} />
              <TotalRow label="Total impuesto (=)" amount={totalTax} strong />
              <TotalRow
                label="Total neto factura (=)"
                amount={
                  data.taxInclusiveAmount ??
                  data.subtotal -
                    (data.discount ?? 0) +
                    (data.surcharge ?? 0) +
                    totalTax
                }
                strong
              />
              <TotalRow
                label="Descuento Global (-)"
                amount={data.discount ?? 0}
              />
              <TotalRow
                label="Recargo Global (+)"
                amount={data.surcharge ?? 0}
              />
              <TotalRow
                label={`Total factura (=)  ${data.currency} $`}
                amount={data.total}
                strong
              />
            </View>
            <Text style={styles.infoTitle}>Valores informativos</Text>
            <View style={styles.summary}>
              <TotalRow label="ANTICIPOS" strong />
              <TotalRow label="Anticipos" amount={data.prepaidAmount ?? 0} />
            </View>
            <View style={styles.summary}>
              <TotalRow label="RETENCIONES" strong />
              <TotalRow label="Rete fuente" amount={retention('06')} />
              <TotalRow label="Rete IVA" amount={retention('05')} />
              <TotalRow label="Rete ICA" amount={retention('07')} />
            </View>
          </View>
        </View>
        <View style={styles.authorization} wrap={false}>
          <Text style={{ flex: 2.2 }}>
            Número de Autorización:{'\n'}
            {auth?.number ?? ''}
          </Text>
          <Text style={{ flex: 1 }}>
            Rango desde:{'\n'}
            {auth?.from ?? ''}
          </Text>
          <Text style={{ flex: 1 }}>
            Rango hasta:{'\n'}
            {auth?.to ?? ''}
          </Text>
          <Text style={{ flex: 1 }}>
            Vigencia:{'\n'}
            {date(auth?.endDate)}
          </Text>
        </View>
        <Footer />
      </Page>
    </Document>
  )
}
