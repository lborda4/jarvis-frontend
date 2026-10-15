const WHATSAPP_NUMBER = '573195355387'

function buildWhatsappHref(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export const WHATSAPP_DEMO_HREF = buildWhatsappHref(
  'Hola, quiero solicitar una demo de JARVIS',
)

export const WHATSAPP_SUPPORT_HREF = buildWhatsappHref(
  'Hola, necesito ayuda usando JARVIS',
)

export const WHATSAPP_DOCUMENTS_HREF = buildWhatsappHref('Hola, quiero comprar más documentos para mi empresa en JARVIS')
