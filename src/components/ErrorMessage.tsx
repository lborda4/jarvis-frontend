import Banner from './Banner'
import { useState } from 'react'
import DocumentNotice from './DocumentNotice'
import { useIsJarvisIntegration } from '../context/IntegrationSetupContext'

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
  if (isJarvis && !inline) return <FloatingError key={message} message={message} />
  return <Banner variant="error" message={message} />
}

export default ErrorMessage
