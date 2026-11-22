import { expect, it } from 'vitest'
import { PUBLIC_PATHS, renderPage } from '../entry-prerender'
import { renderApplicationHead } from './seo'

it('renderiza las páginas públicas sin una sesión ni APIs del navegador', () => {
  const rendered = PUBLIC_PATHS.map(path => renderPage(path))
  expect(new Set(rendered.map(page => page.head.match(/<title>(.*?)<\/title>/)?.[1])).size).toBe(PUBLIC_PATHS.length)
  for (const page of rendered) {
    expect(page.html).toContain('<h1')
    expect(page.html).toContain('<details>')
    expect(page.html).not.toContain('Cargando...')
    expect(page.head).toContain('rel="canonical"')
    expect(page.head).not.toContain('noindex')
    expect(page.head).toContain('Jarvis')
    expect(page.head).not.toMatch(/jenius/i)
    expect(page.html).not.toMatch(/jenius/i)
    expect(page.head).toContain('https://www.jarviscol.com')
    expect(page.head).toContain('/jarvis-social.png')
  }
})

it('identifica la nueva marca con el dominio existente y los contactos reales', () => {
  const page = renderPage('/')
  const graph = JSON.parse(page.head.match(/<script[^>]+type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])['@graph']
  expect(graph.find((item: { '@type': string }) => item['@type'] === 'WebSite')).toMatchObject({ name: 'Jarvis', url: 'https://www.jarviscol.com/' })
  expect(graph.find((item: { '@type': string }) => item['@type'] === 'Organization')).toMatchObject({ name: 'Jarvis', email: 'ventas@jarviscol.com' })
  expect(page.html).toContain('/jarvis-logo.png')
  expect(page.html).toContain('mailto:ventas@jarviscol.com')
})

it('no presenta metadatos de producto ni canonical de la landing en la aplicación privada', () => {
  const head = renderApplicationHead()
  expect(head).toContain('noindex, follow')
  expect(head).not.toContain('canonical')
  expect(head).not.toContain('application/ld+json')
})
