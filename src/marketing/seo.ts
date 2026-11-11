import { SIIGO_PLANS, type MarketingProduct } from './catalog'
import { BILLING_SOLUTIONS } from './content'

export const SITE_URL = 'https://www.jarviscol.com'

const PAGES = {
  payroll: {
    path: '/nomina-electronica',
    title: 'Nómina electrónica para tu equipo | JARVIS',
    description: 'Envía tu nómina electrónica con Jarvis por $12.900 COP al mes para hasta 2 empleados. Incluye certificado digital, reportes y acompañamiento personalizado.',
    name: 'Nómina electrónica JARVIS',
  },
  home: {
    path: '/',
    title: 'JARVIS | Facturación, nómina electrónica y automatización contable',
    description: 'Elige tu solución JARVIS: facturación electrónica, nómina y causación automática con acompañamiento personalizado. Conoce nuestros planes en Colombia.',
    name: 'Soluciones JARVIS: facturación, nómina y automatización contable',
  },
  siigo: {
    path: '/siigo',
    title: 'Automatización contable con Siigo e IA | JARVIS',
    description: 'Automatiza documentos soporte y facturas de compra en Siigo con JARVIS e IA. Planes de cargue masivo de documentos soporte desde $35.000 COP/mes.',
    name: 'JARVIS para Siigo',
  },
  billing: {
    path: '/facturacion-electronica',
    title: 'Facturación electrónica en Colombia, directa DIAN | JARVIS',
    description: 'Factura de venta, documento soporte, notas débito, notas crédito y RADIAN con JARVIS, directo con la DIAN y sin Siigo. Conoce los planes de facturación.',
    name: 'Facturación JARVIS',
  },
}

export function getMarketingSeo(product?: MarketingProduct) {
  const page = PAGES[product ?? 'home']
  return { ...page, url: `${SITE_URL}${page.path}` }
}

export function getStructuredData(product?: MarketingProduct) {
  const page = getMarketingSeo(product)
  const organizationId = `${SITE_URL}/#organization`
  const websiteId = `${SITE_URL}/#website`
  const applicationId = `${page.url}#software`
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization', '@id': organizationId, name: 'JARVIS',
      url: `${SITE_URL}/`, logo: `${SITE_URL}/logo5.png`,
      email: 'jarviscol2025@gmail.com', telephone: '+57-319-535-5387',
    },
    {
      '@type': 'WebSite', '@id': websiteId, name: 'JARVIS', url: `${SITE_URL}/`,
      inLanguage: 'es-CO', publisher: { '@id': organizationId },
    },
    {
      '@type': 'WebPage', '@id': `${page.url}#webpage`, name: page.name,
      url: page.url, description: page.description, inLanguage: 'es-CO',
      isPartOf: { '@id': websiteId }, about: { '@id': product ? applicationId : organizationId },
      ...(product ? { breadcrumb: { '@id': `${page.url}#breadcrumb` } } : {}),
    },
  ]
  if (product) {
    const offers = product === 'payroll' ? [{ '@type': 'Offer', name: 'Nómina electrónica mensual para hasta 2 empleados', price: 12900, priceCurrency: 'COP', url: `${page.url}#precios` }] : product === 'billing' ? [
      { '@type': 'Offer', name: 'Plan anual: 50 documentos electrónicos', price: 130000, priceCurrency: 'COP', url: `${page.url}#precios` },
      { '@type': 'Offer', name: 'Facturación electrónica ilimitada mensual', price: 60000, priceCurrency: 'COP', url: `${page.url}#precios` },
    ] : SIIGO_PLANS.filter(plan => plan.period).map(plan => ({
      '@type': 'Offer', name: `Cargue masivo a Siigo: plan ${plan.name} mensual`,
      description: `${plan.limit}. Pago mensual en COP.`,
      price: Number(plan.price.replace(/\D/g, '')), priceCurrency: 'COP', url: `${page.url}#precios`,
    }))
    graph.push({
      '@type': 'SoftwareApplication', '@id': applicationId, name: page.name,
      url: page.url, description: page.description, applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web', inLanguage: 'es-CO', offers, provider: { '@id': organizationId },
      ...(product === 'billing' ? { featureList: BILLING_SOLUTIONS.map(solution => solution.title) } : {}),
    }, {
      '@type': 'BreadcrumbList', '@id': `${page.url}#breadcrumb`, itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: page.name, item: page.url },
      ],
    })
  }
  return { '@context': 'https://schema.org', '@graph': graph }
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function renderMarketingHead(product?: MarketingProduct) {
  const page = getMarketingSeo(product)
  const title = escapeHtml(page.title)
  const description = escapeHtml(page.description)
  const url = escapeHtml(page.url)
  return `<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<link rel="canonical" href="${url}" />
<link rel="alternate" hreflang="es-CO" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="es_CO" />
<meta property="og:site_name" content="JARVIS" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${SITE_URL}/jarvis-login-brand.png" />
<meta property="og:image:alt" content="JARVIS: automatiza, conecta y simplifica" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${SITE_URL}/jarvis-login-brand.png" />
<script id="jarvis-structured-data" type="application/ld+json">${JSON.stringify(getStructuredData(product)).replaceAll('<', '\\u003c')}</script>`
}

export function renderApplicationHead() {
  return '<title>Acceso a JARVIS</title><meta name="robots" content="noindex, follow" />'
}

function applyHead(html: string) {
  const managedSelector = 'title, meta[name="description"], meta[name="robots"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], link[rel="alternate"][hreflang], script#jarvis-structured-data'
  const previous = [...document.head.querySelectorAll(managedSelector)]
  previous.forEach(node => node.remove())
  const template = document.createElement('template')
  template.innerHTML = html
  const added = [...template.content.childNodes]
  document.head.append(...added)
  return () => {
    added.forEach(node => node.parentNode?.removeChild(node))
    document.head.append(...previous)
  }
}

export function applyMarketingSeo(product?: MarketingProduct) {
  return applyHead(renderMarketingHead(product))
}

export function applyApplicationSeo() {
  return applyHead(renderApplicationHead())
}
