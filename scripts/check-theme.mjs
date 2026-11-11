import { readFile, readdir } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import postcss from 'postcss'
import valueParser from 'postcss-value-parser'

const root = fileURLToPath(new URL('../', import.meta.url))
const themePath = 'src/styles/theme.css'
const colorFunctions = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)$/i
const rawColor = value => /^#[\da-f]{3,8}$/i.test(value) || /^(?:white|black|transparent)$/i.test(value)

export function inspectStyles(source, file, themeTokens = new Set()) {
  const issues = []
  const css = postcss.parse(source, { from: file })
  const report = (decl, message) => issues.push(`${file}:${decl.source.start.line} ${message}`)
  css.walkDecls(decl => {
    if (decl.prop.startsWith('--') && themeTokens.has(decl.prop)) report(decl, `El token ${decl.prop} solo se define en ${themePath}.`)
    const value = valueParser(decl.value)
    value.walk(node => {
      if (node.type === 'function' && node.value.toLowerCase() === 'url') return false
      if (node.type === 'word' && rawColor(node.value)) report(decl, `Color propio ${node.value}: usa un token del tema.`)
      if (node.type === 'function' && colorFunctions.test(node.value) && !valueParser.stringify(node).includes('var(')) report(decl, 'Color propio: usa la paleta del tema.')
      if (node.type === 'function' && node.value === 'var') {
        const name = node.nodes.find(child => child.type === 'word')?.value
        if (/^--(?:jarvis-|font-|text-|r-|shadow-|line-height-)/.test(name ?? '') && !themeTokens.has(name)) report(decl, `Token desconocido ${name}.`)
      }
    })
    const inherited = /^(?:inherit|initial|unset|revert|normal|none|0)$/.test(decl.value)
    if (['font-family', 'font-size', 'font-weight', 'line-height', 'box-shadow'].includes(decl.prop) && !inherited && !decl.value.startsWith('var(')) report(decl, `${decl.prop} debe usar una variable del tema.`)
    if (['font-family', 'font-size', 'font-weight', 'line-height', 'box-shadow'].includes(decl.prop) && decl.value.startsWith('var(')) {
      const name = decl.value.match(/^var\((--[\w-]+)/)?.[1]
      if (!themeTokens.has(name)) report(decl, `${decl.prop} debe reutilizar un token compartido, no una escala local.`)
    }
    if (/^border.*radius$/.test(decl.prop) && /\d(?:px|rem|%)/.test(decl.value)) report(decl, 'Los radios deben usar variables del tema.')
    if (decl.prop === 'font' && decl.value !== 'inherit') report(decl, 'Evita el shorthand font: utiliza la tipografía del tema.')
  })
  return issues
}

export function inspectComponent(source, file) {
  // PDF text is laid out by react-pdf, which does not support CSS custom properties.
  if (/^src\/components\/invoice\/(?:Purchase|Sales)InvoicePdfDocument\.tsx$/.test(file)) return []
  const issues = []
  const pattern = /\b(fill|stroke|color|background|backgroundColor|border|borderColor|boxShadow|fontFamily|fontSize|fontWeight|lineHeight)\s*(?:=\s*(["'])(.*?)\2|:\s*(["'])(.*?)\4)/g
  for (const match of source.matchAll(pattern)) {
    const value = match[3] ?? match[5]
    const typography = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight'].includes(match[1])
    if (rawColor(value) || /#[\da-f]{3,8}\b|(?:rgba?|hsla?)\([\d\s.,%/]+\)/i.test(value) || (typography && value !== 'inherit' && !value.startsWith('var('))) {
      const line = source.slice(0, match.index).split('\n').length
      issues.push(`${file}:${line} ${match[1]} debe usar un token de ${themePath}.`)
    }
  }
  for (const match of source.matchAll(/\b(fontSize|fontWeight|lineHeight)\s*:\s*(\d+(?:\.\d+)?)\b/g)) {
    const line = source.slice(0, match.index).split('\n').length
    issues.push(`${file}:${line} ${match[1]} debe usar la escala del tema.`)
  }
  return issues
}

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? filesIn(resolve(directory, entry.name)) : resolve(directory, entry.name)))).flat()
}

export async function checkTheme() {
  const theme = postcss.parse(await readFile(resolve(root, themePath), 'utf8'))
  const themeTokens = new Set()
  theme.walkDecls(decl => { if (decl.prop.startsWith('--')) themeTokens.add(decl.prop) })
  const issues = []
  const files = await filesIn(resolve(root, 'src'))
  for (const path of files) {
    const file = relative(root, path).replaceAll('\\', '/')
    if (file === themePath || /\.test\.tsx?$/.test(file)) continue
    if (file.endsWith('.css')) issues.push(...inspectStyles(await readFile(path, 'utf8'), file, themeTokens))
    if (file.endsWith('.tsx')) issues.push(...inspectComponent(await readFile(path, 'utf8'), file))
  }
  return issues
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const issues = await checkTheme()
  if (issues.length) {
    console.error(`Revisa ${themePath} antes de añadir estilos propios:\n${issues.join('\n')}`)
    process.exitCode = 1
  } else console.log('Tema Jarvis: colores, tipografía, radios y sombras centralizados.')
}
