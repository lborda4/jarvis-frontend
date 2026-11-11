import { Link } from 'react-router-dom'
import PrivacyPolicyLink from './PrivacyPolicyLink'
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
      <Link to="/" className="solution-brand" aria-label="JARVIS, inicio">
        <svg viewBox="0 0 900 215" role="img" aria-label="JARVIS. Automatiza. Conecta. Simplifica.">
          <svg width="205" height="205" viewBox="175 90 295 290"><image href="/logo.png" width="640" height="640" /></svg>
          <svg x="235" y="32" width="665" height="150" viewBox="40 395 560 115"><image href="/logo.png" width="640" height="640" /></svg>
        </svg>
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
    <p>© {new Date().getFullYear()} JARVIS. Automatiza. Conecta. Simplifica.</p>
    <div><a href="tel:+573195355387">319 535 5387</a><a href="mailto:jarviscol2025@gmail.com">Contacto</a><PrivacyPolicyLink mode="jarvis">Política de privacidad</PrivacyPolicyLink></div>
  </footer>
}
