import PageHeader from '../components/PageHeader'
import { PulseIcon } from '../components/icons/SidebarIcons'
import './BankStatementHistoryPage.css'

function BankStatementHistoryPage() {
  return (
    <main className="bank-history-page">
      <PageHeader
        title="Historial de Cierres"
        description="Consulta los extractos bancarios que Jarvis ya concilió."
      />

      <div className="bank-history-empty">
        <PulseIcon className="bank-history-empty__icon" />
        <strong>Aún no hay cierres registrados</strong>
        <p>
          Cuando confirmes un cierre desde "Cargar Extracto", aparecerá aquí con su
          resumen y reporte.
        </p>
      </div>
    </main>
  )
}

export default BankStatementHistoryPage
