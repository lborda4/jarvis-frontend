import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AdminRoute from './components/AdminRoute'
import AdminClientDetailPage from './pages/AdminClientDetailPage'
import AdvisorRegistrationPage from './pages/AdvisorRegistrationPage'
import AdvisorAccountPage, { AdminAdvisorAccountPage } from './pages/AdvisorAccountPage'
import DefaultAppRedirect from './components/DefaultAppRedirect'
import ProtectedRoute from './components/ProtectedRoute'
import SupportDocumentRoute from './components/SupportDocumentRoute'
import PurchaseInvoiceRoute from './components/PurchaseInvoiceRoute'
import BankStatementClosingPage from './pages/BankStatementClosingPage'
import BankStatementHistoryPage from './pages/BankStatementHistoryPage'
import ProductListPage from './pages/ProductListPage'
import ProductsImportPage from './pages/ProductsImportPage'
import { PRODUCTS_BULK_IMPORT_ENABLED } from './constants/featureFlags'
import ClientProductsRoute from './components/ClientProductsRoute'
import TercerosRoute from './components/TercerosRoute'
import JarvisTaxesRoute from './components/JarvisTaxesRoute'
import JarvisIntegrationRoute from './components/JarvisIntegrationRoute'
import JarvisCreditNoteRoute from './components/JarvisCreditNoteRoute'
import SiigoIntegrationRoute from './components/SiigoIntegrationRoute'
import RadianRoute from './components/RadianRoute'
import { AuthProvider } from './context/AuthContext'
import { SubscriptionAccessProvider } from './context/SubscriptionAccessContext'
import { SiigoSetupProvider } from './context/SiigoSetupContext'
import { SiigoCatalogProvider } from './context/SiigoCatalogContext'
import { ImportSessionProvider } from './context/ImportSessionContext'
import AppLayout from './layout/AppLayout'
import SalesInvoicePage from './pages/SalesInvoicePage'
import JarvisReportsPage from './pages/JarvisReportsPage'
import SalesInvoiceListPage from './pages/SalesInvoiceListPage'
import SalesInvoicesImportRoute from './components/SalesInvoicesImportRoute'
import SalesInvoicePreviewPage from './pages/SalesInvoicePreviewPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import LandingPage from './pages/LandingPage'
import PayrollPage from './pages/payroll/PayrollPage'
import RegisterPage from './pages/RegisterPage'
import './styles/integration.css'

function CompanyApplicationProviders() {
  return <SubscriptionAccessProvider><SiigoSetupProvider><SiigoCatalogProvider><ImportSessionProvider><Outlet /></ImportSessionProvider></SiigoCatalogProvider></SiigoSetupProvider></SubscriptionAccessProvider>
}

