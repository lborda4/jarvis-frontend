const internalSource = /next[\s_-]*pyme|proveedor\s+(?:externo|tecnol[oó]gico)|(?:error|fall[oó])\s+(?:del|en el)\s+proveedor/i

export function clientFacingError(message: string, fallback = 'Ha ocurrido un error. Inténtalo más tarde o comunícate con soporte.'): string {
  if (!internalSource.test(message)) return message
  return internalSource.test(fallback)
    ? 'Ha ocurrido un error. Inténtalo más tarde o comunícate con soporte.'
    : fallback
}
