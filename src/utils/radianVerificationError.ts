const messages: Record<string, string> = {
  RADIAN_AUTH: 'No se pudo consultar RADIAN. Un administrador debe revisar las credenciales de la integración.',
  RADIAN_TIMEOUT: 'La consulta RADIAN tardó demasiado. Intenta nuevamente en unos segundos.',
  RADIAN_RATE_LIMIT: 'La consulta RADIAN alcanzó su límite de solicitudes. Espera un momento e intenta nuevamente.',
  RADIAN_UNAVAILABLE: 'La consulta RADIAN no está disponible. Intenta nuevamente más tarde.',
  RADIAN_RESPONSE: 'No se pudo interpretar la respuesta RADIAN. Comunícate con soporte para revisar la consulta.',
}

/** Only display our known messages, never a raw gateway response. */
export function radianVerificationError(data: unknown): string | null {
  if (!data || typeof data !== 'object' || !('code' in data) || typeof data.code !== 'string') return null
  return Object.hasOwn(messages, data.code) ? messages[data.code] : null
}
