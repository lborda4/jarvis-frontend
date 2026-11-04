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

if (root.hasChildNodes() && isPublicPath(window.location.pathname) && !hasBrowserSession()) {
  hydrateRoot(root, app)
} else {
  createRoot(root).render(app)
}
