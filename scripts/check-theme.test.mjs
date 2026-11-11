import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inspectStyles, inspectComponent, checkTheme } from './check-theme.mjs'

const tokens = new Set(['--jarvis-primary', '--jarvis-primary-rgb', '--text-md', '--font-family-base', '--font-weight-normal', '--r-md', '--shadow-sm'])
test('acepta componentes que reutilizan el tema y disposición responsive', () => {
  assert.deepEqual(inspectStyles('.card { color: var(--jarvis-primary); background: rgba(var(--jarvis-primary-rgb), .1); font-family: var(--font-family-base); font-size: var(--text-md); border-radius: var(--r-md); box-shadow: var(--shadow-sm); padding: 1rem; }', 'card.css', tokens), [])
})
for (const value of ['#0d9488', 'rgb(13 148 136)', 'hsl(175 80% 40%)', 'white', 'linear-gradient(#fff, #000)']) {
  test(`rechaza una paleta local: ${value}`, () => assert.ok(inspectStyles(`.card { background: ${value}; }`, 'card.css', tokens).length))
}
test('detecta tipografías, tamaños, pesos, radios y sombras nuevos', () => {
  assert.ok(inspectStyles('.card { font-family: Arial; font-size: 17px; font-weight: 800; border-radius: 13px; box-shadow: 0 2px 8px currentColor; }', 'card.css', tokens).length >= 5)
})
test('detecta tokens inexistentes y redefiniciones fuera del tema', () => {
  assert.ok(inspectStyles('.card { color: var(--jarvis-unknown); --text-md: 17px; }', 'card.css', tokens).length >= 2)
})
test('no confunde colores dentro de imágenes o selectores con estilos nuevos', () => {
  assert.deepEqual(inspectStyles('#fff { background-image: url("data:image/svg+xml,<svg fill=\'#fff\'/>"); }', 'card.css', tokens), [])
})
test('comprueba colores y fuentes inline de componentes', () => {
  assert.equal(inspectComponent('<path fill="#fff" />', 'src/components/Icon.tsx').length, 1)
  assert.deepEqual(inspectComponent('<path fill="var(--jarvis-primary)" />', 'src/components/Icon.tsx'), [])
  assert.deepEqual(inspectComponent("const style = { fontFamily: 'Helvetica', color: '#000' }", 'src/components/invoice/SalesInvoicePdfDocument.tsx'), [])
  assert.ok(inspectComponent("<div style={{ background: 'linear-gradient(#fff, #000)', fontSize: 18, fontWeight: 800 }} />", 'src/components/Card.tsx').length >= 3)
})
test('todos los estilos de la interfaz cumplen el tema', async () => assert.deepEqual(await checkTheme(), []))
