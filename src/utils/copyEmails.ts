export function parseCopyEmails(value: string, primaryEmail?: string): string[] {
  const emails = [...new Set(value.split(/[,;\n]/).map(email => email.trim().toLowerCase()).filter(Boolean))]
  if (emails.length > 10) throw new Error('Puedes guardar hasta 10 correos para copia.')
  if (emails.some(email => email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    throw new Error('Revisa los correos adicionales: hay una dirección inválida.')
  return emails.filter(email => email !== primaryEmail?.trim().toLowerCase())
}

export function addCopyEmail(emails: string[], draft: string, primaryEmail?: string): string[] {
  const email = draft.trim().toLowerCase()
  if (!email) return parseCopyEmails(emails.join('\n'), primaryEmail)
  if (email.length > 254 || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email))
    throw new Error('Ingresa un solo correo válido y presiona Guardar o Enter.')
  if (email === primaryEmail?.trim().toLowerCase())
    throw new Error('Este correo ya está registrado como correo principal.')
  return parseCopyEmails([...emails, email].join('\n'), primaryEmail)
}
