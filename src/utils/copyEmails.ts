export function parseCopyEmails(value: string, primaryEmail?: string): string[] {
  const emails = [...new Set(value.split(/[,;\n]/).map(email => email.trim().toLowerCase()).filter(Boolean))]
  if (emails.length > 10) throw new Error('Puedes guardar hasta 10 correos para copia.')
  if (emails.some(email => email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    throw new Error('Revisa los correos para copia y sepáralos con coma.')
  return emails.filter(email => email !== primaryEmail?.trim().toLowerCase())
}
