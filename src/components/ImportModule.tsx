import ErrorMessage from './ErrorMessage'
import AccountMappingModal from './AccountMappingModal'
import FileUploadArea from './FileUploadArea'
import InvoiceResultsTable from './InvoiceResultsTable'
import LoadedFileInfo from './LoadedFileInfo'
import LoadingIndicator from './LoadingIndicator'
import SupplierCreateModal from './SupplierCreateModal'
import { useInvoiceTable } from '../hooks/useInvoiceTable'
import { useInvoiceUpload } from '../hooks/useInvoiceUpload'
import type { ImportModuleProps } from '../types/importModule'
import { ELECTRONIC_DOCUMENT_TYPE } from '../types/electronicDocument'
import '../pages/InvoiceUpload.css'

function ImportModule({
  title,
  description,
  electronicDocumentType,
  integration = 'siigo',
}: ImportModuleProps) {
  void integration
  const isSupportDocument =
    electronicDocumentType === ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT
  const {
    isLoading,
    errorMessage,
    data,
    loadedDocument,
    uploadFile,
    setValidationError,
  } = useInvoiceUpload(electronicDocumentType)

  const {
    rows,
    selectedCufes,
    isImporting,
    supplierModal,
    accountModal,
    toggleRowSelection,
    selectRows,
    importSelected,
    closeSupplierModal,
    createSupplier,
    setSupplierPersonType,
    retryCreateSupplier,
    continueAfterSupplierCreated,
    closeAccountModal,
    selectAccount,
    saveAccount,
    retrySaveAccount,
    acceptPurchase,
  } = useInvoiceTable(data)

  const isModalOpen = supplierModal.isOpen || accountModal.isOpen

  return (
    <main className="invoice-upload">
      <header className="invoice-upload__header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>

      <FileUploadArea
        disabled={isLoading || isImporting || isModalOpen}
        onFileSelect={uploadFile}
        onInvalidFile={setValidationError}
      />

      {isLoading && <LoadingIndicator />}
      {loadedDocument && !isLoading && (
        <LoadedFileInfo document={loadedDocument} />
      )}
      {errorMessage && <ErrorMessage message={errorMessage} />}
      {data && (
        <InvoiceResultsTable
          data={data}
          rows={rows}
          selectedCufes={selectedCufes}
          isImporting={isImporting}
          title={
            isSupportDocument
              ? 'Documentos soporte procesados'
              : 'Facturas procesadas'
          }
          emptyMessage={
            isSupportDocument
              ? (data.total ?? rows.length) === 0
                ? 'El archivo se procesó correctamente, pero no se encontraron documentos soporte.'
                : 'No hay documentos soporte que coincidan con los filtros aplicados.'
              : undefined
          }
          onToggleRow={toggleRowSelection}
          onSelectRows={selectRows}
          onImportSelected={importSelected}
        />
      )}

      <SupplierCreateModal
        isOpen={supplierModal.isOpen}
        view={supplierModal.view}
        supplierName={supplierModal.supplierName}
        supplierDocument={supplierModal.supplierDocument}
        personType={supplierModal.personType}
        errorMessage={supplierModal.errorMessage}
        createdSupplier={supplierModal.createdSupplier}
        onCancel={closeSupplierModal}
        onPersonTypeChange={setSupplierPersonType}
        onCreateSupplier={createSupplier}
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

export default ImportModule
