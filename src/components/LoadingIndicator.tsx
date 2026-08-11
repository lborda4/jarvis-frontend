import Banner from './Banner'

interface LoadingIndicatorProps {
  message?: string
}

function LoadingIndicator({
  message = 'Procesando archivo...',
}: LoadingIndicatorProps) {
  return <Banner variant="loading" message={message} />
}

export default LoadingIndicator
