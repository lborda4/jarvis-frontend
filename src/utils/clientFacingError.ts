const internalSource = /next[\s_-]*pyme|proveedor\s+(?:externo|tecnol[oó]gico)|(?:error|fall[oó])\s+(?:del|en el)\s+proveedor/i
const technicalError = /internal\s+(?:server\s+)?error|error\s+interno(?:\s+del\s+servidor)?|request failed with status code|error del servidor\s*\(\d{3}\)|SQLSTATE|ECONNREFUSED|ETIMEDOUT|Cannot (?:GET|POST|PUT|DELETE)\s+\/|(?:TypeError|ReferenceError|SyntaxError):/i
export const CLIENT_ERROR_FALLBACK = 'Ha ocurrido un error. Inténtalo más tarde o comunícate con soporte.'

export function clientFacingError(message: string, fallback = CLIENT_ERROR_FALLBACK): string {
  if (!internalSource.test(message) && !technicalError.test(message)) return message
  return internalSource.test(fallback) || technicalError.test(fallback)
    ? CLIENT_ERROR_FALLBACK
    : fallback
}
