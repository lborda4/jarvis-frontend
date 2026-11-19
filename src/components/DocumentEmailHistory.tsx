import type { DocumentEmailDelivery } from '../types/electronicDocument'
import './DocumentEmailHistory.css'

const dateFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export default function DocumentEmailHistory({ deliveries }: { deliveries: DocumentEmailDelivery[] }) {
  return <section className="document-email-history" aria-label="Envíos de correo" aria-live="polite">
    {deliveries.length === 0 ? <p>Sin envíos de correo registrados.</p> : <ul>{deliveries.map((delivery, index) => {
      const date = new Date(delivery.sentAt)
      return <li key={`${delivery.sentAt}:${index}`}>
        <p><strong>Documento enviado a:</strong> {delivery.recipients.join(', ')}</p>
        {!Number.isNaN(date.getTime()) && <time dateTime={delivery.sentAt}>{dateFormat.format(date)} (COL)</time>}
      </li>
    })}</ul>}
  </section>
}
