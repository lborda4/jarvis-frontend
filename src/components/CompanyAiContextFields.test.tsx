import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CompanyAiContextFields from './CompanyAiContextFields'

function renderRules(count: number) {
  return renderToStaticMarkup(
    <CompanyAiContextFields
      value={{ description: 'Jardín infantil', rules: Array.from({ length: count }, (_, i) => `Regla de compra ${i + 1}`) }}
      onChange={() => undefined}
    />,
  )
}

describe('editor de descripción y reglas de IA', () => {
  it('muestra la descripción compartida y permite agregar antes del límite', () => {
    const html = renderRules(9)
    expect(html).toContain('Jardín infantil')
    expect(html).toContain('Regla de compra 9')
    expect(html).toMatch(/<button[^>]*>\+ Agregar regla<\/button>/)
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>\+ Agregar regla<\/button>/)
  })
  it('deshabilita agregar al llegar a diez y conserva la opción de eliminar', () => {
    const html = renderRules(10)
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\+ Agregar regla<\/button>/)
    expect(html).toContain('Eliminar regla 10')
    expect(html.match(/<textarea/g)).toHaveLength(11)
  })
})
