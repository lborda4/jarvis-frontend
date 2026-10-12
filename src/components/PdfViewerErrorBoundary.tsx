import { Component, type ReactNode } from 'react'
import PdfPreviewError from './PdfPreviewError'

export default class PdfViewerErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    // Reload also recovers a stale lazy module URL after a deployment.
    return this.state.failed
      ? <PdfPreviewError onRetry={() => window.location.reload()} />
      : this.props.children
  }
}
