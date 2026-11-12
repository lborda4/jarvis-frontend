import { describe, expect, it } from 'vitest'
import { isValidElement, type ReactNode } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { SalesInvoicePdfDocument } from './SalesInvoicePdfDocument'
import type { PurchaseInvoiceDownload } from '../../types/electronicDocument'

const party = { name: 'Empresa de prueba', documentType: 'NIT', documentNumber: '123456789', checkDigit: '1', address: 'Calle 1', phone: '1234567', email: 'ejemplo@example.com', cityName: 'Bogotá' }
const data: PurchaseInvoiceDownload = {
  id: 'test', cufe: 'a'.repeat(96), invoiceNumber: 'SETP123', prefix: 'SETP', issueDate: '2026-09-01', dueDate: '2026-10-01', isCreditPayment: true, currency: 'COP',
  observations: 'Observaciones originales con acentos', issuer: party, buyer: party,
  items: [{ description: 'Servicio con descripción larga para comprobar el ajuste del texto en la tabla', code: 'ABC', quantity: 2, unitValue: 100, discount: 20, ivaPercentage: 19, ivaAmount: 34.2, total: 180, taxes: [{ type: 'IVA', amount: 34.2 }] }],
  subtotal: 180, taxExclusiveAmount: 180, taxInclusiveAmount: 214.2, iva: 34.2, discount: 0, total: 214.2, withholdings: [], dianQrText: 'https://example.com/invoice/test', dianQrUrl: '',
}
describe('sales invoice HTML template adaptation', () => {
  it('aplica el diseño a un PDF de prueba sin logo, CUFE ni afirmaciones de validación', async () => {
    const { invoiceAppearanceSample } = await import('../../utils/invoiceAppearanceSample')
    const logo = await QRCode.toDataURL('logo-de-prueba')
    const sample = invoiceAppearanceSample({ id: 'company', name: 'Mi empresa', nit: '123' }, {}, {
      accentColor: '#FFEE00', footerText: 'Gracias por tu compra.', showLogo: false,
    }, logo)
    const document = SalesInvoicePdfDocument({ data: sample, qr: '' })
    const text = textContent(document)
    expect(text).toContain('FACTURA DE EJEMPLO · SIN VALIDEZ')
    expect(text).toContain('Gracias por tu compra.')
    expect(text).not.toContain('CUFE:')
    expect(text).not.toContain('Documento electrónico validado por la DIAN')
    expect(JSON.stringify(document)).toContain('"backgroundColor":"#FFEE00"')
    const buffer = await renderToBuffer(document)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buffer.toString('latin1')).not.toContain('/Subtype /Image')
  }, 30000)

  it('conserva el diseño de las notas aunque lleguen preferencias de factura', () => {
    const document = SalesInvoicePdfDocument({ data: { ...data, documentKind: 'CREDIT_NOTE', invoiceAppearance: {
      accentColor: '#FFEE00', footerText: 'Mensaje solo para facturas', showLogo: false,
    } }, qr: '' })
    expect(textContent(document)).not.toContain('Mensaje solo para facturas')
    expect(JSON.stringify(document)).not.toContain('"backgroundColor":"#FFEE00"')
  })

  function textContent(node: ReactNode): string {
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(textContent).join('')
    if (isValidElement<{ children?: ReactNode }>(node)) {
      if (typeof node.type === 'function') return textContent((node.type as (props: { children?: ReactNode }) => ReactNode)(node.props))
      return textContent(node.props.children)
    }
    return ''
  }

  it('omite datos opcionales vacíos en enviados y conserva la identificación y los datos presentes', () => {
    const missing = { ...party, address: ' ', cityName: null, phone: '-', email: '—' }
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data, issuer: missing, buyer: { ...missing, email: 'cliente@example.com' }, observations: '   ' }, qr: '' }))
    for (const label of ['Dirección:', 'Ciudad:', 'Tel:', 'Observaciones']) expect(text).not.toContain(label)
    expect(text).toContain('Correo: cliente@example.com')
    expect(text).not.toContain('Correo: —')
    expect(text).toContain(party.name!)
    expect(text).toContain(party.documentNumber!)
    expect(text).not.toContain('Resolución No.')
    expect(text).toContain('CUFE:')
  })

  it('también omite los datos opcionales vacíos en la visualización de borradores', () => {
    const missing = { ...party, address: null, cityName: '', phone: '   ', email: null }
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data, isDraft: true, issuer: missing, buyer: missing, observations: null }, qr: '' }))
    for (const label of ['Dirección:', 'Ciudad:', 'Tel:', 'Correo:', 'Observaciones']) expect(text).not.toContain(label)
    expect(text).not.toContain('—')
  })

  it.each(['CREDIT_NOTE', 'DEBIT_NOTE', 'SUPPORT_CREDIT_NOTE'])('omite toda la resolución no aplicable en %s y conserva los datos fiscales presentes', documentKind => {
    const text = textContent(SalesInvoicePdfDocument({ data: {
      ...data, documentKind, authorization: { number: '—', from: '-', to: ' ', startDate: null, endDate: null }, prefix: '—',
      issuerTaxProfile: { source: 'current', taxResponsibility: 'R-99-PN', vatRegime: 'non_vat_responsible', economicActivity: '6201' },
    }, qr: '' }))
    for (const label of ['Resolución No.', 'Prefijo:', 'Desde:', 'Hasta:', 'Vigencia:', 'resolución de facturación', '(configuración actual)']) expect(text).not.toContain(label)
    expect(text).toContain('Información tributaria')
    expect(text).toContain('Responsabilidad fiscal: R-99-PN')
    expect(text).toContain('Régimen IVA: No responsable de IVA')
    expect(text).toContain('Actividad económica: 6201')
    expect(text).not.toContain('—')
  })

  it('omite campos fiscales, fechas y pagos ausentes sin dejar etiquetas o guiones vacíos', () => {
    const text = textContent(SalesInvoicePdfDocument({ data: {
      ...data, issuerTaxProfile: { source: 'current', taxResponsibility: '—', economicActivity: '-' },
      isCreditPayment: null, issueDate: null, issueTime: '—', dueDate: null, paymentMethodName: '—', observations: '-',
    }, qr: '' }))
    for (const label of ['Información tributaria', 'Actividad económica:', 'Fecha de elaboración:', 'Fecha y hora de generación:', 'Fecha de vencimiento:', 'Forma de negociación:', 'Forma de pago:', 'Plazo:', 'Observaciones']) expect(text).not.toContain(label)
    expect(text).not.toContain('—')
  })

  it('conserva una resolución de factura completa y omite los extremos faltantes de una parcial', () => {
    const complete = textContent(SalesInvoicePdfDocument({ data: { ...data, documentKind: 'ELECTRONIC_INVOICE', authorization: {
      number: '18764113677438', from: '1', to: '10000', startDate: '2026-08-05', endDate: '2028-08-05',
    } }, qr: '' }))
    for (const field of ['Resolución No. 18764113677438', 'Prefijo: SETP', 'Desde: 1  Hasta: 10000', 'Vigencia: 2026-08-05 a 2028-08-05']) expect(complete).toContain(field)
    const partial = textContent(SalesInvoicePdfDocument({ data: { ...data, prefix: ' ', authorization: {
      number: null, from: '1', to: null, startDate: null, endDate: '2028-08-05',
    } }, qr: '' }))
    expect(partial).toContain('Desde: 1')
    expect(partial).toContain('Vigencia: Hasta 2028-08-05')
    for (const field of ['Resolución No.', 'Prefijo:', 'Hasta:']) expect(partial).not.toContain(field)
    expect(partial).not.toContain('—')
  })

  it('conserva los datos opcionales y observaciones cuando tienen contenido', () => {
    const filled = { ...party, address: 'Calle 10', cityName: 'Bogotá', phone: '3001234567', email: 'cliente@example.com' }
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data, issuer: filled, buyer: filled, observations: 'Entregar en recepción' }, qr: '' }))
    for (const field of ['Dirección: Calle 10', 'Ciudad: Bogotá', 'Tel: 3001234567', 'Correo: cliente@example.com', 'ObservacionesEntregar en recepción']) expect(text).toContain(field)
  })

  it('muestra borradores incompletos sin afirmar validación DIAN ni mostrar un CUFE', async () => {
    const { invoiceDraftPdfData } = await import('../../utils/invoiceDraftPdf')
    const draft = invoiceDraftPdfData({ id: 'draft', kind: 'ELECTRONIC_INVOICE', state: {}, settings: {}, company: { id: 'company', name: 'Mi empresa', nit: '900123456-1' } })
    const text = textContent(SalesInvoicePdfDocument({ data: draft, qr: '' }))
    expect(text).toContain('BORRADOR · SIN ENVIAR A DIAN')
    expect(text).toContain('Mi empresa')
    expect(text).not.toContain('Documento electrónico validado por la DIAN')
    expect(text).not.toContain('CUFE:')
    const buffer = await renderToBuffer(<SalesInvoicePdfDocument data={draft} qr="" />)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buffer.toString('latin1')).not.toContain('/Subtype /Image')
  }, 30000)

  it.each(['emission', 'current'] as const)('muestra los datos tributarios de Jarvis con origen %s aunque el XML difiera', source => {
    const text = textContent(SalesInvoicePdfDocument({ data: {
      ...data, issuer: { ...party, fiscalRegime: 'O-13', taxResponsibility: '01 - IVA', economicActivity: '6201' },
      issuerTaxProfile: { vatRegime: 'non_vat_responsible', economicActivity: '4923', taxResponsibility: 'R-99-PN', source },
    }, qr: '' }))
    expect(text).toContain('Régimen IVA: No responsable de IVA')
    expect(text).toContain('Actividad económica: 4923')
    expect(text).toContain('Responsabilidad fiscal: R-99-PN')
    expect(text).not.toContain('(configuración actual)')
    expect(text).not.toContain('Tributo (XML):')
    expect(text).not.toContain('O-13')
    expect(text).not.toContain('6201')
  })

  it('no sustituye la configuración ausente con datos tributarios del XML', () => {
    const text = textContent(SalesInvoicePdfDocument({ data: {
      ...data, issuer: { ...party, fiscalRegime: 'O-13', economicActivity: '6201' },
      issuerTaxProfile: { source: 'current' },
    }, qr: '' }))
    expect(text).not.toContain('O-13')
    expect(text).not.toContain('6201')
  })

  it('muestra el nombre del producto y conserva su descripción en otra columna', () => {
    const item = { ...data.items[0], name: 'Activación de facturación', code: 'FV-01' }
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data, items: [item] }, qr: '' }))
    expect(text).toContain(`1${item.name}${item.description}2`)
    expect(text).not.toContain(item.code)
  })

  it.each([4.14, 0, undefined])('muestra actividad completa y omite la tarifa ICA %s si no es positiva', icaRate => {
    const activity = '1410 - Confección de prendas de vestir, excepto prendas de piel'
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data,
      issuer: { ...party, economicActivity: '1410' },
      issuerTaxProfile: { source: 'emission', economicActivity: activity, icaRate },
    }, qr: '' }))
    expect(text).toContain(`Actividad económica: ${activity}`)
    if (icaRate) expect(text).toContain(` · Tarifa ICA: ${icaRate} ‰`)
    else expect(text).not.toContain('Tarifa ICA:')
    expect(text.indexOf('Actividad económica:')).toBeGreaterThan(text.indexOf('Vigencia:'))
    expect(text.indexOf('CUFE:')).toBeGreaterThan(text.indexOf('Actividad económica:'))
  })
  it('prioriza la actividad guardada en Jarvis aunque el XML tenga otro código', () => {
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data,
      issuer: { ...party, economicActivity: '4923' },
      issuerTaxProfile: { source: 'emission', economicActivity: '1410 - Otra actividad' },
    }, qr: '' }))
    expect(text).toContain('Actividad económica: 1410 - Otra actividad')
    expect(text).not.toContain('Tarifa ICA:')
    expect(text).not.toContain('Actividad económica: 4923')
  })

  it.each([undefined, null, '', '   ', 'ABC'])('usa la descripción si el nombre es %s sin mostrar el código', name => {
    const item = { ...data.items[0], name }
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data, items: [item] }, qr: '' }))
    expect(text).toContain(`1${item.description}${item.description}2`)
    expect(text).not.toContain(item.code!)
  })

  it('muestra el contado y el saldo a crédito con sus medios e importes', () => {
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data, paymentBreakdown: [
      { methodId: 'cash', methodName: 'Efectivo', nextpymeMethodId: 10, negotiation: 'CASH', amount: 100 },
      { methodId: 'credit', methodName: 'Crédito clientes', nextpymeMethodId: 1, negotiation: 'CREDIT', amount: 114.2 },
    ] }, qr: '' }))
    expect(text).toContain('Forma de negociación: Contado y crédito')
    expect(text).toContain('Efectivo (Contado): 100,00')
    expect(text).toContain('Crédito clientes (Crédito): 114,20')
    expect(text).toContain('Fecha de vencimiento: 2026-10-01')
  })

  it('muestra todos los vendedores asignados y omite el campo en documentos antiguos', () => {
    const sellers = [{ id: 'seller-1', name: 'Laura Pérez' }, { id: 'seller-2', name: 'Juan Díaz' }]
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data, sellers }, qr: '' }))
    expect(text).toContain('Vendedores: Laura Pérez, Juan Díaz')
    expect(textContent(SalesInvoicePdfDocument({ data, qr: '' }))).not.toContain('Vendedores:')
  })

  it.each([1039.5, 1011.24])('descuenta las tres retenciones sin restarlas dos veces cuando el total recibido es %s', total => {
    const text = textContent(SalesInvoicePdfDocument({ data: {
      ...data, subtotal: 990, taxExclusiveAmount: 990, taxInclusiveAmount: 1039.5, iva: 49.5, total,
      withholdings: [
        { dianTaxCode: '06', name: 'ReteFuente', percentage: 1, amount: 9.9 },
        { dianTaxCode: '07', name: 'ReteICA', percentage: 11.04, amount: 10.93 },
        { dianTaxCode: '05', name: 'ReteIVA', percentage: 15, amount: 7.43 },
      ],
    }, qr: '' }))
    expect(text).toContain('Total antes de retenciones:1.039,50')
    expect(text).toContain('Total neto a pagar:1.011,24')
    expect(text).not.toContain('Total neto a pagar:1.039,50')
    expect(text).toContain('MIL ONCE')
  })

  it('muestra el porcentaje de retención del documento cuando la línea no lo trae', () => {
    const text = textContent(SalesInvoicePdfDocument({
      data: {
        ...data,
        withholdings: [{ dianTaxCode: '06', name: 'ReteFuente', percentage: 3.5, amount: 260 }],
      },
      qr: '',
    }))
    expect(text).toContain('3.5')
    expect(text).toContain('-260,00')
  })

  it('adapta título, tercero y código único según el tipo de documento', () => {
    const text = textContent(SalesInvoicePdfDocument({
      data: { ...data, documentKind: 'SUPPORT_CREDIT_NOTE' },
      qr: '',
    }))
    expect(text).toContain('Nota de Ajuste')
    expect(text).toContain('CUDS:')
    expect(text).toContain('nota de ajuste al documento soporte electrónico')
    expect(text).not.toContain('CUFE:')
  })

  it('oculta el vencimiento en contado aunque el XML incluya una fecha', () => {
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data, isCreditPayment: false }, qr: '' }))
    expect(text).not.toContain('Fecha de vencimiento:')
    expect(text).not.toContain(data.dueDate!)
  })

  it('muestra en crédito la fecha de vencimiento del documento', () => {
    const text = textContent(SalesInvoicePdfDocument({ data, qr: '' }))
    expect(text).toContain('Fecha de vencimiento: 2026-10-01')
  })

  it('envuelve un nombre largo en otra línea sin cortar la palabra', async () => {
    const longName = 'BORDA BELTRAN LAURA SOFIA'
    const buffer = await renderToBuffer(<SalesInvoicePdfDocument data={{
      ...data,
      issuer: { ...party, name: longName, tradeName: longName },
    }} qr="" />)
    const raw = buffer.toString('latin1')
    expect(raw).not.toMatch(/LAU-/)
    expect(raw).toContain('LAURA')
  }, 30000)

  it('renders the company logo in a real PDF', async () => {
    const logoDataUrl = await QRCode.toDataURL('company-logo-fixture')
    const buffer = await renderToBuffer(<SalesInvoicePdfDocument data={{ ...data, logoDataUrl }} qr={logoDataUrl} />)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buffer.toString('latin1')).toContain('/Subtype /Image')
  }, 30000)

  it('mantiene una factura completa con logo, perfil fiscal y mensaje al pie en una hoja', async () => {
    const qr = await QRCode.toDataURL(data.dianQrText)
    const fullInvoice: PurchaseInvoiceDownload = {
      ...data, documentKind: 'ELECTRONIC_INVOICE', logoDataUrl: qr,
      issuer: { ...party, name: 'JARVIS COLOMBIA S.A.S.', tradeName: 'JARVIS COLOMBIA S.A.S.', address: 'CALLE 48C SUR #25-44', email: 'contabilidad@empresa.example.com' },
      buyer: { ...party, name: 'COMERCIALIZADORA NACIONAL DE PRODUCTOS Y SERVICIOS S.A.S.', address: 'Carrera 15 # 40-20 Oficina 302', email: 'facturacion@cliente.example.com' },
      issuerTaxProfile: { source: 'current', taxResponsibility: 'R-99-PN', vatRegime: 'non_vat_responsible', economicActivity: '1410 - Confección de prendas de vestir, excepto prendas de piel', icaRate: 4.14 },
      authorization: { number: '18764113677438', from: '1', to: '10000', startDate: '2026-08-05', endDate: '2028-08-05' },
      invoiceAppearance: { accentColor: '#16335B', showLogo: true, footerText: 'Gracias por confiar en nosotros. Conserva esta factura como soporte de tu compra.' },
    }
    const buffer = await renderToBuffer(<SalesInvoicePdfDocument data={fullInvoice} qr={qr} />)
    expect(buffer.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1)
  }, 30000)

  it.each([1, 70])('renders a real PDF for %i lines', async count => {
    const qr = await QRCode.toDataURL(data.dianQrText)
    const buffer = await renderToBuffer(<SalesInvoicePdfDocument data={{ ...data, items: Array.from({ length: count }, () => data.items[0]) }} qr={qr} />)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    const pages = buffer.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0
    if (count === 1) expect(pages).toBe(1)
    else expect(pages).toBeGreaterThan(1)
  }, 30000)
})
