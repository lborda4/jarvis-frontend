import { WHATSAPP_SUPPORT_HREF } from '../constants/contact'
import { HeadsetIcon } from './icons/SidebarIcons'
import './SupportFab.css'

export default function SupportFab() {
  return (
    <a
      href={WHATSAPP_SUPPORT_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className="support-fab"
      aria-label="Ayuda por WhatsApp"
      title="¿Necesitas ayuda?"
    >
      <HeadsetIcon className="support-fab__icon" />
    </a>
  )
}
