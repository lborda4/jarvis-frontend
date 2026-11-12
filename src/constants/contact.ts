export const CONTACT_PHONE = '+573223221407'
export const CONTACT_PHONE_LABEL = '+57 322 3221407'
export const SALES_EMAIL = 'ventas@jarviscol.com'
export const INSTAGRAM_HANDLE = 'jarviscol_oficial'
export const INSTAGRAM_HREF = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`
const WHATSAPP_NUMBER = CONTACT_PHONE.slice(1)

export function buildWhatsappHref(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export const WHATSAPP_DEMO_HREF = buildWhatsappHref(
  'Hola, quiero solicitar una demo de JARVIS',
)

export const WHATSAPP_SUPPORT_HREF = buildWhatsappHref(
  'Hola, necesito ayuda usando JARVIS',
)

export const WHATSAPP_DOCUMENTS_HREF = buildWhatsappHref('Hola, quiero comprar más documentos para mi empresa en JARVIS')
