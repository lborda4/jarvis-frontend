import { Link } from 'react-router-dom'
import PrivacyPolicyLink from './PrivacyPolicyLink'
import { CONTACT_PHONE, CONTACT_PHONE_LABEL, SALES_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_HREF } from '../constants/contact'
import '../pages/SolutionLanding.css'

type MarketingNavLink = { href: string; label: string }

export function MarketingHeader({ home = false, links, planHref }: {
  home?: boolean
  links?: readonly MarketingNavLink[]
  planHref?: string
}) {
  const section = (id: string) => `${home ? '' : '/'}#${id}`
  const navigation = links ?? [
    { href: section('precios'), label: 'Planes' },
    { href: section('integraciones'), label: 'Integraciones' },
    { href: section('acompanamiento'), label: 'Acompañamiento' },
  ]
  return <>
    <a className="solution-skip" href="#contenido">Saltar al contenido</a>
    <div className="solution-announcement">Software colombiano. Acompañamiento de principio a fin.</div>
    <header className="solution-header">
      <Link to="/" className="solution-brand" aria-label="Jarvis, inicio">
        <img src="/jarvis-logo.png" width="872" height="654" alt="Jarvis" />
      </Link>
      <nav className="solution-nav" aria-label="Navegación principal">
        <details className="solution-nav__dropdown"><summary>Soluciones <span aria-hidden="true">⌄</span></summary><div>
          <Link to="/facturacion-electronica">Facturación electrónica</Link>
          <Link to="/nomina-electronica">Nómina electrónica</Link>
          <Link to="/siigo">Causación automática</Link>
        </div></details>
        {navigation.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
      </nav>
      <div className="solution-header__actions">
        <Link className="solution-button solution-button--outline" to="/login">Iniciar sesión</Link>
        <a className="solution-button" href={planHref ?? section('precios')}>Conocer más</a>
      </div>
    </header>
  </>
}

export function MarketingFooter() {
  return <footer className="solution-footer">
    <p>© {new Date().getFullYear()} Jarvis. Automatiza. Conecta. Simplifica.</p>
    <div><a href={`tel:${CONTACT_PHONE}`}>{CONTACT_PHONE_LABEL}</a><a href={`mailto:${SALES_EMAIL}`}>{SALES_EMAIL}</a><a href={INSTAGRAM_HREF} target="_blank" rel="noopener noreferrer">@{INSTAGRAM_HANDLE}</a><PrivacyPolicyLink mode="jarvis">Política de privacidad</PrivacyPolicyLink></div>
  </footer>
}
