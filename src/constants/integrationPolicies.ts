import jarvisText from '../content/jarvisPrivacyPolicy.txt?raw'
import siigoText from '../content/siigoPrivacyPolicy.txt?raw'
import type { IntegrationMode } from '../types/integration'

export interface IntegrationPolicy {
  id: string
  title: string
  version: string
  integrationLabel: string
  text: string
}

const policies: Partial<Record<IntegrationMode, IntegrationPolicy>> = {
  jarvis: {
    id: 'jarvis-terms-2026-10-08-v1',
    title: 'Términos y condiciones de uso y prestación del servicio de documentos electrónicos',
    version: '1.0',
    integrationLabel: 'Jarvis',
    text: jarvisText,
  },
  siigo: {
    id: 'siigo-terms-2026-10-12-v1.1',
    title: 'Términos y condiciones de uso y prestación del servicio de integraciones y automatización contable',
    version: '1.1',
    integrationLabel: 'SIIGO',
    text: siigoText,
  },
}

export function getIntegrationPolicy(mode: IntegrationMode): IntegrationPolicy | undefined {
  return policies[mode]
}
