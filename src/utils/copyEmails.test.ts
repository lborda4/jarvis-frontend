import { expect, it } from 'vitest'
import { parseCopyEmails } from './copyEmails'
import { terceroToForm } from './jarvisTerceroForm'
import type { JarvisTercero } from '../types/jarvis'

it('normaliza las copias y elimina duplicados y el correo principal', () => {
  expect(parseCopyEmails(' Cliente@example.com; CC@example.com,cc@example.com\n otra@example.com ', 'cliente@example.com')).toEqual(['cc@example.com', 'otra@example.com'])
  expect(parseCopyEmails('')).toEqual([])
})
it('rechaza direcciones inválidas y más de diez copias', () => {
  expect(() => parseCopyEmails('no-es-correo')).toThrow('Revisa los correos')
  expect(() => parseCopyEmails(Array.from({ length: 11 }, (_, index) => `copy${index}@example.com`).join(','))).toThrow('hasta 10')
})
it('precarga y permite quitar los correos al editar sin modificar el tercero original', () => {
  const tercero = { document_type: 'NIT', document_number: '123', name: 'Cliente', tax_responsibility: 'R-99-PN', copy_emails: ['copy@example.com'] } as JarvisTercero
  const form = terceroToForm(tercero)
  expect(form.copy_emails).toEqual(['copy@example.com'])
  form.copy_emails!.splice(0)
  expect(tercero.copy_emails).toEqual(['copy@example.com'])
})
