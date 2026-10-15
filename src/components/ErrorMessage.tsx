import Banner from './Banner'
import { useState } from 'react'
import DocumentNotice from './DocumentNotice'
import { useIsJarvisIntegration } from '../context/IntegrationSetupContext'
import { clientFacingError } from '../utils/clientFacingError'

interface ErrorMessageProps {
  message: string
  inline?: boolean
}

function FloatingError({ message }: { message: string }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return <DocumentNotice variant="error" title="Ha ocurrido un error" message={message} onDismiss={() => setDismissed(true)} />
}

function ErrorMessage({ message, inline = false }: ErrorMessageProps) {
  const isJarvis = useIsJarvisIntegration()
  message = clientFacingError(message)
  if (isJarvis && !inline) return <FloatingError key={message} message={message} />
  return <Banner variant="error" message={message} />
}

export default ErrorMessage
