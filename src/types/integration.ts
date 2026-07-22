export const INTEGRATION_PROVIDER = {
  SIIGO: 'SIIGO',
  JARVIS: 'JARVIS',
} as const

export type IntegrationProvider =
  (typeof INTEGRATION_PROVIDER)[keyof typeof INTEGRATION_PROVIDER]

export type IntegrationMode = 'siigo' | 'jarvis' | 'unknown'

export function resolveIntegrationMode(
  providers: IntegrationProvider[],
): IntegrationMode {
  if (providers.includes(INTEGRATION_PROVIDER.SIIGO)) {
    return 'siigo'
  }

  if (providers.includes(INTEGRATION_PROVIDER.JARVIS)) {
    return 'jarvis'
  }

  return 'unknown'
}
