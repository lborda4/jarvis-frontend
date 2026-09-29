import { expect, it } from 'vitest'
import type { JarvisTercero } from '../types/jarvis'
import { terceroToForm } from './jarvisTerceroForm'

const tercero: JarvisTercero = {
  id: 'third-1', document_type: 'CC', document_number: '1016100663', name: 'Cliente',
  check_digit: null, entity_type: 'natural_person', tax_regime: 'common',
  tax_responsibility: 'O-13', municipality_id: 500, type_regime_id: 1,
  email: 'cliente@example.com', phone: '3001234567', address: 'Calle 1',
  created_at: '', updated_at: '',
}

it('precarga los datos fiscales y de contacto sin reemplazarlos por valores predeterminados', () => {
  expect(terceroToForm(tercero)).toMatchObject({
    document_type: 'CC', document_number: '1016100663', name: 'Cliente',
    entity_type: 'natural_person', tax_regime: 'common', tax_responsibility: 'O-13',
    municipality_id: 500, type_regime_id: 1, email: 'cliente@example.com',
    phone: '3001234567', address: 'Calle 1',
  })
})

it('permite editar campos vacíos sin enviar metadatos del registro', () => {
  const form = terceroToForm({ ...tercero, email: null, phone: null, address: null, entity_type: null })
  expect(form).toMatchObject({ email: '', phone: '', address: '', check_digit: '' })
  expect(form.entity_type).toBeUndefined()
  expect(form).not.toHaveProperty('id')
  expect(form).not.toHaveProperty('created_at')
})
