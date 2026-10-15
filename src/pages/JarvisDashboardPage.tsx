import { WHATSAPP_DOCUMENTS_HREF } from '../constants/contact'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { apiClient } from '../services/apiClient'
import ErrorMessage from '../components/ErrorMessage'
import { CalendarIcon, InvoiceIcon, PackageIcon, ChevronRightIcon } from '../components/icons/SidebarIcons'
import './JarvisDashboardPage.css'

interface DashboardMonth { month: string; sales: number; support: number; salesCount: number; supportCount: number }
interface DashboardData { topProducts: { code: string; name: string; quantity: number; sales: number }[]; month: string; series: DashboardMonth[]; current: DashboardMonth; taxes: { iva: number; detailedDocuments: number; salesDocuments: number; reteRenta: number; reteIca: number; reteIva: number; retentionDocuments: number; documents: number } }
const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
const monthLabel = (value: string) => new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + '-01T00:00:00Z'))

export default function JarvisDashboardPage() {
  const { user } = useAuth()
  const { documentLimit, documentsRemaining, documentsUsed, isSubscriptionActive, isSalesInvoiceEnabled, isSupportDocumentEnabled, setupPath } = useIntegrationSetup()
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' }).format(new Date()))
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setData(null); setError('')
    apiClient.get<DashboardData>('/integrations/jarvis/dashboard', { params: { month } })
      .then(response => { if (active) setData(response.data) })
      .catch(() => { if (active) setError('No pudimos cargar el tablero. Inténtalo nuevamente.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user?.company?.id, month, attempt])
  const max = Math.max(1, ...(data?.series.flatMap(item => [item.sales, item.support]) ?? []))
  const ceiling = max <= 1 ? 1 : Math.ceil(max / 10 ** Math.floor(Math.log10(max))) * 10 ** Math.floor(Math.log10(max))
  const remaining = documentsRemaining ?? Math.max(0, (documentLimit ?? 0) - documentsUsed)
  const availableRatio = documentLimit && documentLimit > 0 ? Math.min(100, remaining / documentLimit * 100) : 0
  const amount = (value?: number) => value === undefined ? '—' : money(value)

  return <main className="jarvis-dashboard" aria-busy={loading}>
    <div className="jarvis-dashboard__top"><label className="jarvis-dashboard__month"><CalendarIcon /><input aria-label="Mes del tablero" type="month" value={month} onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value) }} /></label></div>
    <header className="jarvis-dashboard__welcome"><h1>¡Bienvenido a JARVIS! <span aria-hidden="true">👋</span></h1><h2>{user?.company?.name ?? 'Tu empresa'}</h2><p>Gestiona tus documentos electrónicos y automatiza tus procesos contables desde un solo lugar.</p></header>
    {error && <div className="jarvis-dashboard__error"><ErrorMessage message={error} /><button onClick={() => setAttempt(value => value + 1)}>Reintentar consulta</button></div>}
    {loading && <p role="status" className="jarvis-dashboard__loading">Cargando información del tablero…</p>}
    <div className="jarvis-dashboard__metrics">
      <article className="jarvis-dashboard__metric"><span className="jarvis-dashboard__metric-icon" aria-hidden="true">$</span><div><h3>Ventas del mes</h3><strong>{amount(data?.current.sales)}</strong><small>{data ? `${data.current.salesCount} facturas emitidas` : 'Historial de emisión'}</small></div><Link className="jarvis-dashboard__quick-action" to={isSalesInvoiceEnabled ? '/factura-venta/nueva' : setupPath}><InvoiceIcon />{isSalesInvoiceEnabled ? '+ Nueva factura' : 'Configurar factura de venta'}</Link></article>
      <article className="jarvis-dashboard__metric"><span className="jarvis-dashboard__metric-icon jarvis-dashboard__metric-icon--blue"><InvoiceIcon /></span><div><h3>Documentos soporte</h3><strong>{amount(data?.current.support)}</strong><small>{data ? `${data.current.supportCount} documentos emitidos` : 'Historial de emisión'}</small></div><Link className="jarvis-dashboard__quick-action jarvis-dashboard__quick-action--outline" to={isSupportDocumentEnabled ? '/documento-soporte/nuevo' : setupPath}><InvoiceIcon />{isSupportDocumentEnabled ? '+ Nuevo documento soporte' : 'Configurar documento soporte'}</Link></article>

      <article className="jarvis-dashboard__metric"><span className="jarvis-dashboard__metric-icon"><PackageIcon /></span><div><h3>Documentos disponibles</h3><strong>{!isSubscriptionActive ? 'Sin plan activo' : documentLimit === null ? 'Sin límite' : <>{remaining.toLocaleString('es-CO')} <span>de {documentLimit.toLocaleString('es-CO')}</span></>}</strong>{isSubscriptionActive && documentLimit !== null && <div className="jarvis-dashboard__quota" role="progressbar" aria-label="Documentos disponibles del plan" aria-valuemin={0} aria-valuemax={documentLimit} aria-valuenow={remaining}><span style={{ width: `${availableRatio}%` }} /></div>}<small>Cupo actual del plan</small></div><a className="jarvis-dashboard__quick-action jarvis-dashboard__quick-action--outline" href={WHATSAPP_DOCUMENTS_HREF} target="_blank" rel="noopener noreferrer"><PackageIcon />Comprar más documentos</a></article>
    </div>
    <div className="jarvis-dashboard__panels">
      <section className="jarvis-dashboard__card jarvis-dashboard__chart"><header><h2><span aria-hidden="true">▥</span> Ventas y documentos soporte</h2><span className="jarvis-dashboard__period">Últimos 6 meses</span></header>
        <div className="jarvis-dashboard__plot" role="img" aria-label={`Ventas y documentos soporte durante los seis meses hasta ${monthLabel(month)}`}>
          <div className="jarvis-dashboard__axis">{[1, .75, .5, .25, 0].map(part => <span key={part}>{money(ceiling * part)}</span>)}</div>
          <div className="jarvis-dashboard__bars"><div className="jarvis-dashboard__grid" aria-hidden="true">{[0, 1, 2, 3, 4].map(index => <i key={index} />)}</div>{data?.series.map(item => <div className="jarvis-dashboard__bar-month" key={item.month}><div className="jarvis-dashboard__bar-pair"><div className="jarvis-dashboard__bar jarvis-dashboard__bar--sales" style={{ height: `${item.sales / ceiling * 100}%` }} title={`${monthLabel(item.month)} · Ventas: ${money(item.sales)}`} /><div className="jarvis-dashboard__bar jarvis-dashboard__bar--support" style={{ height: `${item.support / ceiling * 100}%` }} title={`${monthLabel(item.month)} · Soporte: ${money(item.support)}`} /></div><span>{monthLabel(item.month)}</span></div>)}</div>
        </div>
        <div className="jarvis-dashboard__legend"><span><i />Ventas (facturas de venta)</span><span><i />Documentos soporte</span></div>
        {data && data.series.every(item => item.salesCount + item.supportCount === 0) && <p className="jarvis-dashboard__empty">Aún no hay emisiones registradas en este período.</p>}
        <details className="jarvis-dashboard__chart-detail"><summary>Ver valores del gráfico</summary>{data?.series.map(item => <p key={item.month}>{monthLabel(item.month)}: ventas {money(item.sales)} · soporte {money(item.support)}</p>)}</details>
      </section>
      <section className="jarvis-dashboard__card jarvis-dashboard__taxes"><header><h2><InvoiceIcon /> Resumen de impuestos del mes</h2></header><dl><div><dt>IVA generado en ventas</dt><dd>{amount(data?.taxes.iva)}</dd></div><div><dt>Retención en la fuente</dt><dd>{amount(data?.taxes.reteRenta)}</dd></div><div><dt>ReteICA</dt><dd>{amount(data?.taxes.reteIca)}</dd></div><div><dt>ReteIVA</dt><dd>{amount(data?.taxes.reteIva)}</dd></div><div><dt>Total retenciones</dt><dd>{data ? money(data.taxes.reteRenta + data.taxes.reteIca + data.taxes.reteIva) : '—'}</dd></div></dl><p>Resumen basado en el desglose conservado de los documentos emitidos.</p>{data && data.taxes.detailedDocuments < data.taxes.salesDocuments && <p>IVA calculado con {data.taxes.detailedDocuments} de {data.taxes.salesDocuments} facturas que conservan su desglose.</p>}<Link to="/impuestos-retenciones">Ver catálogo de impuestos <ChevronRightIcon /></Link></section>
    </div>
    <section className="jarvis-dashboard__card jarvis-dashboard__products">
      <header><h2><PackageIcon /> Productos más vendidos</h2><span className="jarvis-dashboard__period">{monthLabel(month)}</span></header>
      {data?.topProducts?.length ? <div className="jarvis-dashboard__products-scroll"><table><thead><tr><th>#</th><th>Producto</th><th>Cantidad vendida</th><th>Valor en ventas</th><th aria-label="Proporción de ventas" /></tr></thead><tbody>{data.topProducts.map((product, index) => <tr key={product.code || product.name}><td>{index + 1}</td><td>{product.name}</td><td>{product.quantity.toLocaleString('es-CO')}</td><td><strong>{money(product.sales)}</strong></td><td><div className="jarvis-dashboard__product-bar"><span style={{ width: `${data.topProducts[0].sales > 0 ? product.sales / data.topProducts[0].sales * 100 : 0}%` }} /></div></td></tr>)}</tbody></table></div> : <p className="jarvis-dashboard__empty">{loading ? 'Consultando productos...' : 'No hay productos vendidos con detalle registrado en este mes.'}</p>}
      <p className="jarvis-dashboard__products-note">Valores de las líneas de venta antes de impuestos y descuento general.</p>
    </section>
    <p className="jarvis-dashboard__source">Importes en COP del historial de emisión de Jarvis. No incluyen notas ni documentos de otras integraciones.</p>
  </main>
}
