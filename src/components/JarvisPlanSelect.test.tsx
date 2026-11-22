import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import JarvisPlanSelect from './JarvisPlanSelect'
import { portfolioPlans } from '../testFixtures/adminPortfolio'

it('ofrece los cinco planes del servidor con sus precios y conserva el ID seleccionado', () => {
  const html = renderToStaticMarkup(<JarvisPlanSelect plans={portfolioPlans} value="server-combo" onChange={() => {}} />)
  expect(html.match(/<option /g)).toHaveLength(6)
  for (const plan of portfolioPlans) expect(html).toContain(plan.name)
  expect(html).toContain('value="server-combo" selected=""')
  for (const amount of ['139.900', '129.900', '230.000', '720.000']) expect(html).toContain(`$${amount} COP / año`)
  expect(html).not.toContain('Recarga')
})

it('excluye planes ajenos y antiguos sin inventar IDs si falta la migración', () => {
  const html = renderToStaticMarkup(<JarvisPlanSelect plans={[
    { ...portfolioPlans[0], provider: 'SIIGO' }, { ...portfolioPlans[1], commercialTerms: null },
  ]} value="" onChange={() => {}} />)
  expect(html).toContain('disabled=""')
  expect(html).toContain('Sin planes del portafolio disponibles')
  expect(html).not.toContain('server-initial')
  expect(html).not.toContain('server-regular')
})
