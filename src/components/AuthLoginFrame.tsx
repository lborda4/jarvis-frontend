import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PRIVACY_POLICY_URL } from '../constants/privacyPolicy'

function AuthLoginFrame({
  titleId,
  title,
  description,
  children,
  footer,
}: {
  titleId: string
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="auth-page auth-page--login">
      <div className="auth-login-backdrop" aria-hidden="true">
        <span className="auth-login-backdrop__vignette" />
        <span className="auth-login-backdrop__grid" />
        <span className="auth-login-backdrop__scanlines" />
        <span className="auth-login-backdrop__ring auth-login-backdrop__ring--outer" />
        <span className="auth-login-backdrop__ring auth-login-backdrop__ring--inner" />
        <span className="auth-login-backdrop__triangle" />
        <span className="auth-login-backdrop__orb auth-login-backdrop__orb--one" />
        <span className="auth-login-backdrop__orb auth-login-backdrop__orb--two" />
        <span className="auth-login-backdrop__corner auth-login-backdrop__corner--tl" />
        <span className="auth-login-backdrop__corner auth-login-backdrop__corner--tr" />
        <span className="auth-login-backdrop__corner auth-login-backdrop__corner--bl" />
        <span className="auth-login-backdrop__corner auth-login-backdrop__corner--br" />
      </div>

      <div className="auth-login-shell">
        <header className="auth-login-top">
          <Link to="/" className="auth-login-top__logo-link" aria-label="Ir al inicio">
            <img
              src="/jarvis-login-brand.png?v=2"
              alt="Jarvis — Automatiza. Conecta. Simplifica."
              className="auth-login-top__logo"
            />
          </Link>
        </header>

        <section className="auth-login-card" aria-labelledby={titleId}>
          <div className="auth-login-card__intro">
            <h1 id={titleId}>{title}</h1>
            <p>{description}</p>
          </div>
          {children}
        </section>

        {footer}
        <p className="auth-login-shell__legal">
          <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">
            Política de tratamiento de datos
          </a>
        </p>
      </div>
    </main>
  )
}

export default AuthLoginFrame
