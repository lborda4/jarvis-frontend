import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import PublicApp, { hasBrowserSession } from './marketing/PublicApp'
import { isPublicPath } from './marketing/catalog'

const root = document.getElementById('root')!
const app = (
  <StrictMode>
    <BrowserRouter>
      <PublicApp />
    </BrowserRouter>
  </StrictMode>
)

// The development template has a comment inside #root, but no prerendered elements to hydrate.
if (root.childElementCount > 0 && isPublicPath(window.location.pathname) && !hasBrowserSession()) {
  hydrateRoot(root, app)
} else {
  createRoot(root).render(app)
}
