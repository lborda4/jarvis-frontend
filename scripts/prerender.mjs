import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = resolve(root, 'dist')
const template = await readFile(resolve(output, 'index.html'), 'utf8')
if (!template.includes('<!--seo-head-->') || !template.includes('<!--app-html-->')) {
  throw new Error('The HTML template must contain the SEO and application placeholders.')
}

await build({
  root, configFile: false, plugins: [react()], logLevel: 'warn',
  build: {
    ssr: resolve(root, 'src/entry-prerender.tsx'),
    outDir: resolve(root, 'dist-ssr'),
    rollupOptions: { output: { entryFileNames: 'prerender.js' } },
  },
})

const { PUBLIC_PATHS, renderPage, renderApplicationHead } = await import(pathToFileURL(resolve(root, 'dist-ssr/prerender.js')).href)
// The SPA fallback must never advertise a public product or an indexable URL.
await writeFile(resolve(output, 'app.html'), template
  .replace('<!--seo-head-->', () => renderApplicationHead())
  .replace('<!--app-html-->', ''))

for (const path of PUBLIC_PATHS) {
  const page = renderPage(path)
  const target = resolve(output, path === '/' ? 'index.html' : `${path.slice(1)}/index.html`)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, template.replace('<!--seo-head-->', () => page.head).replace('<!--app-html-->', () => page.html))
  console.log(`Pre-rendered ${path}`)
}

const urls = PUBLIC_PATHS.map(path => `  <url><loc>https://www.jarviscol.com${path}</loc></url>`).join('\n')
await writeFile(resolve(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
