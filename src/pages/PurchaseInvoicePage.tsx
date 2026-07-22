import { DocumentWorkspacePage } from './SupportDocumentPage'
import { PURCHASE_INVOICE_WORKSPACE } from '../constants/documentWorkspaceConfig'

function PurchaseInvoicePage() {
  return <DocumentWorkspacePage config={PURCHASE_INVOICE_WORKSPACE} />
}

export default PurchaseInvoicePage