function App() {
  return (
    <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/siigo" element={<LandingPage product="siigo" />} />
            <Route path="/facturacion-electronica" element={<LandingPage product="billing" />} />
            <Route path="/nomina-electronica" element={<LandingPage product="payroll" />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/olvide-mi-contrasena" element={<ForgotPasswordPage />} />
            <Route path="/restablecer-contrasena" element={<ResetPasswordPage />} />
            <Route path="/registro" element={<RegisterPage />} />
            <Route path="/registro/asesor" element={<AdvisorRegistrationPage />} />
            <Route path="/asesor" element={<AdvisorAccountPage />} />
            <Route path="/politica-de-tratamiento-de-datos" element={<PrivacyPolicyPage />} />
            <Route path="/admin" element={<AdminRoute />} />
            <Route path="/admin/asesores/:advisorId" element={<AdminRoute><AdminAdvisorAccountPage /></AdminRoute>} />
            <Route path="/admin/clientes/:companyId" element={<AdminRoute><AdminClientDetailPage /></AdminRoute>} />

            <Route element={<ProtectedRoute />}>
              <Route element={<CompanyApplicationProviders />}>
              <Route element={<AppLayout />}>
                <Route path="/inicio" element={<DefaultAppRedirect />} />
                <Route path="/reportes" element={<JarvisReportsPage />} />
                <Route path="/nomina" element={<PayrollPage />} />
                <Route path="/nomina/nueva" element={<PayrollPage />} />
                <Route path="/nomina/empleados" element={<PayrollPage />} />
                <Route path="/eventos-radian" element={<RadianRoute />} />

                <Route
                  path="/documento-soporte"
                  element={<SupportDocumentRoute />}
                />
                <Route
                  path="/documento-soporte/masivo"
                  element={<Navigate to="/documento-soporte/importar" replace />}
                />
                <Route
                  path="/documento-soporte/nuevo"
                  element={<SupportDocumentRoute view="individual" />}
                />
                <Route
                  path="/documento-soporte/importar"
                  element={<SupportDocumentRoute view="import" />}
                />
                <Route
                  path="/documento-soporte/historial"
                  element={<Navigate to="/documento-soporte" replace />}
                />
                <Route
                  path="/documento-soporte/:id/visualizar"
                  element={<SalesInvoicePreviewPage supportDocument />}
                />

                <Route path="/factura-compra" element={<PurchaseInvoiceRoute />} />
                <Route path="/factura-venta" element={<SalesInvoiceListPage />} />
                <Route path="/factura-venta/importar" element={<SalesInvoicesImportRoute />} />
                <Route path="/factura-venta/:id/visualizar" element={<SalesInvoicePreviewPage />} />
                <Route path="/nota-debito" element={<SalesInvoiceListPage key="debit-list" debitNote />} />
                <Route path="/nota-debito/nueva" element={<SalesInvoicePage key="debit-form" debitNote />} />
                <Route path="/nota-debito/:id/visualizar" element={<SalesInvoicePreviewPage debitNote />} />
                <Route element={<JarvisCreditNoteRoute />}>
                  <Route path="/nota-credito" element={<SalesInvoiceListPage key="credit-list" creditNote />} />
                  <Route path="/nota-credito/nueva" element={<SalesInvoicePage key="credit-form" creditNote />} />
                  <Route path="/nota-credito/:id/visualizar" element={<SalesInvoicePreviewPage creditNote />} />
                </Route>
                <Route path="/nota-ajuste" element={<SalesInvoiceListPage key="adjustment-list" adjustmentNote />} />
                <Route path="/nota-ajuste/nueva" element={<SalesInvoicePage key="adjustment-form" adjustmentNote />} />
                <Route path="/nota-ajuste/:id/visualizar" element={<SalesInvoicePreviewPage adjustmentNote />} />
                <Route path="/factura-venta/nueva" element={<SalesInvoicePage />} />

                <Route path="/terceros" element={<TercerosRoute />} />
                <Route path="/terceros/importar" element={<TercerosRoute importing />} />
                <Route path="/formas-de-pago" element={<JarvisTaxesRoute paymentMethods />} />
                <Route
                  path="/impuestos-retenciones"
                  element={<JarvisTaxesRoute />}
                />

                <Route element={<ClientProductsRoute />}>
                  <Route
                    path="/productos"
                    element={<Navigate to="/productos/listar" replace />}
                  />
                  <Route
                    path="/productos/crear"
                    element={<Navigate to="/productos/listar" replace />}
                  />
                  <Route path="/productos/listar" element={<ProductListPage />} />
                  <Route path="/productos/importar" element={PRODUCTS_BULK_IMPORT_ENABLED ? <ProductsImportPage /> : <Navigate to="/productos/listar" replace />} />
                </Route>

                <Route
                  path="/extractos-bancarios"
                  element={<Navigate to="/extractos-bancarios/cargar" replace />}
                />
                <Route
                  path="/extractos-bancarios/cargar"
                  element={<BankStatementClosingPage />}
                />
                <Route
                  path="/extractos-bancarios/historial"
                  element={<BankStatementHistoryPage />}
                />

                <Route
                  path="/configuracion/integracion-siigo"
                  element={<SiigoIntegrationRoute />}
                />
                <Route
                  path="/configuracion/integracion-jarvis"
                  element={<JarvisIntegrationRoute />}
                />
                <Route
                  path="/facturas/*"
                  element={<Navigate to="/documento-soporte" replace />}
                />
                <Route path="*" element={<DefaultAppRedirect />} />
              </Route>
              </Route>
            </Route>
          </Routes>
    </AuthProvider>
  )
}

export default App
