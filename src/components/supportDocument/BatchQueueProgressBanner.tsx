import type { BatchQueueProgress } from '../../hooks/useSupportDocumentSend'

interface BatchQueueProgressBannerProps {
  progress: BatchQueueProgress
  tone?: 'send' | 'delete'
}

function BatchQueueProgressBanner({
  progress,
  tone = 'send',
}: BatchQueueProgressBannerProps) {
  const percent =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0
  const inFlight = progress.completed < progress.total ? progress.current : progress.total

  return (
    <div
      className={[
        'batch-queue-progress',
        `batch-queue-progress--${tone}`,
      ].join(' ')}
      role="status"
      aria-live="polite"
      aria-busy={progress.completed < progress.total}
    >
      <div className="batch-queue-progress__header">
        <span className="batch-queue-progress__spinner" aria-hidden="true" />
        <div className="batch-queue-progress__copy">
          <strong className="batch-queue-progress__count">
            {inFlight} de {progress.total}
          </strong>
          <span className="batch-queue-progress__label">{progress.label}</span>
        </div>
        <span className="batch-queue-progress__percent">{percent}%</span>
      </div>
      <div
        className="batch-queue-progress__track"
        aria-hidden="true"
      >
        <div
          className="batch-queue-progress__fill"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export default BatchQueueProgressBanner
