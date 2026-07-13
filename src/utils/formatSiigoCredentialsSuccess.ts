import type { SaveSiigoCredentialsResponse } from '../types/siigo'

export function formatSiigoCredentialsSuccessMessage(
  response: SaveSiigoCredentialsResponse,
): string {

  return [
    'Credenciales de SIIGO guardadas correctamente.',
    `Usuario: ${response.username}.`,
    `Partner ID: ${response.partner_id}.`
  ].join(' ')
}
