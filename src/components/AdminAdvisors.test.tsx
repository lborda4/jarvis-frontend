import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AdvisorsTable } from './AdminAdvisors'
import { advisorCommissionLabel } from '../utils/advisorCommission'
import type { AdminAdvisor } from '../types/admin'

const advisor: AdminAdvisor = { id: 'a', name: 'Laura', email: 'laura@example.com', commissionType: 'PERCENT', commissionValue: 12.5, registered: false, active: false, lastDeliveryStatus: 'FAILED', lastInvitedAt: null, clients: [{ id: 'c', name: 'Empresa', nit: '900' }] }
const render = (items: AdminAdvisor[]) => renderToStaticMarkup(<AdvisorsTable items={items} busy={false} onEdit={() => {}} onClients={() => {}} onSend={() => {}} />)
describe('asesores del administrador', () => {
  it('muestra clientes, comisión y registro pendiente con reenvío disponible', () => {
    const html = render([advisor])
    for (const text of ['Laura', 'laura@example.com', '1 cliente', 'Según producto', 'Pendiente', 'Correo pendiente', 'Reenviar correo']) expect(html).toContain(text)
    expect(html).not.toContain('Anterior')
    expect(html).not.toContain('role="dialog"')
  })
  it('solo pagina cuando el resultado completo supera una página', () => {
    expect(render([])).not.toContain('Siguiente')
    expect(render(Array.from({ length: 10 }, (_, i) => ({ ...advisor, id: String(i) })))).not.toContain('Siguiente')
    const html = render(Array.from({ length: 11 }, (_, i) => ({ ...advisor, id: String(i) })))
    expect(html).toContain('Siguiente'); expect(html).toContain('1 / 2')
    expect((html.match(/laura@example.com/g) ?? []).length).toBe(10)
  })
  it('diferencia porcentajes y valores fijos, admite cero y comisión sin definir', () => {
    expect(advisorCommissionLabel({ commissionType: 'FIXED', commissionValue: 40000 })).toContain('40.000')
    expect(advisorCommissionLabel({ commissionType: 'PERCENT', commissionValue: 0 })).toBe('0 %')
    expect(advisorCommissionLabel({ commissionType: 'FIXED', commissionValue: null })).toBe('Sin definir')
    expect(render([{ ...advisor, registered: true, lastDeliveryStatus: 'SENT' }])).toContain('Enviar acceso')
  })
})
