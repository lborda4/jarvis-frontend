import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { hasStoredSession } from '../services/authStorage'
import LandingContent from '../pages/LandingContent'
import { isPublicPath, productForPath } from './catalog'
import { applyApplicationSeo } from './seo'

const Application = lazy(() => import('../App'))

export function hasBrowserSession() {
  try { return hasStoredSession() } catch { return false }
}

function ApplicationMetadata() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (!isPublicPath(pathname)) return applyApplicationSeo()
  }, [pathname])
  return null
}

export default function PublicApp() {
  const { pathname } = useLocation()
  // Once the application opens, keep its providers mounted across navigation.
  const [openedApplication, setOpenedApplication] = useState(hasBrowserSession)
  const needsApplication = openedApplication || !isPublicPath(pathname)
  useEffect(() => {
    if (needsApplication && !openedApplication) setOpenedApplication(true)
  }, [needsApplication, openedApplication])
  if (needsApplication || !isPublicPath(pathname)) return <>
    <ApplicationMetadata />
    <Suspense fallback={<div className="landing-loading" role="status">Cargando JARVIS...</div>}><Application /></Suspense>
  </>
  return <LandingContent product={productForPath(pathname)} />
}
