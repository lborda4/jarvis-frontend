import AccountMappingModal from './AccountMappingModal'
import DocumentDashboardFilters from './DocumentDashboardFilters'
import DocumentDashboardTable from './DocumentDashboardTable'
import ErrorMessage from './ErrorMessage'
import SupplierCreateModal from './SupplierCreateModal'
import { useDocumentDashboard } from '../hooks/useDocumentDashboard'
import type { ImportHistoryProps } from '../types/importModule'
import '../pages/DocumentDashboard.css'
import '../pages/InvoiceUpload.css'

function ImportHistory({ title, electronicDocumentType }: ImportHistoryProps) {
  const {
    documents,
    filters,
    total,
    isLoading,
    isResuming,
    isModalOpen,
    errorMessage,
    supplierModal,
    accountModal,
    updateFilter,
    resetFilters,
    continueSupplier,
    continueAccount,
    retryDocument,
    closeSupplierModal,
    closeAccountModal,
    handleCreateSupplier,
    retryCreateSupplier,
    continueAfterSupplierCreated,
    selectAccount,
    saveAccount,
    retrySaveAccount,
    acceptPurchase,
  } = useDocumentDashboard(electronicDocumentType)

  return (
    <main className="document-dashboard">
      <header className="document-dashboard__header">
        <div>
          <h1>{title}</h1>
          <p>
            Consulte el historial de importaciones y retome documentos pendientes
            sin volver a cargar el archivo.
          </p>
        </div>
        <p className="document-dashboard__summary">
          Total: <strong>{total}</strong>
        </p>
      </header>

      <DocumentDashboardFilters
        filters={filters}
        disabled={isLoading || isModalOpen || isResuming}
        onFilterChange={updateFilter}
        onReset={resetFilters}
      />

      {errorMessage && <ErrorMessage message={errorMessage} />}

      <DocumentDashboardTable
        documents={documents}
        isLoading={isLoading}
        isResuming={isResuming}
        onContinueSupplier={continueSupplier}
        onContinueAccount={continueAccount}
        onRetry={retryDocument}
      />

      <SupplierCreateModal
        isOpen={supplierModal.isOpen}
        view={supplierModal.view}
        supplierName={supplierModal.supplierName}
        supplierDocument={supplierModal.supplierDocument}
        errorMessage={supplierModal.errorMessage}
        createdSupplier={supplierModal.createdSupplier}
        onCancel={closeSupplierModal}
        onCreateSupplier={handleCreateSupplier}
        onContinue={continueAfterSupplierCreated}
        onRetry={retryCreateSupplier}
      />

      <AccountMappingModal
        isOpen={accountModal.isOpen}
        view={accountModal.view}
        selectedAccount={accountModal.selectedAccount}
        createdPurchase={accountModal.createdPurchase}
        errorMessage={accountModal.errorMessage}
        errorPhase={accountModal.errorPhase}
        onCancel={closeAccountModal}
        onSelectAccount={selectAccount}
        onSave={saveAccount}
        onAccept={acceptPurchase}
        onRetry={retrySaveAccount}
      />
    </main>
  )
}

export default ImportHistory
