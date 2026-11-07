import { expect, it } from 'vitest'
import { addCopyEmail, parseCopyEmails } from './copyEmails'
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

it('agrega un correo a la vez y conserva los anteriores sin duplicados', () => {
  const saved = ['one@example.com']
  expect(addCopyEmail(saved, ' TWO@example.com ')).toEqual(['one@example.com', 'two@example.com'])
  expect(addCopyEmail(saved, ' ONE@example.com ')).toEqual(saved)
  expect(saved).toEqual(['one@example.com'])
})
it('rechaza listas, direcciones inválidas y el correo principal al agregar', () => {
  for (const draft of ['one@example.com, two@example.com', 'one@example.com;two@example.com', 'one@example.com\ntwo@example.com', 'incorrecto']) {
    expect(() => addCopyEmail([], draft)).toThrow('un solo correo válido')
  }
  expect(() => addCopyEmail([], 'OWNER@example.com', 'owner@example.com')).toThrow('correo principal')
})
it('incluye el correo pendiente al guardar el tercero y respeta el límite de diez', () => {
  const saved = Array.from({ length: 9 }, (_, index) => `copy${index}@example.com`)
  const complete = addCopyEmail(saved, 'pending@example.com')
  expect(complete).toHaveLength(10)
  expect(complete).toContain('pending@example.com')
  expect(() => addCopyEmail(complete, 'extra@example.com')).toThrow('hasta 10')
  expect(addCopyEmail(complete, 'pending@example.com')).toEqual(complete)
  expect(addCopyEmail(saved, '')).toEqual(saved)
  expect(addCopyEmail([], '')).toEqual([])
})
