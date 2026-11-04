import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import LandingContent from './pages/LandingContent'
import { PUBLIC_PATHS, productForPath, type PublicPath } from './marketing/catalog'
import { renderApplicationHead, renderMarketingHead } from './marketing/seo'

export { PUBLIC_PATHS, renderApplicationHead }

export function renderPage(path: PublicPath) {
  const product = productForPath(path)
  return {
    head: renderMarketingHead(product),
    html: renderToString(<StaticRouter location={path}><LandingContent product={product} /></StaticRouter>),
  }
}
