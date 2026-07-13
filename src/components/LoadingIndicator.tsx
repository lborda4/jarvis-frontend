interface LoadingIndicatorProps {
  message?: string
}

function LoadingIndicator({
  message = 'Procesando archivo...',
}: LoadingIndicatorProps) {
  return (
    <div className="loading-indicator" role="status" aria-live="polite">
      <span className="loading-indicator__spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

export default LoadingIndicator
