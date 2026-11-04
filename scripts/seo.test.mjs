import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const pages = [
  { path: '/', file: 'index.html', heading: 'Automatización contable y', product: null },
  { path: '/siigo', file: 'siigo/index.html', heading: 'Automatización contable con Siigo', product: 'JARVIS para Siigo' },
  { path: '/facturacion-electronica', file: 'facturacion-electronica/index.html', heading: 'Facturación electrónica en Colombia', product: 'Facturación JARVIS' },
]

for (const page of pages) {
  test(`${page.path} delivers complete, indexable HTML without executing JavaScript`, async () => {
    const html = await read(`dist/${page.file}`)
    const url = `https://www.jarviscol.com${page.path}`
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1)
    assert.ok(html.includes(page.heading))
    assert.ok(html.includes('<details>'), 'FAQ answers must exist in the initial HTML')
    assert.ok(/<a\b[^>]*href="\/siigo"/.test(html))
    assert.ok(/<a\b[^>]*href="\/facturacion-electronica"/.test(html))
    assert.equal([...html.matchAll(/<title>/g)].length, 1)
    assert.equal([...html.matchAll(/rel="canonical"/g)].length, 1)
    assert.ok(html.includes(`<link rel="canonical" href="${url}"`))
    assert.ok(html.includes(`<meta property="og:url" content="${url}"`))
    assert.ok(html.includes('content="index, follow, max-image-preview:large"'))
    assert.ok(!html.includes('noindex'))
    assert.ok(!html.includes('<!--seo-head-->') && !html.includes('<!--app-html-->'))

    const match = html.match(/<script id="jarvis-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/)
    assert.ok(match, 'Structured data must be delivered by the server')
    const graph = JSON.parse(match[1])['@graph']
    assert.equal(graph.find(item => item['@type'] === 'WebPage').url, url)
    const applications = graph.filter(item => item['@type'] === 'SoftwareApplication')
    assert.equal(applications.length, page.product ? 1 : 0)
    if (page.product) {
      assert.equal(applications[0].name, page.product)
      assert.equal(applications[0].url, url)
      assert.ok(graph.some(item => item['@type'] === 'BreadcrumbList'))
      const prices = applications[0].offers.map(offer => offer.price)
      assert.deepEqual(prices, page.path === '/siigo' ? [35000, 75000, 120000, 250000] : [130000, 60000])
    }
    assert.ok(!/<link[^>]+href="[^"]*\/App-[^"]+\.js"/.test(html), 'Private application modules must not be preloaded')
  })
}

test('private application fallback is excluded from indexing and contains no product metadata', async () => {
  const html = await read('dist/app.html')
  assert.ok(html.includes('content="noindex, follow"'))
  assert.ok(!html.includes('rel="canonical"'))
  assert.ok(!html.includes('application/ld+json'))
  assert.ok(!html.includes('landing-hero'))
})

test('sitemap includes only the three canonical public pages, with matching rewrites', async () => {
  const sitemap = await read('dist/sitemap.xml')
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, url]) => url)
  assert.deepEqual(urls, pages.map(page => `https://www.jarviscol.com${page.path}`))
  const config = JSON.parse(await read('vercel.json'))
  for (const page of pages) {
    assert.equal(config.rewrites.find(rule => rule.source === page.path)?.destination, `/${page.file}`)
  }
  assert.equal(config.rewrites.at(-1).destination, '/app.html')
  const robots = await read('dist/robots.txt')
  assert.ok(robots.includes('Sitemap: https://www.jarviscol.com/sitemap.xml'))
  assert.ok(!robots.includes('Disallow: /'), 'Crawlers must be able to read public pages, assets and noindex instructions')
})
