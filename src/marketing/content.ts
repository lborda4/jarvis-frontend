import type { Product } from './catalog'

export const BILLING_SOLUTIONS = [
  { title: 'Factura de venta', description: 'Crea tus facturas electrónicas de venta en JARVIS y envíalas directamente a la DIAN.', icon: 'invoice' as const },
  { title: 'Documento soporte', description: 'Crea y emite tus documentos soporte desde JARVIS, directamente con la DIAN.', icon: 'docs' as const },
  { title: 'Nota débito', description: 'Crea notas débito para registrar ajustes a tus facturas de venta.', icon: 'invoice' as const },
  { title: 'Nota crédito', description: 'Gestiona devoluciones y correcciones de tus facturas con notas crédito.', icon: 'docs' as const },
  { title: 'RADIAN', description: 'Gestiona los eventos RADIAN de tus facturas electrónicas desde la misma plataforma.', icon: 'dian' as const },
]

export const MARKETING_FAQS: Record<Product | 'home', { question: string; answer: string }[]> = {
  home: [
    { question: '¿Qué solución JARVIS necesita mi negocio?', answer: 'Puedes elegir facturación electrónica para emitir tus documentos directamente con la DIAN, nómina electrónica para gestionar la nómina de tus empleados o causación automática para agilizar tu operación contable con Siigo. Cada solución tiene sus propios planes y acompañamiento personalizado.' },
    { question: '¿Necesito Siigo para facturar electrónicamente con JARVIS?', answer: 'No. La facturación electrónica directa con la DIAN funciona desde JARVIS sin necesitar una cuenta de Siigo. La cuenta de Siigo se necesita cuando eliges la solución de automatización conectada con ese sistema.' },
    { question: '¿Puedo recibir ayuda para elegir e implementar mi solución?', answer: 'Sí. Escríbenos por WhatsApp para revisar las necesidades de facturación, nómina o causación de tu empresa. Te orientamos sobre los planes y te acompañamos durante la implementación.' },
  ],
  siigo: [
    { question: '¿JARVIS reemplaza mi cuenta de Siigo?', answer: 'No. Esta solución se conecta con tu cuenta de Siigo para automatizar tareas. Siigo sigue siendo el sistema contable al que envías los documentos que preparas y revisas en JARVIS.' },
    { question: '¿Qué puedo automatizar con la integración de Siigo?', answer: 'Puedes realizar el cargue masivo de documentos soporte desde Excel, preparar y enviar facturas de compra, gestionar terceros y recibir sugerencias de clasificación contable con IA para revisar antes del envío.' },
    { question: '¿La inteligencia artificial envía las compras sin revisión?', answer: 'Las sugerencias de clasificación contable te ayudan a preparar las compras. Puedes revisar los datos antes de enviar los documentos a Siigo.' },
    { question: '¿Cuánto cuestan los planes de cargue masivo a Siigo?', answer: 'Los planes de documentos soporte comienzan en $35.000 COP al mes por hasta 100 documentos. También hay planes de 500, 1.000 y 5.000 documentos, y una opción corporativa para cotizar. Estos precios corresponden al cargue masivo a Siigo; consulta el alcance y precio de otras funciones con un asesor.' },
    { question: '¿Estos planes incluyen facturación electrónica directa desde JARVIS?', answer: 'Los planes de esta página corresponden al cargue masivo de documentos soporte en Siigo. La emisión directa desde JARVIS con la DIAN es otra solución y tiene sus propios planes.' },
  ],
  billing: [
    { question: '¿Qué documentos y servicios ofrece Facturación JARVIS?', answer: 'Puedes emitir facturas de venta, documentos soporte, notas débito y notas crédito, y gestionar eventos RADIAN desde JARVIS, directamente con la DIAN y sin necesitar una cuenta de Siigo.' },
    { question: '¿Puedo facturar directamente con la DIAN sin tener Siigo?', answer: 'Sí. Facturación JARVIS permite crear y emitir facturas electrónicas directamente con la DIAN desde JARVIS, sin necesitar una cuenta de Siigo.' },
    { question: '¿Cuánto cuesta empezar a facturar electrónicamente con JARVIS?', answer: 'Puedes elegir el plan anual de $130.000 COP, que incluye 50 documentos electrónicos y no tiene mensualidad, o el plan de facturación electrónica ilimitada por $60.000 COP al mes.' },
    { question: '¿Cómo funciona el plan anual?', answer: 'El plan anual cuesta $130.000 COP al año e incluye 50 documentos electrónicos. Cuando necesitas más documentos, puedes comprar recargas de 10, 25, 50, 100, 250 o 500 documentos, según tu operación.' },
    { question: '¿Cuánto cuesta la facturación electrónica ilimitada?', answer: 'El plan de facturación electrónica ilimitada cuesta $60.000 COP mensuales. Es una alternativa al plan anual para negocios que prefieren pagar una cantidad fija cada mes por emitir sus facturas.' },
    { question: '¿Qué información puedo organizar para emitir mis documentos?', answer: 'Además de facturas de venta, documentos soporte, notas débito, notas crédito y eventos RADIAN, en JARVIS puedes gestionar clientes y terceros y configurar productos e impuestos desde la misma plataforma.' },
  ],
}

export const MARKETING_STEPS: Record<Product, { title: string; description: string }[]> = {
  siigo: [
    { title: 'Conecta tu Siigo', description: 'Configura la integración de tu cuenta para trabajar con los datos de tu operación contable.' },
    { title: 'Carga y revisa', description: 'Carga documentos soporte desde Excel o prepara tus compras. Revisa los datos y las sugerencias contables antes del envío.' },
    { title: 'Envía a Siigo', description: 'Envía los documentos revisados y consulta su estado desde JARVIS.' },
  ],
  billing: [
    { title: 'Elige tu modalidad', description: 'Elige el plan anual con 50 documentos o facturación ilimitada con pago mensual.' },
    { title: 'Organiza tus datos', description: 'Configura la información de tus clientes, productos e impuestos para preparar tus facturas.' },
    { title: 'Crea y emite', description: 'Revisa tu factura electrónica y envíala desde JARVIS directamente con la DIAN.' },
  ],
}
